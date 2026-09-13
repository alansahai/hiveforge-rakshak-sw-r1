import os
import sys
import pickle
import logging
from pathlib import Path
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import MODELS_DIR, DATA_DIR

logger = logging.getLogger("AnomalyDetector")

class PyTorchAutoencoder(nn.Module):
    """
    3-layer symmetric deep autoencoder: input_dim -> 128 -> 32 -> 128 -> input_dim.
    """
    def __init__(self, input_dim: int):
        super(PyTorchAutoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 32),
            nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.Linear(32, 128),
            nn.ReLU(),
            nn.Linear(128, input_dim),
            nn.Sigmoid()
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

def train_anomaly_detector(df_features: pd.DataFrame, output_dir: Path = MODELS_DIR) -> dict:
    """
    Trains Isolation Forest and PyTorch Autoencoder on engineered features matrix.
    Computes ensemble anomaly scores and saves model artifacts.
    """
    logger.info("Starting Anomaly Detector training (Isolation Forest + Autoencoder)...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Feature columns (numeric only, excluding IDs and target labels)
    exclude_cols = [
        'project_id', 'approval_id', 'risk_score', 'overall_fraud_probability',
        'audit_trigger_score', 'escalation_priority_score'
    ]
    feature_cols = [
        c for c in df_features.columns 
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df_features[c])
    ]
    
    X = df_features[feature_cols].values.astype(np.float32)
    # Ensure no NaN or inf values
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    # Train / validation split (70% train, 30% val)
    X_train, X_val = train_test_split(X, test_size=0.3, random_state=42)
    
    # -------------------------------------------------------------
    # 1. Isolation Forest
    # -------------------------------------------------------------
    logger.info(f"Training Isolation Forest on {len(X_train)} training records...")
    iso_forest = IsolationForest(
        n_estimators=100, 
        contamination=0.10, 
        random_state=42, 
        n_jobs=-1
    )
    iso_forest.fit(X_train)
    
    # Compute baseline score bounds and percentiles
    val_iso_raw = -iso_forest.score_samples(X_val)
    iso_min = float(val_iso_raw.min())
    iso_p50 = float(np.percentile(val_iso_raw, 50))
    iso_p85 = float(np.percentile(val_iso_raw, 85))
    iso_p95 = float(np.percentile(val_iso_raw, 95))
    iso_max = float(val_iso_raw.max())
    
    iso_meta = {
        'model': iso_forest,
        'features': feature_cols,
        'score_min': iso_min,
        'score_p50': iso_p50,
        'score_p85': iso_p85,
        'score_p95': iso_p95,
        'score_max': iso_max
    }
    iso_path = output_dir / "isolation_forest.pkl"
    with open(iso_path, "wb") as f:
        pickle.dump(iso_meta, f)
    logger.info(f"Isolation Forest model saved to {iso_path}")
    
    # -------------------------------------------------------------
    # 2. PyTorch Autoencoder
    # -------------------------------------------------------------
    input_dim = X.shape[1]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Training PyTorch Autoencoder (input_dim={input_dim}) on {device}...")
    
    autoencoder = PyTorchAutoencoder(input_dim).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(autoencoder.parameters(), lr=0.005)
    
    train_tensor = torch.tensor(X_train, dtype=torch.float32)
    val_tensor = torch.tensor(X_val, dtype=torch.float32).to(device)
    
    train_loader = DataLoader(TensorDataset(train_tensor), batch_size=512, shuffle=True)
    
    epochs = 25  # Fast and effective convergence
    autoencoder.train()
    for epoch in range(epochs):
        for (batch_x,) in train_loader:
            batch_x = batch_x.to(device)
            optimizer.zero_grad()
            reconstructed = autoencoder(batch_x)
            loss = criterion(reconstructed, batch_x)
            loss.backward()
            optimizer.step()
            
    # Compute reconstruction error on validation set
    autoencoder.eval()
    with torch.no_grad():
        val_reconstructed = autoencoder(val_tensor)
        val_errors = torch.mean((val_tensor - val_reconstructed) ** 2, dim=1).cpu().numpy()
        
    error_mean = float(np.mean(val_errors))
    error_std = float(np.std(val_errors))
    error_p50 = float(np.percentile(val_errors, 50))
    error_p90 = float(np.percentile(val_errors, 90))
    ae_threshold = error_mean + 2.0 * error_std
    logger.info(f"Autoencoder validation reconstruction error: mean={error_mean:.4f}, std={error_std:.4f}, threshold={ae_threshold:.4f}")
    
    # Save Autoencoder checkpoint
    ae_payload = {
        'state_dict': autoencoder.state_dict(),
        'input_dim': input_dim,
        'features': feature_cols,
        'threshold': ae_threshold,
        'error_mean': error_mean,
        'error_std': error_std,
        'error_p50': error_p50,
        'error_p90': error_p90
    }
    ae_pt_path = output_dir / "autoencoder.pt"
    ae_pth_path = output_dir / "autoencoder.pth"
    torch.save(ae_payload, ae_pt_path)
    torch.save(ae_payload, ae_pth_path)
    logger.info(f"PyTorch Autoencoder saved to {ae_pt_path} and {ae_pth_path}")
    
    # -------------------------------------------------------------
    # 3. Anomaly Summary & Visualizations
    # -------------------------------------------------------------
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        plt.figure(figsize=(8, 4))
        plt.hist(val_iso_raw, bins=40, color='#3B82F6', alpha=0.7, label='Isolation Forest Raw Score')
        plt.title("Distribution of Anomaly Scores")
        plt.xlabel("Anomaly Score (higher = more anomalous)")
        plt.ylabel("Frequency")
        plt.legend()
        
        plot_path = DATA_DIR / "results" / "anomaly_score_distribution.png"
        plot_path.parent.mkdir(parents=True, exist_ok=True)
        plt.tight_layout()
        plt.savefig(plot_path, dpi=120)
        plt.close()
        logger.info(f"Anomaly score distribution chart saved to {plot_path}")
    except Exception as e:
        logger.warning(f"Optional plot generation skipped: {str(e)}")
        
    return {
        "isolation_forest": str(iso_path),
        "autoencoder": str(ae_pt_path),
        "features_count": input_dim,
        "records_trained": len(X_train),
        "autoencoder_threshold": ae_threshold
    }

def score_anomalies(df_features: pd.DataFrame, models_dir: Path = MODELS_DIR) -> pd.DataFrame:
    """
    Scores input feature matrix using ensemble of Isolation Forest and Autoencoder.
    Applies calibrated percentile scaling against reference population distributions.
    Returns DataFrame with anomaly_score (0-1), is_anomalous (bool), method (str).
    """
    iso_path = models_dir / "isolation_forest.pkl"
    ae_path = models_dir / "autoencoder.pt"
    
    if not (iso_path.exists() and ae_path.exists()):
        raise FileNotFoundError("Trained anomaly models not found in models/ directory.")
        
    with open(iso_path, "rb") as f:
        iso_meta = pickle.load(f)
        
    ae_payload = torch.load(ae_path, map_location=torch.device("cpu"), weights_only=False)
    
    features = iso_meta['features']
    
    # Ensure all required features are present
    X_df = pd.DataFrame(index=df_features.index)
    for col in features:
        if col in df_features.columns:
            X_df[col] = df_features[col]
        else:
            X_df[col] = 0.0
            
    X = X_df[features].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    # 1. Isolation Forest score with piecewise-linear percentile calibration
    raw_iso = -iso_meta['model'].score_samples(X)
    s_min = iso_meta.get('score_min', float(raw_iso.min()))
    s_p50 = iso_meta.get('score_p50', float(np.median(raw_iso)))
    s_p90 = iso_meta.get('score_p90', float(np.percentile(raw_iso, 90)))
    s_max = iso_meta.get('score_max', float(raw_iso.max()))
    
    # Nominal projects (<= p50) map to [0.05, 0.20]
    # Moderate divergence (p50 to p90) maps to [0.20, 0.55]
    # Severe anomalies (> p90) map to [0.55, 1.00]
    iso_scores = np.where(
        raw_iso <= s_p50,
        0.05 + np.clip((raw_iso - s_min) / (s_p50 - s_min + 1e-6) * 0.15, 0.0, 0.15),
        np.where(
            raw_iso <= s_p90,
            0.20 + np.clip((raw_iso - s_p50) / (s_p90 - s_p50 + 1e-6) * 0.35, 0.0, 0.35),
            0.55 + np.clip((raw_iso - s_p90) / (s_max - s_p90 + 1e-6) * 0.45, 0.0, 0.45)
        )
    )
    iso_flag = iso_scores > 0.60
    
    # 2. Autoencoder reconstruction score
    input_dim = ae_payload['input_dim']
    autoencoder = PyTorchAutoencoder(input_dim)
    autoencoder.load_state_dict(ae_payload['state_dict'])
    autoencoder.eval()
    
    with torch.no_grad():
        x_tensor = torch.tensor(X, dtype=torch.float32)
        recon = autoencoder(x_tensor)
        ae_errors = torch.mean((x_tensor - recon) ** 2, dim=1).numpy()
        
    th = ae_payload['threshold']
    error_mean = ae_payload.get('error_mean', th * 0.4)
    
    # Normal projects (error <= error_mean) map to [0.05, 0.20]
    # Elevated error (error_mean to th) maps to [0.20, 0.55]
    # Outlier reconstruction (> th) maps to [0.55, 1.00]
    ae_scores = np.where(
        ae_errors <= error_mean,
        0.05 + np.clip((ae_errors / (error_mean + 1e-6)) * 0.15, 0.0, 0.15),
        np.where(
            ae_errors <= th,
            0.20 + np.clip((ae_errors - error_mean) / (th - error_mean + 1e-6) * 0.35, 0.0, 0.35),
            0.55 + np.clip((ae_errors - th) / (th * 0.75 + 1e-6) * 0.45, 0.0, 0.45)
        )
    )
    ae_flag = ae_errors > th
    
    # 3. Calibrated Ensemble
    combined_score = np.clip(0.60 * iso_scores + 0.40 * ae_scores, 0.0, 1.0)
    is_anomalous = (combined_score > 0.60) | (iso_flag & ae_flag)
    
    method = np.where(
        iso_flag & ae_flag, "both",
        np.where(iso_flag, "isolation_forest", np.where(ae_flag, "autoencoder", "none"))
    )
    
    res = pd.DataFrame(index=df_features.index)
    res['anomaly_score'] = combined_score.round(4)
    res['is_anomalous'] = is_anomalous
    res['method'] = method
    res['isolation_forest_score'] = iso_scores.round(4)
    res['autoencoder_score'] = ae_scores.round(4)
    
    return res

if __name__ == '__main__':
    from src.config import FEATURE_DATA_PATH
    if FEATURE_DATA_PATH.exists():
        df_feats = pd.read_csv(FEATURE_DATA_PATH, low_memory=False)
        train_anomaly_detector(df_feats)
        scores = score_anomalies(df_feats.head(10))
        print("Sample anomaly predictions:")
        print(scores)
