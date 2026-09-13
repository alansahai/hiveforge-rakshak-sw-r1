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
    Trains regression model on strictly pre-execution features to predict expected project duration (days).
    Saves model artifacts, efficiency benchmarks, and diagnostic plot.
    """
    logger.info("Starting Efficiency Analyzer training with pre-execution features...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    target_col = 'project_duration_days'
    
    # Strictly early-stage / pre-execution features (NO target leakage!)
    candidate_features = [
        'amount_sanctioned',
        'state_avg_project_cost',
        'state_completion_rate',
        'district_workload',
        'geographic_anomaly_score',
        'contractor_project_count',
        'contractor_concurrency',
        'contractor_completion_rate',
        'contractor_history_overrun_rate',
        'same_category_proximity',
        'tranche_count',
        'days_to_first_payment',
        'state_encoded',
        'category_encoded',
        'contractor_encoded'
    ]
    feature_cols = [c for c in candidate_features if c in df_features.columns]
    if len(feature_cols) < 5:
        exclude_cols = [
            'project_id', 'approval_id', target_col, 'actual_duration_days', 'planned_duration_days',
            'days_behind_schedule', 'progress_velocity', 'estimated_days_to_complete',
            'milestone_delay_flag', 'timeline_consistency', 'weeks_to_expected_finish',
            'schedule_variance', 'activity_gap_days', 'timeline_health', 'risk_score',
            'overall_fraud_probability', 'audit_trigger_score', 'escalation_priority_score'
        ]
        feature_cols = [
            c for c in df_features.columns 
            if c not in exclude_cols and pd.api.types.is_numeric_dtype(df_features[c])
        ]
    
    if target_col not in df_features.columns:
        df_features = df_features.copy()
        df_features[target_col] = df_features.get('planned_duration_days', pd.Series(300.0, index=df_features.index)).fillna(300.0)

    # Filter training data for valid physical project duration (30 to 950 days)
    valid_mask = (df_features[target_col].notna()) & (df_features[target_col] >= 30) & (df_features[target_col] <= 950)
    df_train = df_features[valid_mask] if valid_mask.sum() >= 30 else df_features
    
    X = df_train[feature_cols].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    y = df_train[target_col].values.astype(np.float32)
    y = np.clip(np.nan_to_num(y, nan=240.0), 30.0, 950.0)
    
    p99_dur = float(np.percentile(y, 99))
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    
    logger.info(f"Fitting GradientBoostingRegressor on {len(X_train)} projects with unscaled target (mean={y.mean():.1f}d, std={y.std():.1f}d)...")
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.08,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    y_pred = np.clip(model.predict(X_test), 30.0, p99_dur)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae = float(np.mean(np.abs(y_test - y_pred)))
    r2 = float(r2_score(y_test, y_pred))
    
    residuals = y_test - y_pred
    res_mean = float(np.mean(residuals))
    res_std = float(np.std(residuals))
    
    logger.info(f"Efficiency Regressor Test Metrics: RMSE={rmse:.2f} days, MAE={mae:.2f} days, R2={r2:.4f}, Residual Std={res_std:.2f}")
    
    model_payload = {
        'model': model,
        'features': feature_cols,
        'target_col': target_col,
        'residual_mean': res_mean,
        'residual_std': res_std,
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'p99_duration': p99_dur,
        'feature_importances': dict(zip(feature_cols, model.feature_importances_.tolist()))
    }
    
    model_path1 = output_dir / "efficiency_analyzer.pkl"
    model_path2 = output_dir / "efficiency_regressor.pkl"
    with open(model_path1, "wb") as f:
        pickle.dump(model_payload, f)
    with open(model_path2, "wb") as f:
        pickle.dump(model_payload, f)
    logger.info(f"Saved corrected Efficiency Analyzer to {model_path1} and {model_path2}")
    
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
        'mae': mae,
        'r2': r2,
        'residual_std': res_std
    }

def analyze_efficiency(df_features: pd.DataFrame, models_dir: Path = MODELS_DIR) -> pd.DataFrame:
    """
    Predicts expected project duration, computes multi-factor timeline efficiency score,
    and categorizes schedule adherence into ON_TRACK, WATCH, DELAYED, or SEVERELY_DELAYED.
    """
    model_path = models_dir / "efficiency_analyzer.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Trained efficiency analyzer model not found.")
        
    with open(model_path, "rb") as f:
        payload = pickle.load(f)
        
    model = payload['model']
    features = payload['features']
    res_std = payload.get('residual_std', 30.0)
    p99_dur = payload.get('p99_duration', 730.0)
    
    # Ensure all required features are present
    X_df = pd.DataFrame(index=df_features.index)
    for col in features:
        if col in df_features.columns:
            X_df[col] = df_features[col]
        else:
            X_df[col] = 0.0
            
    X = X_df[features].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)
    
    # Enforce physical bounds based on training distribution
    predicted_duration = np.clip(model.predict(X), 30.0, p99_dur)
    
    planned_series = pd.Series(df_features.get(
        'planned_duration_days', 
        df_features.get('project_duration_days', predicted_duration)
    )).fillna(240.0)
    planned_duration = np.maximum(pd.to_numeric(planned_series, errors='coerce').fillna(240.0).values, 30.0)
    
    days_behind = pd.to_numeric(df_features.get('days_behind_schedule', pd.Series(0.0, index=df_features.index)), errors='coerce').fillna(0.0).values
    days_behind = np.maximum(0.0, days_behind)
    prog_pct = pd.to_numeric(df_features.get('progress_percentage', pd.Series(80.0, index=df_features.index)), errors='coerce').fillna(80.0).values
    spend_variance = pd.to_numeric(df_features.get('cost_deviation_pct', pd.Series(0.0, index=df_features.index)), errors='coerce').fillna(0.0).values
    
    # Multi-Factor Timeline Health Scoring:
    # 1. Milestone delay penalty (delay beyond 15-day tolerance)
    delay_ratio = np.clip(np.maximum(0.0, days_behind - 15.0) / planned_duration, 0.0, 1.0)
    delay_penalty = delay_ratio * 0.60
    
    # 2. Progress shortfall penalty (exempt if essentially complete >= 90%)
    shortfall_penalty = np.where(prog_pct >= 90.0, 0.0, np.clip((85.0 - prog_pct) / 100.0 * 0.25, 0.0, 0.25))
    
    # 3. Expenditure overrun pacing penalty
    overrun_penalty = np.clip(np.maximum(0.0, spend_variance - 15.0) / 100.0 * 0.20, 0.0, 0.20)
    
    total_penalty = delay_penalty + shortfall_penalty + overrun_penalty
    efficiency_score = np.clip(1.0 - total_penalty, 0.05, 1.0)
    
    # Timeline Risk Flags & Categorization
    timeline_status = []
    root_causes = []
    
    concurrency = df_features.get('contractor_concurrency', pd.Series(1, index=df_features.index)).values
    amount_lag = df_features.get('amount_lag', pd.Series(30, index=df_features.index)).values
    
    for i in range(len(df_features)):
        d = days_behind[i]
        s = efficiency_score[i]
        
        if d <= 15 and s >= 0.80:
            timeline_status.append("ON_TRACK")
        elif d <= 45 or s >= 0.65:
            timeline_status.append("WATCH")
        elif d <= 90 or s >= 0.40:
            timeline_status.append("DELAYED")
        else:
            timeline_status.append("SEVERELY_DELAYED")
            
        causes = []
        if d > 15:
            causes.append(f"Work milestone delay ({int(d)} days behind schedule)")
        if concurrency[i] >= 5:
            causes.append(f"High contractor workload ({int(concurrency[i])} concurrent projects)")
        if amount_lag[i] > 60:
            causes.append(f"Substantial fund release delay ({int(amount_lag[i])} days to initial payment)")
        if spend_variance[i] > 15.0:
            causes.append(f"Expenditure variation exceeding sanction (+{spend_variance[i]:.1f}%)")
        if not causes:
            causes.append("Standard timeline execution with nominal milestone adherence")
        root_causes.append("; ".join(causes))
        
    res = pd.DataFrame(index=df_features.index)
    res['predicted_duration_days'] = predicted_duration.round(1)
    res['actual_duration_days'] = planned_duration.round(1)
    res['efficiency_score'] = efficiency_score.round(4)
    res['days_behind_schedule'] = np.maximum(0, days_behind.astype(int))
    res['timeline_status'] = timeline_status
    res['timeline_risk_flag'] = [s in ("DELAYED", "SEVERELY_DELAYED") for s in timeline_status]
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
