import os
import sys
import pickle
import logging
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
from xgboost import XGBClassifier

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import MODELS_DIR, DATA_DIR

logger = logging.getLogger("FraudClassifier")

def generate_synthetic_fraud_labels(df_features: pd.DataFrame) -> pd.Series:
    """
    Creates synthetic fraud labels based on 5 core domain signals:
    1. Duplicate works
    2. Ghost projects
    3. Cost inflation (>50%)
    4. Collusive contractor patterns
    5. Round number budget amounts
    Targets approximately 15-20% positive labels.
    """
    dup_signal = (df_features.get('duplicate_work_score', pd.Series(0, index=df_features.index)) > 0.70).astype(float) * 0.25
    ghost_signal = (df_features.get('ghost_project_indicator', pd.Series(0, index=df_features.index)) == 1).astype(float) * 0.35
    inflation_signal = (df_features.get('cost_inflation_flag', pd.Series(0, index=df_features.index)) == 1).astype(float) * 0.30
    concurrency_signal = (df_features.get('contractor_concurrency', pd.Series(0, index=df_features.index)) >= 5).astype(float) * 0.20
    round_signal = (df_features.get('cost_round_number_flag', pd.Series(0, index=df_features.index)) == 1).astype(float) * 0.15
    
    composite_fraud_propensity = dup_signal + ghost_signal + inflation_signal + concurrency_signal + round_signal
    
    # Target top ~18% as positive fraud labels
    threshold = float(np.percentile(composite_fraud_propensity, 82))
    labels = (composite_fraud_propensity >= threshold).astype(int)
    
    # If too few or too many, adjust
    pos_pct = float(labels.mean() * 100)
    logger.info(f"Generated synthetic fraud labels: {labels.sum()} positive ({pos_pct:.1f}%)")
    return labels

def train_fraud_classifier(df_features: pd.DataFrame, output_dir: Path = MODELS_DIR) -> dict:
    """
    Trains XGBoost Fraud Classifier on engineered features.
    Evaluates precision, recall, F1, and ROC-AUC.
    Saves model artifact and feature importance plot.
    """
    logger.info("Starting XGBoost Fraud Classifier training...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate ground-truth labels if not present
    if 'is_fraud' in df_features.columns:
        y = df_features['is_fraud'].values
    else:
        y = generate_synthetic_fraud_labels(df_features).values
        
    exclude_cols = [
        'project_id', 'approval_id', 'is_fraud', 'risk_score',
        'overall_fraud_probability', 'audit_trigger_score', 'escalation_priority_score'
    ]
    feature_cols = [
        c for c in df_features.columns 
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df_features[c])
    ]
    
    X = df_features[feature_cols].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    # 70/30 Stratified train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    
    logger.info(f"Training XGBoost (scale_pos_weight=4, max_depth=7, n_estimators=100) on {len(X_train)} rows...")
    model = XGBClassifier(
        n_estimators=100,
        max_depth=7,
        learning_rate=0.10,
        scale_pos_weight=4.0,
        random_state=42,
        eval_metric='logloss',
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    # Evaluation on 30% test set
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_proba))
    
    logger.info(f"Fraud Classifier Test Metrics: Precision={precision:.4f}, Recall={recall:.4f}, F1={f1:.4f}, ROC-AUC={roc_auc:.4f}")
    
    # Save model artifact
    model_payload = {
        'model': model,
        'features': feature_cols,
        'metrics': {
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'roc_auc': roc_auc
        },
        'feature_importances': dict(zip(feature_cols, model.feature_importances_.tolist()))
    }
    
    model_path = output_dir / "fraud_classifier.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model_payload, f)
    logger.info(f"Saved Fraud Classifier to {model_path}")
    
    # Feature importance chart
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        top_importances = sorted(model_payload['feature_importances'].items(), key=lambda x: x[1], reverse=True)[:15]
        names = [x[0] for x in top_importances][::-1]
        scores = [x[1] for x in top_importances][::-1]
        
        plt.figure(figsize=(9, 6))
        plt.barh(names, scores, color='#EF4444')
        plt.title("Top 15 Feature Importances (XGBoost Fraud Classifier)")
        plt.xlabel("Relative Importance")
        plt.tight_layout()
        
        chart_path = DATA_DIR / "results" / "fraud_feature_importance.png"
        chart_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(chart_path, dpi=120)
        plt.close()
        logger.info(f"Saved feature importance chart to {chart_path}")
    except Exception as e:
        logger.warning(f"Feature importance chart generation skipped: {str(e)}")
        
    return {
        'model_path': str(model_path),
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'roc_auc': roc_auc
    }

def predict_fraud(df_features: pd.DataFrame, models_dir: Path = MODELS_DIR) -> pd.DataFrame:
    """
    Generates fraud probabilities and categorized fraud indicators for input features.
    """
    model_path = models_dir / "fraud_classifier.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Trained fraud classifier model not found.")
        
    with open(model_path, "rb") as f:
        payload = pickle.load(f)
        
    model = payload['model']
    features = payload['features']
    
    X = df_features[features].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    proba = model.predict_proba(X)[:, 1]
    
    res = pd.DataFrame(index=df_features.index)
    res['fraud_probability'] = proba.round(4)
    
    # Categorize
    res['fraud_risk_category'] = pd.cut(
        proba,
        bins=[-0.01, 0.30, 0.55, 0.75, 1.01],
        labels=['low', 'medium', 'high', 'critical']
    ).astype(str)
    
    return res

if __name__ == '__main__':
    from src.config import FEATURE_DATA_PATH
    if FEATURE_DATA_PATH.exists():
        df_feats = pd.read_csv(FEATURE_DATA_PATH, low_memory=False)
        train_fraud_classifier(df_feats)
        sample_preds = predict_fraud(df_feats.head(10))
        print("Sample fraud predictions:")
        print(sample_preds)
