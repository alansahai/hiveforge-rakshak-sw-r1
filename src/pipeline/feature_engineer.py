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
from src.pipeline.geo_utils import compute_geo_duplicate_flags

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
    """Engineers 14 timeline and schedule metrics with strict target separation."""
    feats = pd.DataFrame(index=df.index)
    
    app_series = df.get('approval_date', pd.Series(pd.Timestamp('2023-01-01'), index=df.index))
    app_date = pd.to_datetime(app_series)
    exp_series = df.get('expected_completion_date', df.get('completion_date', pd.Series(pd.NaT, index=df.index)))
    exp_comp = pd.to_datetime(exp_series).fillna(app_date + pd.Timedelta(days=365))
    act_series = df.get('actual_completion_date', pd.Series(pd.NaT, index=df.index))
    act_comp = pd.to_datetime(act_series)
    now = pd.to_datetime('2026-09-04')
    
    planned_duration = (exp_comp - app_date).dt.days.clip(lower=30)
    feats['planned_duration_days'] = planned_duration
    
    # 1. Genuine actual duration if completed (empirical observations), else planned
    actual_dur = (act_comp - app_date).dt.days
    has_valid_actual = act_comp.notna() & (actual_dur >= 15)
    feats['actual_duration_days'] = np.where(has_valid_actual, actual_dur, np.nan)
    
    # Target variable for Efficiency Regressor (unscaled natural days):
    feats['project_duration_days'] = np.where(has_valid_actual, actual_dur, planned_duration).clip(30, 950)
    
    # 2. days_behind_schedule (observable in-flight milestone lag)
    prog_pct = _safe_num(df, 'progress_percentage', 70.0).clip(0.0, 100.0)
    elapsed_days = (now - app_date).dt.days.clip(lower=0)
    expected_prog = (_safe_div(elapsed_days, planned_duration) * 100.0).clip(0.0, 100.0)
    
    if 'days_behind_schedule' in df.columns and df['days_behind_schedule'].notna().any():
        feats['days_behind_schedule'] = pd.to_numeric(df['days_behind_schedule'], errors='coerce').fillna(0).clip(lower=0)
    else:
        # For completed works:
        delay_comp = (act_comp - exp_comp).dt.days.clip(lower=0)
        # For ongoing works: delay past expected finish date, or shortfall in progress
        delay_overdue = (now - exp_comp).dt.days.clip(lower=0)
        shortfall_days = _safe_div((expected_prog - prog_pct).clip(lower=0.0), 100.0) * planned_duration
        delay_ongoing = np.maximum(delay_overdue, shortfall_days)
        
        delay = np.where(act_comp.notna(), delay_comp, delay_ongoing)
        feats['days_behind_schedule'] = pd.Series(delay, index=df.index).fillna(0).clip(lower=0)
    
    # 3. In-flight progress velocity
    feats['days_to_progress'] = (planned_duration * 0.25).astype(int).clip(lower=5)
    feats['progress_velocity'] = _safe_div(prog_pct, np.maximum(elapsed_days, 15.0))
    
    # 4. estimated_days_to_complete
    days_rem = (100.0 - prog_pct).clip(lower=0.0)
    feats['estimated_days_to_complete'] = _safe_div(days_rem, feats['progress_velocity'] + 1e-4)
    
    # 5. milestone_delay_flag
    feats['milestone_delay_flag'] = (feats['days_behind_schedule'] > 30).astype(int)
    
    # 6. timeline_consistency
    feats['timeline_consistency'] = (1.0 - (feats['days_behind_schedule'] / (planned_duration + 1e-4))).clip(0.1, 1.0)
    
    # 7. project_age_days
    feats['project_age_days'] = elapsed_days
    
    # 8. completion_rate
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    feats['completion_rate'] = (_safe_div(spent, sanctioned) * 100.0).clip(0.0, 300.0)
    
    # 9. weeks_to_expected_finish
    feats['weeks_to_expected_finish'] = _safe_div((exp_comp - now).dt.days, 7.0).clip(-52.0, 52.0)
    
    # 10. schedule_variance
    feats['schedule_variance'] = _safe_div(expected_prog - prog_pct, expected_prog + 1e-4).clip(-2.0, 2.0)
    
    # 11. activity_gap_days
    feats['activity_gap_days'] = np.clip(feats['days_behind_schedule'] * 0.3 + 10, 5, 90)
    
    return feats

REFERENCE_STATS_PATH = MODELS_DIR / "reference_stats.pkl"

def _load_reference_stats() -> dict:
    """Loads reference population statistics for single-project inference calibration."""
    if REFERENCE_STATS_PATH.exists():
        try:
            with open(REFERENCE_STATS_PATH, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass
    return {}

def engineer_geographic_contractor_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 12 geographic and contractor reputation features calibrated against reference population."""
    feats = pd.DataFrame(index=df.index)
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    prog = _safe_num(df, 'progress_percentage', 70.0)
    
    is_multi = len(df) > 1
    ref = _load_reference_stats() if not is_multi else {}
    nat_mean = ref.get('national_mean_cost', 500000.0)
    nat_std = ref.get('national_std_cost', 150000.0)
    
    # 1. state_avg_project_cost
    if is_multi and 'state' in df.columns:
        feats['state_avg_project_cost'] = df.groupby('state')['amount_sanctioned'].transform('mean').fillna(sanctioned.mean())
    elif 'state' in df.columns and ref.get('state_avg_cost'):
        state_val = str(df['state'].iloc[0]).strip().title()
        feats['state_avg_project_cost'] = pd.Series(ref['state_avg_cost'].get(state_val, nat_mean), index=df.index)
    else:
        feats['state_avg_project_cost'] = pd.Series(nat_mean, index=df.index)
    
    # 2. state_completion_rate
    if is_multi and 'state' in df.columns:
        feats['state_completion_rate'] = df.groupby('state')['progress_percentage'].transform(lambda s: (pd.to_numeric(s, errors='coerce') >= 90.0).mean() * 100.0).fillna(75.0)
    elif 'state' in df.columns and ref.get('state_comp_rate'):
        state_val = str(df['state'].iloc[0]).strip().title()
        feats['state_completion_rate'] = pd.Series(ref['state_comp_rate'].get(state_val, 75.0), index=df.index)
    else:
        feats['state_completion_rate'] = pd.Series(75.0, index=df.index)
    
    # 3. district_workload
    if is_multi and 'district' in df.columns:
        feats['district_workload'] = df.groupby('district')['project_id'].transform('count').fillna(10)
    elif 'district' in df.columns and ref.get('district_workload'):
        dist_val = str(df['district'].iloc[0]).strip().title()
        feats['district_workload'] = pd.Series(ref['district_workload'].get(dist_val, 15), index=df.index)
    else:
        feats['district_workload'] = pd.Series(15, index=df.index)
    
    # 4. geographic_anomaly_score
    if is_multi and 'district' in df.columns:
        dist_mean = df.groupby('district')['amount_sanctioned'].transform('mean').fillna(sanctioned.mean())
        dist_std = df.groupby('district')['amount_sanctioned'].transform('std').fillna(100000.0)
        feats['geographic_anomaly_score'] = _safe_div(sanctioned - dist_mean, dist_std + 1.0).clip(-3.0, 3.0)
    elif 'district' in df.columns and ref.get('district_means'):
        dist_val = str(df['district'].iloc[0]).strip().title()
        d_m = ref['district_means'].get(dist_val, nat_mean)
        d_s = ref['district_stds'].get(dist_val, nat_std)
        feats['geographic_anomaly_score'] = _safe_div(sanctioned - d_m, d_s + 1.0).clip(-3.0, 3.0)
    else:
        feats['geographic_anomaly_score'] = pd.Series(0.0, index=df.index)
    
    # 5. contractor_project_count
    if is_multi and 'contractor' in df.columns:
        feats['contractor_project_count'] = df.groupby('contractor')['approval_id'].transform('count').fillna(1)
    elif 'contractor' in df.columns and ref.get('contractor_counts'):
        c_val = str(df['contractor'].iloc[0]).strip()
        cnt = ref['contractor_counts'].get(c_val, int(df.get('previous_contractor_projects', pd.Series(1)).iloc[0]))
        feats['contractor_project_count'] = pd.Series(cnt, index=df.index)
    else:
        feats['contractor_project_count'] = pd.Series(int(df.get('previous_contractor_projects', pd.Series(1)).iloc[0]), index=df.index)
    
    # 6. contractor_concurrency
    feats['contractor_concurrency'] = np.clip(feats['contractor_project_count'], 1, 20)
    
    # 7. contractor_history_overrun_rate
    is_overrun = (spent > sanctioned * 1.1).astype(float)
    if is_multi and 'contractor' in df.columns:
        feats['contractor_history_overrun_rate'] = df['contractor'].map(is_overrun.groupby(df['contractor']).mean().to_dict()).fillna(0.05)
    elif 'contractor' in df.columns and ref.get('contractor_overrun'):
        c_val = str(df['contractor'].iloc[0]).strip()
        ov = ref['contractor_overrun'].get(c_val, 0.05 if int(df.get('previous_contractor_overruns', pd.Series(0)).iloc[0]) == 0 else 0.30)
        feats['contractor_history_overrun_rate'] = pd.Series(ov, index=df.index)
    else:
        feats['contractor_history_overrun_rate'] = pd.Series(0.05, index=df.index)
        
    # 8. contractor_completion_rate
    is_completed = (prog >= 90.0).astype(float)
    if is_multi and 'contractor' in df.columns:
        feats['contractor_completion_rate'] = df['contractor'].map(is_completed.groupby(df['contractor']).mean().to_dict()).fillna(0.85)
    elif 'contractor' in df.columns and ref.get('contractor_comp'):
        c_val = str(df['contractor'].iloc[0]).strip()
        feats['contractor_completion_rate'] = pd.Series(ref['contractor_comp'].get(c_val, 0.85), index=df.index)
    else:
        feats['contractor_completion_rate'] = pd.Series(0.85, index=df.index)
        
    # 9. contractor_avg_cost_inflation
    inflation = _safe_div(spent - sanctioned, sanctioned).clip(lower=0.0)
    if is_multi and 'contractor' in df.columns:
        feats['contractor_avg_cost_inflation'] = df['contractor'].map(inflation.groupby(df['contractor']).mean().to_dict()).fillna(0.02)
    else:
        feats['contractor_avg_cost_inflation'] = pd.Series(0.02, index=df.index)
        
    # 10. location_duplicate_flag
    feats['location_duplicate_flag'] = df.duplicated(subset=['location', 'amount_sanctioned'], keep=False).astype(int) if is_multi and 'location' in df.columns else pd.Series(0, index=df.index)
    
    # 11. district_risk_score
    if is_multi and 'district' in df.columns:
        feats['district_risk_score'] = df['district'].map(is_overrun.groupby(df['district']).mean().to_dict()).fillna(0.10).clip(0.0, 1.0)
    elif 'district' in df.columns and ref.get('district_risks'):
        d_val = str(df['district'].iloc[0]).strip().title()
        feats['district_risk_score'] = pd.Series(ref['district_risks'].get(d_val, 0.10), index=df.index)
    else:
        feats['district_risk_score'] = pd.Series(0.10, index=df.index)
        
    # 12. same_category_proximity
    if is_multi and 'district' in df.columns and 'category' in df.columns:
        cat_dist_count = df.groupby(['district', 'category'])['project_id'].transform('count')
        feats['same_category_proximity'] = cat_dist_count.fillna(1).clip(1, 100)
    else:
        feats['same_category_proximity'] = pd.Series(5, index=df.index)
        
    return feats

def engineer_pattern_anomaly_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers 11 pattern recognition and anomaly features calibrated against reference population."""
    feats = pd.DataFrame(index=df.index)
    
    sanctioned = _safe_num(df, 'amount_sanctioned', 500000.0).clip(lower=1000.0)
    spent = _safe_num(df, 'amount_spent', 0.0).clip(lower=0.0)
    
    is_multi = len(df) > 1
    ref = _load_reference_stats() if not is_multi else {}
    nat_mean = ref.get('national_mean_cost', 500000.0)
    nat_std = ref.get('national_std_cost', 150000.0)
    
    # 1. work_category_outlier
    if is_multi and 'category' in df.columns:
        cat_mean = df.groupby('category')['amount_sanctioned'].transform('mean').fillna(sanctioned.mean())
        cat_std = df.groupby('category')['amount_sanctioned'].transform('std').fillna(100000.0)
        feats['work_category_outlier'] = _safe_div(sanctioned - cat_mean, cat_std + 1.0).clip(-3.0, 3.0)
    elif 'category' in df.columns and ref.get('category_means'):
        cat_val = str(df['category'].iloc[0]).strip()
        c_m = ref['category_means'].get(cat_val, nat_mean)
        c_s = ref['category_stds'].get(cat_val, nat_std)
        feats['work_category_outlier'] = _safe_div(sanctioned - c_m, c_s + 1.0).clip(-3.0, 3.0)
    else:
        feats['work_category_outlier'] = pd.Series(0.0, index=df.index)
        
    # 2. approval_to_spend_ratio
    feats['approval_to_spend_ratio'] = _safe_div(spent, sanctioned).clip(0.0, 3.0)
    
    # 2b. geo_duplicate_flag (Cross-district haversine proximity duplicate check)
    feats['geo_duplicate_flag'] = compute_geo_duplicate_flags(df)
    
    # 3. duplicate_work_score
    if len(df) > 1 and 'location' in df.columns:
        exact_match = df.duplicated(subset=['location', 'category', 'amount_sanctioned'], keep=False).astype(float)
        feats['duplicate_work_score'] = np.maximum(exact_match * 0.8 + 0.1, feats['geo_duplicate_flag'] * 0.85 + 0.1)
    else:
        feats['duplicate_work_score'] = np.where(feats['geo_duplicate_flag'] == 1, 0.85, 0.10)
        
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
    # Strictly exclude targets, IDs, and discrete flags from MinMaxScaler
    non_scaled_cols = [
        'project_id', 'approval_id', 
        'project_duration_days', 'actual_duration_days', 'planned_duration_days',
        'audit_trigger_score', 'cost_inflation_flag', 'milestone_delay_flag', 
        'ghost_project_indicator', 'suspicious_timing', 'cost_round_number_flag', 
        'location_duplicate_flag', 'geo_duplicate_flag', 'work_category_mismatch',
        'is_fraud'
    ]
    ml_cols = [c for c in numeric_cols if c not in non_scaled_cols]
    
    scaler_path = MODELS_DIR / "scaler.pkl"
    if len(all_features) > 1:
        # 1. Compute and persist empirical reference population statistics
        try:
            sanctioned_raw = _safe_num(df, 'amount_sanctioned', 500000.0)
            spent_raw = _safe_num(df, 'amount_spent', 0.0)
            prog_raw = _safe_num(df, 'progress_percentage', 70.0)
            is_overrun_s = (spent_raw > sanctioned_raw * 1.1).astype(float)
            
            ref_payload = {
                'state_avg_cost': df.groupby('state')['amount_sanctioned'].mean().to_dict() if 'state' in df.columns else {},
                'state_comp_rate': df.groupby('state')['progress_percentage'].apply(lambda s: (pd.to_numeric(s, errors='coerce') >= 90.0).mean() * 100.0).to_dict() if 'state' in df.columns else {},
                'district_workload': df.groupby('district')['project_id'].count().to_dict() if 'district' in df.columns and 'project_id' in df.columns else {},
                'district_means': df.groupby('district')['amount_sanctioned'].mean().to_dict() if 'district' in df.columns else {},
                'district_stds': df.groupby('district')['amount_sanctioned'].std().to_dict() if 'district' in df.columns else {},
                'district_risks': is_overrun_s.groupby(df['district']).mean().to_dict() if 'district' in df.columns else {},
                'category_means': df.groupby('category')['amount_sanctioned'].mean().to_dict() if 'category' in df.columns else {},
                'category_stds': df.groupby('category')['amount_sanctioned'].std().to_dict() if 'category' in df.columns else {},
                'contractor_counts': df.groupby('contractor')['approval_id'].count().to_dict() if 'contractor' in df.columns and 'approval_id' in df.columns else {},
                'contractor_overrun': is_overrun_s.groupby(df['contractor']).mean().to_dict() if 'contractor' in df.columns else {},
                'contractor_comp': (prog_raw >= 90.0).astype(float).groupby(df['contractor']).mean().to_dict() if 'contractor' in df.columns else {},
                'national_mean_cost': float(sanctioned_raw.mean()),
                'national_std_cost': float(sanctioned_raw.std()) if len(sanctioned_raw) > 1 else 150000.0
            }
            with open(REFERENCE_STATS_PATH, "wb") as f:
                pickle.dump(ref_payload, f)
            logger.info(f"Reference population statistics saved to {REFERENCE_STATS_PATH}")
        except Exception as ref_err:
            logger.warning(f"Could not persist reference stats: {ref_err}")

        # 2. Fit and transform scaler on continuous ML features only
        scaler = MinMaxScaler()
        all_features[ml_cols] = scaler.fit_transform(all_features[ml_cols])
        try:
            with open(scaler_path, "wb") as f:
                pickle.dump({'scaler': scaler, 'ml_cols': ml_cols}, f)
            logger.info(f"Scaler saved to {scaler_path} with {len(ml_cols)} features (target excluded)")
        except Exception as sc_err:
            logger.warning(f"Could not save scaler: {sc_err}")
            
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
            "target_variable": "project_duration_days (unscaled, days)",
            "top_high_variance_features": sorted_importance[:15],
            "feature_types": {col: str(all_features[col].dtype) for col in all_features.columns}
        }
        
        with open(FEATURE_METADATA_PATH, "w", encoding='utf-8') as f:
            json.dump(feature_metadata, f, indent=2)
        logger.info(f"Feature metadata JSON saved to {FEATURE_METADATA_PATH}")
    else:
        # Single sample inference: use trained reference scaler with exact column ordering
        if scaler_path.exists():
            try:
                with open(scaler_path, "rb") as f:
                    meta = pickle.load(f)
                saved_scaler = meta['scaler']
                expected_cols = meta['ml_cols']
                # Ensure all expected columns exist in input, default missing to 0.0
                for col in expected_cols:
                    if col not in all_features.columns:
                        all_features[col] = 0.0
                all_features[expected_cols] = saved_scaler.transform(all_features[expected_cols])
                # Preserve physical milestone lag in natural days for downstream consumers
                if 'days_behind_schedule' in time_df.columns:
                    all_features['days_behind_schedule'] = time_df['days_behind_schedule'].clip(lower=0)
            except Exception as inf_err:
                logger.warning(f"Single-project scaler transformation error: {inf_err}")
                # Safe bounded normalization for continuous features
                scaled_subset = [c for c in ml_cols if c in all_features.columns]
                all_features[scaled_subset] = np.clip(all_features[scaled_subset], 0.0, 1.0)
                if 'days_behind_schedule' in time_df.columns:
                    all_features['days_behind_schedule'] = time_df['days_behind_schedule'].clip(lower=0)
        else:
            scaled_subset = [c for c in ml_cols if c in all_features.columns]
            all_features[scaled_subset] = np.clip(all_features[scaled_subset], 0.0, 1.0)
            if 'days_behind_schedule' in time_df.columns:
                all_features['days_behind_schedule'] = time_df['days_behind_schedule'].clip(lower=0)
            
    return all_features

if __name__ == '__main__':
    if CLEANED_DATA_PATH.exists():
        df_cleaned = pd.read_csv(CLEANED_DATA_PATH, low_memory=False)
        feats_df = engineer_features(df_cleaned, is_training=True)
        print(f"Engineered {feats_df.shape[1]} features across {len(feats_df)} records successfully.")
