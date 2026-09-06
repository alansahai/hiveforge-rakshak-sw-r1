import os
import sys
import pickle
import logging
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import MODELS_DIR, DATA_DIR

logger = logging.getLogger("EfficiencyAnalyzer")

def train_efficiency_analyzer(df_features: pd.DataFrame, output_dir: Path = MODELS_DIR) -> dict:
    """
    Trains regression model to predict project duration and timeline inefficiencies.
    Saves model artifacts, efficiency benchmarks, and visualization.
    """
    logger.info("Starting Efficiency Analyzer training...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Target: project_duration_days (or days_behind_schedule)
    target_col = 'project_duration_days' if 'project_duration_days' in df_features.columns else 'days_behind_schedule'
    
    exclude_cols = [
        'project_id', 'approval_id', target_col, 'days_behind_schedule',
        'risk_score', 'overall_fraud_probability', 'audit_trigger_score',
        'escalation_priority_score'
    ]
    feature_cols = [
        c for c in df_features.columns 
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df_features[c])
    ]
    
    X = df_features[feature_cols].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    y = df_features[target_col].values.astype(np.float32)
    y = np.nan_to_num(y, nan=365.0, posinf=730.0, neginf=90.0)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    
    logger.info(f"Fitting GradientBoostingRegressor on {len(X_train)} projects...")
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))
    
    residuals = y_test - y_pred
    res_mean = float(np.mean(residuals))
    res_std = float(np.std(residuals))
    
    logger.info(f"Efficiency Regressor Test Metrics: RMSE={rmse:.2f} days, R2={r2:.4f}, Residual Std={res_std:.2f}")
    
    model_payload = {
        'model': model,
        'features': feature_cols,
        'target_col': target_col,
        'residual_mean': res_mean,
        'residual_std': res_std,
        'rmse': rmse,
        'r2': r2
    }
    
    model_path1 = output_dir / "efficiency_analyzer.pkl"
    model_path2 = output_dir / "efficiency_regressor.pkl"
    with open(model_path1, "wb") as f:
        pickle.dump(model_payload, f)
    with open(model_path2, "wb") as f:
        pickle.dump(model_payload, f)
    logger.info(f"Saved Efficiency Analyzer to {model_path1} and {model_path2}")
    
    # Generate scatter plot of predicted vs actual duration
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        sample_indices = np.random.choice(len(y_test), size=min(1000, len(y_test)), replace=False)
        plt.figure(figsize=(7, 6))
        plt.scatter(y_test[sample_indices], y_pred[sample_indices], alpha=0.4, color='#10B981', edgecolors='none')
        min_v = min(y_test.min(), y_pred.min())
        max_v = max(y_test.max(), y_pred.max())
        plt.plot([min_v, max_v], [min_v, max_v], 'r--', lw=1.5, label='Perfect Alignment')
        plt.title("Actual vs Predicted Project Duration (Days)")
        plt.xlabel("Actual Duration (Days)")
        plt.ylabel("Predicted Duration (Days)")
        plt.legend()
        plt.tight_layout()
        
        plot_path = DATA_DIR / "results" / "efficiency_predictions.png"
        plot_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(plot_path, dpi=120)
        plt.close()
        logger.info(f"Saved duration comparison chart to {plot_path}")
    except Exception as e:
        logger.warning(f"Plot generation skipped: {str(e)}")
        
    return {
        'model_path': str(model_path1),
        'rmse': rmse,
        'r2': r2,
        'residual_std': res_std
    }

def analyze_efficiency(df_features: pd.DataFrame, models_dir: Path = MODELS_DIR) -> pd.DataFrame:
    """
    Predicts project duration, computes efficiency score, and identifies root causes of bottlenecks.
    """
    model_path = models_dir / "efficiency_analyzer.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Trained efficiency analyzer model not found.")
        
    with open(model_path, "rb") as f:
        payload = pickle.load(f)
        
    model = payload['model']
    features = payload['features']
    res_std = payload.get('residual_std', 30.0)
    
    X = df_features[features].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    predicted_duration = np.maximum(model.predict(X), 30.0)
    actual_duration = df_features.get('project_duration_days', pd.Series(predicted_duration, index=df_features.index)).values
    
    residuals = actual_duration - predicted_duration
    inefficiency_flag = residuals > (1.5 * res_std)
    
    # Efficiency Score Formula:
    # 1 - min(1, max(abs(actual - predicted) / predicted, (spend_rate_variance / expected) * 0.5))
    spend_variance = df_features.get('budget_variance', pd.Series(0.1, index=df_features.index)).values
    term1 = np.abs(actual_duration - predicted_duration) / (predicted_duration + 1e-4)
    term2 = spend_variance * 0.5
    eff_penalty = np.minimum(1.0, np.maximum(term1, term2))
    efficiency_score = (1.0 - eff_penalty).clip(0.05, 1.0)
    
    # Root Cause Hypotheses
    root_causes = []
    concurrency = df_features.get('contractor_concurrency', pd.Series(1, index=df_features.index)).values
    amount_lag = df_features.get('amount_lag', pd.Series(30, index=df_features.index)).values
    velocity = df_features.get('progress_velocity', pd.Series(0.5, index=df_features.index)).values
    inflation = df_features.get('cost_inflation_flag', pd.Series(0, index=df_features.index)).values
    
    for i in range(len(df_features)):
        causes = []
        if concurrency[i] >= 5:
            causes.append(f"High contractor workload ({int(concurrency[i])} concurrent projects)")
        if amount_lag[i] > 60:
            causes.append(f"Substantial fund release delay ({int(amount_lag[i])} days to initial payment)")
        if velocity[i] < 0.15:
            causes.append("Low progress execution velocity")
        if inflation[i] == 1:
            causes.append("Cost inflation exceeding initial sanction")
        if not causes:
            causes.append("Standard timeline execution with nominal variances")
        root_causes.append("; ".join(causes))
        
    res = pd.DataFrame(index=df_features.index)
    res['predicted_duration_days'] = predicted_duration.round(1)
    res['actual_duration_days'] = actual_duration.round(1)
    res['efficiency_score'] = efficiency_score.round(4)
    res['timeline_risk_flag'] = inefficiency_flag
    res['root_cause_hypothesis'] = root_causes
    
    return res

if __name__ == '__main__':
    from src.config import FEATURE_DATA_PATH
    if FEATURE_DATA_PATH.exists():
        df_feats = pd.read_csv(FEATURE_DATA_PATH, low_memory=False)
        train_efficiency_analyzer(df_feats)
        sample = analyze_efficiency(df_feats.head(10))
        print("Sample efficiency predictions:")
        print(sample[['predicted_duration_days', 'actual_duration_days', 'efficiency_score', 'root_cause_hypothesis']])
