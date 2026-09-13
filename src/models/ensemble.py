import os
import sys
import pickle
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import (
    MODELS_DIR, 
    DATA_DIR, 
    FEATURE_DATA_PATH, 
    CLEANED_DATA_PATH,
    RISK_REPORTS_PARQUET, 
    RISK_REPORTS_CSV,
    RISK_LOW_MAX,
    RISK_MEDIUM_MAX,
    RISK_HIGH_MAX
)
from src.models.anomaly_detector import score_anomalies
from src.models.fraud_classifier import predict_fraud
from src.models.efficiency_analyzer import analyze_efficiency

logger = logging.getLogger("EnsembleScorer")

class MPLADSEnsembleScorer:
    """
    Orchestrates the 3 sub-models:
    1. Anomaly Detector (Isolation Forest + Autoencoder) [Weight: 0.40]
    2. Fraud Classifier (XGBoost) [Weight: 0.35]
    3. Efficiency Analyzer (Gradient Boosting Regressor) [Weight: 0.25]
    Produces unified 0-100 composite risk scores and audit recommendations.
    """
    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = models_dir
        self.weights = {
            'anomaly': 0.40,
            'fraud': 0.35,
            'efficiency': 0.25
        }

    def predict_risk(self, df_features: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates ensemble risk scores, risk categories, explanations, and actions.
        """
        logger.info(f"Computing ensemble risk scores on {len(df_features)} records...")
        
        # 1. Anomaly scoring
        anomaly_df = score_anomalies(df_features, self.models_dir)
        anomaly_score = anomaly_df['anomaly_score'].values
        
        # 2. Fraud scoring
        fraud_df = predict_fraud(df_features, self.models_dir)
        fraud_prob = fraud_df['fraud_probability'].values
        
        # 3. Efficiency scoring
        eff_df = analyze_efficiency(df_features, self.models_dir)
        eff_score = eff_df['efficiency_score'].values
        
        # 4. Composite Risk Score (0 - 100)
        # risk_score = (0.4 * anomaly + 0.35 * fraud + 0.25 * (1 - efficiency)) * 100
        composite_score = (
            self.weights['anomaly'] * anomaly_score +
            self.weights['fraud'] * fraud_prob +
            self.weights['efficiency'] * (1.0 - eff_score)
        ) * 100.0
        composite_score = np.clip(composite_score, 0.0, 100.0)
        
        # 5. Risk Category Assignment and Contextual Action Recommendation
        # 0-40: low, 40-60: medium, 60-80: high, 80-100: critical
        categories = []
        actions = []
        geo_dup = df_features.get('geo_duplicate_flag', pd.Series(0, index=df_features.index)).values
        dup_score = df_features.get('duplicate_work_score', pd.Series(0, index=df_features.index)).values

        for i, score in enumerate(composite_score):
            is_geo_dup = (i < len(geo_dup) and geo_dup[i] == 1)
            is_same_dup = (i < len(dup_score) and dup_score[i] > 0.70)
            is_high_fraud = (i < len(fraud_prob) and fraud_prob[i] >= 0.70)

            # Escalate risk score if severe duplicate work or critical fraud probability is flagged
            effective_score = score
            if is_geo_dup or is_high_fraud:
                effective_score = max(effective_score, 82.0)
            elif is_same_dup:
                effective_score = max(effective_score, 75.0)

            composite_score[i] = effective_score

            if effective_score >= RISK_HIGH_MAX or is_geo_dup or is_high_fraud:
                categories.append('critical')
                if is_geo_dup:
                    actions.append("🚨 Critical Vigilance Alert: Freeze pending disbursals; initiate joint inter-district physical inspection to verify geotagged coordinates against satellite imagery.")
                elif is_high_fraud:
                    actions.append("🚨 High-Probability Fraud Warning: Halt contractor payment vouchers; initiate priority forensic expenditure audit.")
                else:
                    actions.append("Escalate immediately to MP, District Authority, and Ministry for investigation")
            elif effective_score >= RISK_MEDIUM_MAX or is_same_dup:
                categories.append('high')
                if is_same_dup:
                    actions.append("Flag for immediate on-site GPS verification against registered district asset inventory.")
                else:
                    actions.append("Flag for priority audit, contractor payment verification, and on-site inspection")
            elif effective_score >= RISK_LOW_MAX:
                categories.append('medium')
                actions.append("Schedule for quarterly review; verify progress milestones")
            else:
                categories.append('low')
                actions.append("Standard monitoring; nominal execution parameters")
                
        # 6. Assemble explanations
        explanations = []
        cost_inflation = df_features.get('cost_inflation_flag', pd.Series(0, index=df_features.index)).values
        ghost_flag = df_features.get('ghost_project_indicator', pd.Series(0, index=df_features.index)).values
        concurrency = df_features.get('contractor_concurrency', pd.Series(1, index=df_features.index)).values
        delay_days = df_features.get('days_behind_schedule', pd.Series(0, index=df_features.index)).values
        
        geo_dup = df_features.get('geo_duplicate_flag', pd.Series(0, index=df_features.index)).values
        dup_score = df_features.get('duplicate_work_score', pd.Series(0, index=df_features.index)).values
        
        for i in range(len(df_features)):
            reasons = []
            if geo_dup[i] == 1:
                reasons.append("Cross-boundary duplicate work detected across adjacent administrative district")
            elif dup_score[i] > 0.70:
                reasons.append("Same-district duplicate work detected at matching location")
            if fraud_prob[i] > 0.50:
                if cost_inflation[i] == 1:
                    reasons.append("Cost inflation exceeding initial sanction (>15%)")
                if ghost_flag[i] == 1:
                    reasons.append("Ghost project signal: 90+ days without fund disbursement")
                if concurrency[i] >= 5:
                    reasons.append(f"Contractor concurrency risk: {int(concurrency[i])} active projects")
            if eff_score[i] < 0.60:
                if delay_days[i] > 30:
                    reasons.append(f"Project delayed by {int(delay_days[i])} days behind schedule")
                else:
                    reasons.append("Sub-optimal progress execution velocity relative to timeline")
            if anomaly_score[i] > 0.60:
                reasons.append("Multi-factor structural anomaly detected by deep autoencoder")
            if not reasons:
                reasons.append("Execution metrics within normal distribution")
            explanations.append("; ".join(reasons))
            
        results = pd.DataFrame(index=df_features.index)
        if 'project_id' in df_features.columns:
            results['project_id'] = df_features['project_id'].values
        elif 'approval_id' in df_features.columns:
            results['project_id'] = df_features['approval_id'].values
            
        results['risk_score'] = composite_score.round(1)
        results['ensemble_risk_score'] = results['risk_score']
        results['risk_category'] = categories
        results['anomaly_score'] = anomaly_score.round(4)
        results['fraud_probability'] = fraud_prob.round(4)
        results['efficiency_score'] = eff_score.round(4)
        results['predicted_duration_days'] = eff_df['predicted_duration_days'].values
        results['days_behind_schedule'] = eff_df['days_behind_schedule'].values
        results['timeline_status'] = eff_df['timeline_status'].values
        results['root_cause_hypothesis'] = eff_df['root_cause_hypothesis'].values
        results['explanations'] = explanations
        results['recommended_action'] = actions
        results['computed_at'] = datetime.now().isoformat()
        results['confidence'] = 0.88
        
        return results

def create_ensemble_scorer(output_dir: Path = MODELS_DIR) -> str:
    """
    Initializes ensemble scorer configuration, runs batch predictions on available
    feature data, and exports full risk reports to Parquet and CSV.
    """
    logger.info("Initializing & exporting Ensemble Scorer configuration...")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    config = {
        "weights": {
            "anomaly_detector": 0.40,
            "fraud_classifier": 0.35,
            "efficiency_analyzer": 0.25
        },
        "thresholds": {
            "low": [0.0, 40.0],
            "medium": [40.0, 60.0],
            "high": [60.0, 80.0],
            "critical": [80.0, 100.0]
        },
        "created_at": datetime.now().isoformat()
    }
    
    cfg_path = output_dir / "ensemble_config.pkl"
    with open(cfg_path, "wb") as f:
        pickle.dump(config, f)
    logger.info(f"Ensemble configuration written to {cfg_path}")
    
    # Run batch evaluation if feature data exists
    if FEATURE_DATA_PATH.exists() and CLEANED_DATA_PATH.exists():
        logger.info("Generating master batch risk reports on full dataset...")
        df_feats = pd.read_csv(FEATURE_DATA_PATH, low_memory=False)
        df_clean = pd.read_csv(CLEANED_DATA_PATH, low_memory=False)
        
        scorer = MPLADSEnsembleScorer(output_dir)
        risk_df = scorer.predict_risk(df_feats)
        
        # Merge metadata columns from cleaned dataset
        meta_cols = [
            'project_id', 'state', 'district', 'category', 'mp_name', 
            'constituency', 'amount_sanctioned', 'amount_spent', 'contractor', 
            'house', 'progress_percentage', 'approval_date', 'completion_date', 
            'work_description'
        ]
        available_meta = [c for c in meta_cols if c in df_clean.columns]
        
        if 'project_id' in risk_df.columns and 'project_id' in df_clean.columns:
            full_report = risk_df.merge(df_clean[available_meta], on='project_id', how='left')
        else:
            full_report = pd.concat([risk_df, df_clean[available_meta]], axis=1)
            
        # Export to CSV and Parquet
        RISK_REPORTS_CSV.parent.mkdir(parents=True, exist_ok=True)
        full_report.to_csv(RISK_REPORTS_CSV, index=False)
        try:
            full_report.to_parquet(RISK_REPORTS_PARQUET, index=False)
            logger.info(f"Saved risk report to {RISK_REPORTS_PARQUET}")
        except Exception as e:
            logger.warning(f"Parquet export skipped: {str(e)}")
            
        logger.info(f"Saved risk report to {RISK_REPORTS_CSV} ({len(full_report)} records)")
        
    return str(cfg_path)

if __name__ == '__main__':
    create_ensemble_scorer()
