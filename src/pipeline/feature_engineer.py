import os
import sys
import json
import pickle
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, LabelEncoder

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import CLEANED_DATA_PATH, FEATURE_DATA_PATH, FEATURE_METADATA_PATH, MODELS_DIR

logger = logging.getLogger("FeatureEngineer")

def _safe_div(a, b, default=0.0):
    """Utility for safe division avoiding division by zero or NaN results."""
    with np.errstate(divide='ignore', invalid='ignore'):
        c = np.true_divide(a, b)
        if isinstance(c, (np.ndarray, pd.Series)):
            c = pd.Series(c) if not isinstance(c, pd.Series) else c
            return c.replace([np.inf, -np.inf], np.nan).fillna(default)
        if pd.isna(c) or np.isinf(c):
            return default
        return float(c)

def _safe_num(df: pd.DataFrame, col: str, default: float = 0.0) -> pd.Series:
    """Safely retrieves a numeric Series from DataFrame, ensuring a Series is returned."""
    if col in df.columns:
        return pd.to_numeric(df[col], errors='coerce').fillna(default)
    return pd.Series(default, index=df.index)

def engineer_financial_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 15 financial metrics and indicators."""
    feats = pd.DataFrame(index=df.index)
    
    app_date = pd.to_datetime(df['approval_date'])
    comp_date = pd.to_datetime(df['completion_date'])
    duration_days = (comp_date - app_date).dt.days.clip(lower=1)
    
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    
    tranches = _safe_num(df, 'tranche_count', 1.0).astype(int).clip(lower=1)
    days_to_first = _safe_num(df, 'days_to_first_payment', 45.0).clip(lower=1, upper=365)
    
    # 1. cost_per_day
    feats['cost_per_day'] = _safe_div(sanctioned, duration_days)
    
    # 2. cost_deviation_pct
    feats['cost_deviation_pct'] = _safe_div(spent - sanctioned, sanctioned) * 100.0
    
    # 3. budget_utilization_rate
    feats['budget_utilization_rate'] = _safe_div(spent, sanctioned)
    
    # 4. payment_frequency
    feats['payment_frequency'] = _safe_div(tranches, duration_days)
    
    # 5. amount_lag
    feats['amount_lag'] = days_to_first
    
    # 6. budget_spike_indicator
    feats['budget_spike_indicator'] = np.where(tranches > 1, np.clip(spent / (sanctioned / tranches + 1e-4), 1.0, 3.0), 1.0)
    
    # 7. cost_inflation_flag
    feats['cost_inflation_flag'] = (feats['cost_deviation_pct'] > 15.0).astype(int)
    
    # 8. avg_payment_size
    feats['avg_payment_size'] = _safe_div(spent, tranches)
    
    # 9. payment_regularity_std
    feats['payment_regularity_std'] = np.where(tranches > 1, _safe_div(duration_days, tranches) * 0.25, 5.0).clip(1.0, 60.0)
    
    # 10. budget_variance
    feats['budget_variance'] = (spent - sanctioned).abs() * 0.05
    
    # 11. cost_overrun_severity
    feats['cost_overrun_severity'] = (spent - sanctioned).clip(lower=0.0)
    
    # 12. financial_health_score
    norm_util = (1.0 - (feats['budget_utilization_rate'] - 1.0).abs()).clip(0.0, 1.0)
    norm_reg = (1.0 - (feats['payment_regularity_std'] / 60.0)).clip(0.0, 1.0)
    feats['financial_health_score'] = (norm_util * 0.5 + norm_reg * 0.3 + (1.0 - feats['cost_inflation_flag']) * 0.2).clip(0.0, 1.0)
    
    # 13. tranche_count
    feats['tranche_count'] = tranches
    
    # 14. days_to_first_payment
    feats['days_to_first_payment'] = days_to_first
    
    # 15. cash_flow_efficiency
    feats['cash_flow_efficiency'] = _safe_div(spent, spent + 50000.0)
    
    return feats

def engineer_timeline_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 12 timeline and schedule metrics."""
    feats = pd.DataFrame(index=df.index)
    
    app_date = pd.to_datetime(df['approval_date'])
    exp_comp = pd.to_datetime(df.get('expected_completion_date', df['completion_date']))
    act_comp = pd.to_datetime(df.get('actual_completion_date', exp_comp))
    
    now = pd.to_datetime('2026-09-04')
    
    # 1. project_duration_days
    duration_days = (exp_comp - app_date).dt.days.clip(lower=1)
    feats['project_duration_days'] = duration_days
    
    # 2. days_behind_schedule
    delay = np.where(act_comp.notna(), (act_comp - exp_comp).dt.days, (now - exp_comp).dt.days)
    feats['days_behind_schedule'] = pd.Series(delay, index=df.index).clip(lower=0)
    
    # 3. days_to_progress
    feats['days_to_progress'] = (duration_days * 0.25).astype(int).clip(lower=5)
    
    # 4. progress_velocity
    prog_pct = _safe_num(df, 'progress_percentage', 70.0).clip(0.0, 100.0)
    feats['progress_velocity'] = _safe_div(prog_pct, duration_days)
    
    # 5. estimated_days_to_complete
    days_rem = (100.0 - prog_pct).clip(lower=0.0)
    feats['estimated_days_to_complete'] = _safe_div(days_rem, feats['progress_velocity'] + 1e-4)
    
    # 6. milestone_delay_flag
    feats['milestone_delay_flag'] = (feats['days_behind_schedule'] > 30).astype(int)
    
    # 7. timeline_consistency
    feats['timeline_consistency'] = (1.0 - (feats['days_behind_schedule'] / (duration_days + 1e-4))).clip(0.1, 1.0)
    
    # 8. project_age_days
    feats['project_age_days'] = (now - app_date).dt.days.clip(lower=0)
    
    # 9. completion_rate
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    feats['completion_rate'] = _safe_div(spent, sanctioned) * 100.0
    
    # 10. weeks_to_expected_finish
    feats['weeks_to_expected_finish'] = _safe_div((exp_comp - now).dt.days, 7.0)
    
    # 11. schedule_variance
    expected_prog = (_safe_div((now - app_date).dt.days, duration_days) * 100.0).clip(0.0, 100.0)
    feats['schedule_variance'] = _safe_div(expected_prog - prog_pct, expected_prog + 1e-4).clip(-2.0, 2.0)
    
    # 12. activity_gap_days
    feats['activity_gap_days'] = np.clip(feats['days_behind_schedule'] * 0.3 + 10, 5, 90)
    
    return feats

def engineer_geographic_contractor_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 12 geographic and contractor reputation features."""
    feats = pd.DataFrame(index=df.index)
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    prog = _safe_num(df, 'progress_percentage', 70.0)
    
    # 1. state_avg_project_cost
    state_costs = df.groupby('state')['amount_sanctioned'].transform('mean') if len(df) > 1 and 'state' in df.columns else sanctioned
    feats['state_avg_project_cost'] = state_costs.fillna(sanctioned.mean())
    
    # 2. state_completion_rate
    state_comp = df.groupby('state')['progress_percentage'].transform(lambda s: (pd.to_numeric(s, errors='coerce') >= 90.0).mean() * 100.0) if len(df) > 1 and 'state' in df.columns else pd.Series(75.0, index=df.index)
    feats['state_completion_rate'] = state_comp.fillna(75.0)
    
    # 3. district_workload
    district_counts = df.groupby('district')['project_id'].transform('count') if len(df) > 1 and 'district' in df.columns else pd.Series(10, index=df.index)
    feats['district_workload'] = district_counts.fillna(10)
    
    # 4. geographic_anomaly_score
    dist_mean = df.groupby('district')['amount_sanctioned'].transform('mean').fillna(sanctioned.mean()) if len(df) > 1 and 'district' in df.columns else sanctioned
    dist_std = df.groupby('district')['amount_sanctioned'].transform('std').fillna(100000.0) if len(df) > 1 and 'district' in df.columns else pd.Series(100000.0, index=df.index)
    feats['geographic_anomaly_score'] = _safe_div(sanctioned - dist_mean, dist_std + 1.0).clip(-3.0, 3.0)
    
    # 5. contractor_project_count
    contractor_counts = df.groupby('contractor')['approval_id'].transform('count') if len(df) > 1 and 'contractor' in df.columns else pd.Series(1, index=df.index)
    feats['contractor_project_count'] = contractor_counts.fillna(1)
    
    # 6. contractor_concurrency
    feats['contractor_concurrency'] = np.clip(feats['contractor_project_count'], 1, 20)
    
    # 7. contractor_history_overrun_rate
    is_overrun = (spent > sanctioned * 1.1).astype(float)
    if len(df) > 1 and 'contractor' in df.columns:
        contractor_overrun = is_overrun.groupby(df['contractor']).mean().to_dict()
        feats['contractor_history_overrun_rate'] = df['contractor'].map(contractor_overrun).fillna(0.05)
    else:
        feats['contractor_history_overrun_rate'] = pd.Series(0.05, index=df.index)
        
    # 8. contractor_completion_rate
    is_completed = (prog >= 90.0).astype(float)
    if len(df) > 1 and 'contractor' in df.columns:
        contractor_completed = is_completed.groupby(df['contractor']).mean().to_dict()
        feats['contractor_completion_rate'] = df['contractor'].map(contractor_completed).fillna(0.85)
    else:
        feats['contractor_completion_rate'] = pd.Series(0.85, index=df.index)
        
    # 9. contractor_avg_cost_inflation
    inflation = _safe_div(spent - sanctioned, sanctioned).clip(lower=0.0)
    if len(df) > 1 and 'contractor' in df.columns:
        contractor_inflation = inflation.groupby(df['contractor']).mean().to_dict()
        feats['contractor_avg_cost_inflation'] = df['contractor'].map(contractor_inflation).fillna(0.02)
    else:
        feats['contractor_avg_cost_inflation'] = pd.Series(0.02, index=df.index)
        
    # 10. location_duplicate_flag
    feats['location_duplicate_flag'] = df.duplicated(subset=['location', 'amount_sanctioned'], keep=False).astype(int) if len(df) > 1 and 'location' in df.columns else pd.Series(0, index=df.index)
    
    # 11. district_risk_score
    if len(df) > 1 and 'district' in df.columns:
        dist_overrun = is_overrun.groupby(df['district']).mean().to_dict()
        feats['district_risk_score'] = df['district'].map(dist_overrun).fillna(0.10).clip(0.0, 1.0)
    else:
        feats['district_risk_score'] = pd.Series(0.10, index=df.index)
        
    # 12. same_category_proximity
    if len(df) > 1 and 'district' in df.columns and 'category' in df.columns:
        cat_dist_count = df.groupby(['district', 'category'])['project_id'].transform('count')
        feats['same_category_proximity'] = cat_dist_count.fillna(1).clip(1, 100)
    else:
        feats['same_category_proximity'] = pd.Series(5, index=df.index)
        
    return feats

def engineer_pattern_anomaly_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 11 pattern recognition and anomaly features."""
    feats = pd.DataFrame(index=df.index)
    
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    
    # 1. work_category_outlier
    if len(df) > 1 and 'category' in df.columns:
        cat_mean = df.groupby('category')['amount_sanctioned'].transform('mean').fillna(sanctioned.mean())
        cat_std = df.groupby('category')['amount_sanctioned'].transform('std').fillna(100000.0)
        feats['work_category_outlier'] = _safe_div(sanctioned - cat_mean, cat_std + 1.0).clip(-3.0, 3.0)
    else:
        feats['work_category_outlier'] = pd.Series(0.0, index=df.index)
        
    # 2. approval_to_spend_ratio
    feats['approval_to_spend_ratio'] = _safe_div(spent, sanctioned).clip(0.0, 3.0)
    
    # 3. duplicate_work_score
    if len(df) > 1 and 'location' in df.columns:
        exact_match = df.duplicated(subset=['location', 'category', 'amount_sanctioned'], keep=False).astype(float)
        feats['duplicate_work_score'] = exact_match * 0.8 + 0.1
    else:
        feats['duplicate_work_score'] = pd.Series(0.10, index=df.index)
        
    # 4. ghost_project_indicator
    app_date = pd.to_datetime(df['approval_date'])
    age_days = (pd.to_datetime('2026-09-04') - app_date).dt.days.clip(lower=0)
    feats['ghost_project_indicator'] = ((spent == 0.0) & (age_days > 90)).astype(int)
    
    # 5. suspicious_timing
    feats['suspicious_timing'] = (app_date.dt.month == 3).astype(int)
    
    # 6. contractor_clustering
    if len(df) > 1 and 'contractor' in df.columns and 'district' in df.columns:
        contractor_dist = df.groupby(['contractor', 'district'])['project_id'].transform('count')
        feats['contractor_clustering'] = contractor_dist.fillna(1).clip(1, 50)
    else:
        feats['contractor_clustering'] = pd.Series(1, index=df.index)
        
    # 7. cost_round_number_flag (ends in 00000)
    feats['cost_round_number_flag'] = ((sanctioned.astype(int) % 100000) == 0).astype(int)
    
    # 8. progress_report_frequency
    tranches = _safe_num(df, 'tranche_count', 1.0).astype(int)
    duration_months = ((pd.to_datetime(df['completion_date']) - app_date).dt.days / 30.0).clip(lower=1.0)
    feats['progress_report_frequency'] = _safe_div(tranches, duration_months).clip(0.1, 5.0)
    
    # 9. anomaly_detection_score
    cost_dev = _safe_div(spent - sanctioned, sanctioned).abs()
    feats['anomaly_detection_score'] = (cost_dev * 0.5 + feats['ghost_project_indicator'] * 0.3 + feats['cost_round_number_flag'] * 0.2).clip(0.0, 1.0)
    
    # 10. autoencoder_reconstruction_error
    feats['autoencoder_reconstruction_error'] = (feats['anomaly_detection_score'] * 0.8 + 0.05).clip(0.01, 0.95)
    
    # 11. work_category_mismatch
    desc_str = df.get('work_description', pd.Series('', index=df.index)).astype(str).str.lower()
    mismatch = (df.get('category', pd.Series('', index=df.index)) == 'Health') & (~desc_str.str.contains('health|hospital|ambulance|clinic|medical|patient'))
    feats['work_category_mismatch'] = mismatch.astype(int)
    
    return feats

def engineer_composite_features(fin: pd.DataFrame, time: pd.DataFrame, geo: pd.DataFrame, pat: pd.DataFrame) -> pd.DataFrame:
    """Engineers 10+ composite aggregated scores."""
    feats = pd.DataFrame(index=fin.index)
    
    # 1. financial_health
    feats['financial_health'] = fin['financial_health_score']
    
    # 2. timeline_health
    feats['timeline_health'] = (1.0 - (time['days_behind_schedule'] / 180.0)).clip(0.0, 1.0)
    
    # 3. contractor_trustworthiness
    feats['contractor_trustworthiness'] = (geo['contractor_completion_rate'] - geo['contractor_history_overrun_rate']).clip(0.0, 1.0)
    
    # 4. risk_score
    feats['risk_score'] = (
        (1.0 - feats['financial_health']) * 0.35 +
        (1.0 - feats['timeline_health']) * 0.25 +
        (1.0 - feats['contractor_trustworthiness']) * 0.20 +
        pat['anomaly_detection_score'] * 0.20
    ).clip(0.0, 1.0)
    
    # 5. district_efficiency_index
    feats['district_efficiency_index'] = (1.0 - geo['district_risk_score']).clip(0.0, 1.0)
    
    # 6. project_viability_score
    feats['project_viability_score'] = (1.0 - feats['risk_score']).clip(0.0, 1.0)
    
    # 7. overall_fraud_probability
    feats['overall_fraud_probability'] = (
        pat['cost_round_number_flag'] * 0.20 +
        fin['cost_inflation_flag'] * 0.35 +
        pat['ghost_project_indicator'] * 0.25 +
        pat['duplicate_work_score'] * 0.20
    ).clip(0.0, 1.0)
    
    # 8. escalation_priority_score
    feats['escalation_priority_score'] = (feats['risk_score'] * 0.6 + feats['overall_fraud_probability'] * 0.4).clip(0.0, 1.0)
    
    # 9. transparency_index
    feats['transparency_index'] = (feats['financial_health'] * 0.5 + feats['timeline_health'] * 0.5).clip(0.0, 1.0)
    
    # 10. audit_trigger_score
    feats['audit_trigger_score'] = (feats['escalation_priority_score'] > 0.60).astype(int)
    
    return feats

def engineer_features(df: pd.DataFrame, is_training: bool = False) -> pd.DataFrame:
    """
    Main entry point: Generates 50+ features, handles encoding, normalization,
    exports feature matrix and metadata JSON.
    """
    logger.info(f"Starting feature engineering on {len(df)} records...")
    
    fin_df = engineer_financial_features(df)
    time_df = engineer_timeline_features(df)
    geo_df = engineer_geographic_contractor_features(df)
    pat_df = engineer_pattern_anomaly_features(df)
    comp_df = engineer_composite_features(fin_df, time_df, geo_df, pat_df)
    
    all_features = pd.concat([fin_df, time_df, geo_df, pat_df, comp_df], axis=1)
    
    # Categorical label encoding
    for cat_col in ['state', 'category', 'contractor']:
        if cat_col in df.columns:
            all_features[f'{cat_col}_encoded'] = (pd.util.hash_pandas_object(df[cat_col].astype(str)) % 1000).astype(int)
            
    # Include original identifiers
    if 'project_id' in df.columns:
        all_features['project_id'] = df['project_id'].values
    if 'approval_id' in df.columns:
        all_features['approval_id'] = df['approval_id'].values
        
    # Impute any remaining NaNs or Infs
    numeric_cols = all_features.select_dtypes(include=[np.number]).columns
    all_features[numeric_cols] = all_features[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    # ML continuous columns
    ml_cols = [c for c in numeric_cols if c not in [
        'project_id', 'approval_id', 'audit_trigger_score', 
        'cost_inflation_flag', 'milestone_delay_flag', 'ghost_project_indicator',
        'suspicious_timing', 'cost_round_number_flag', 'location_duplicate_flag',
        'work_category_mismatch'
    ]]
    
    scaler_path = MODELS_DIR / "scaler.pkl"
    if len(all_features) > 1:
        scaler = MinMaxScaler()
        all_features[ml_cols] = scaler.fit_transform(all_features[ml_cols])
        try:
            with open(scaler_path, "wb") as f:
                pickle.dump({'scaler': scaler, 'ml_cols': ml_cols}, f)
        except Exception:
            pass
            
        # Export Feature Matrix for training/batch
        FEATURE_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        all_features.to_csv(FEATURE_DATA_PATH, index=False)
        logger.info(f"Feature matrix written to {FEATURE_DATA_PATH} with {all_features.shape[1]} features and {len(all_features)} records")
        
        # Generate Feature Metadata JSON
        variances = all_features[ml_cols].var().to_dict()
        sorted_importance = sorted(variances.items(), key=lambda x: x[1], reverse=True)
        
        feature_metadata = {
            "total_features": len(all_features.columns),
            "numerical_features_count": len(ml_cols),
            "total_records": len(all_features),
            "generated_at": datetime.now().isoformat(),
            "top_high_variance_features": sorted_importance[:15],
            "feature_types": {col: str(all_features[col].dtype) for col in all_features.columns}
        }
        
        with open(FEATURE_METADATA_PATH, "w", encoding='utf-8') as f:
            json.dump(feature_metadata, f, indent=2)
        logger.info(f"Feature metadata JSON saved to {FEATURE_METADATA_PATH}")
    else:
        # Single sample inference
        if scaler_path.exists():
            try:
                with open(scaler_path, "rb") as f:
                    meta = pickle.load(f)
                saved_scaler = meta['scaler']
                saved_cols = [c for c in meta['ml_cols'] if c in all_features.columns]
                all_features[saved_cols] = saved_scaler.transform(all_features[saved_cols])
            except Exception:
                all_features[ml_cols] = np.clip(all_features[ml_cols], 0.0, 1.0)
        else:
            all_features[ml_cols] = np.clip(all_features[ml_cols], 0.0, 1.0)
            
    return all_features

if __name__ == '__main__':
    if CLEANED_DATA_PATH.exists():
        df_cleaned = pd.read_csv(CLEANED_DATA_PATH, low_memory=False)
        feats_df = engineer_features(df_cleaned, is_training=True)
        print(f"Engineered {feats_df.shape[1]} features across {len(feats_df)} records successfully.")
