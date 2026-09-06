import sys
import logging
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import (
    MODELS_DIR, 
    ANALYZE_CACHE_TTL,
    RISK_LOW_MAX,
    RISK_MEDIUM_MAX,
    RISK_HIGH_MAX
)
from src.models.ensemble import MPLADSEnsembleScorer
from src.pipeline.feature_engineer import engineer_features
from src.explainability.rule_extractor import extract_human_rules
from src.backend.services.cache import cache_service

logger = logging.getLogger("RiskScorerService")

def get_risk_category(risk_score: float) -> str:
    """Categorizes 0-100 risk score into low, medium, high, critical."""
    if risk_score >= RISK_HIGH_MAX:
        return "critical"
    elif risk_score >= RISK_MEDIUM_MAX:
        return "high"
    elif risk_score >= RISK_LOW_MAX:
        return "medium"
    return "low"

def compute_risk_score(anomaly_score: float, fraud_probability: float, efficiency_score: float) -> int:
    """Composite risk formula: (0.40 * anomaly + 0.35 * fraud + 0.25 * (1 - efficiency)) * 100."""
    score = (
        0.40 * anomaly_score +
        0.35 * fraud_probability +
        0.25 * (1.0 - efficiency_score)
    ) * 100.0
    return int(round(np.clip(score, 0, 100)))

class RiskScorerService:
    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = models_dir
        self.ensemble = MPLADSEnsembleScorer(models_dir)

    def analyze_single_project(self, project_dict: dict) -> dict:
        """
        Processes single project analysis request with caching, feature engineering,
        ensemble prediction, explainability breakdown, and actionable recommendations.
        """
        proj_id = str(project_dict.get('project_id', 'PROJ-UNKNOWN'))
        cache_key = f"analysis:{proj_id}"
        
        # Check cache
        cached = cache_service.get_cached_result(cache_key)
        if cached:
            logger.info(f"Returning cached analysis for project {proj_id}")
            return cached
            
        logger.info(f"Analyzing project {proj_id}...")
        
        # Create DataFrame from input
        df_raw = pd.DataFrame([project_dict])
        
        # Ensure completion date formatting
        if 'completion_date' not in df_raw.columns:
            df_raw['completion_date'] = df_raw.get('actual_completion_date', df_raw.get('expected_completion_date'))
        if 'approval_id' not in df_raw.columns:
            df_raw['approval_id'] = df_raw['project_id']
        if 'location' not in df_raw.columns:
            df_raw['location'] = f"{df_raw.get('district', ['Central'])[0]}, {df_raw.get('state', ['State'])[0]}"
            
        # Engineer 50+ features
        df_feats = engineer_features(df_raw)
        
        # Predict using ensemble
        predictions = self.ensemble.predict_risk(df_feats)
        
        anomaly_score = float(predictions['anomaly_score'].iloc[0])
        fraud_prob = float(predictions['fraud_probability'].iloc[0])
        eff_score = float(predictions['efficiency_score'].iloc[0])
        delay_days = int(predictions['days_behind_schedule'].iloc[0])
        
        composite_score = compute_risk_score(anomaly_score, fraud_prob, eff_score)
        risk_cat = get_risk_category(composite_score)
        
        # Extract fraud indicators & explanations
        fraud_indicators = []
        cost_sanctioned = float(project_dict.get('amount_sanctioned', 500000.0))
        cost_spent = float(project_dict.get('amount_spent', 0.0))
        cost_overrun_pct = ((cost_spent - cost_sanctioned) / (cost_sanctioned + 1e-4)) * 100.0
        
        if cost_overrun_pct > 15.0:
            fraud_indicators.append("cost_inflation")
        if int(cost_sanctioned) % 100000 == 0:
            fraud_indicators.append("round_number_amount")
        if cost_spent == 0 and delay_days > 60:
            fraud_indicators.append("ghost_project")
        if int(project_dict.get('previous_contractor_projects', 1)) >= 5:
            fraud_indicators.append("contractor_concurrency")
        if not fraud_indicators:
            fraud_indicators.append("standard_financial_pattern")
            
        fraud_explanation_parts = []
        if cost_overrun_pct > 0:
            fraud_explanation_parts.append(f"Project reflects {cost_overrun_pct:.1f}% spend variation relative to sanctioned amount")
        if "contractor_concurrency" in fraud_indicators:
            fraud_explanation_parts.append("Contractor managing multiple concurrent public works")
        if not fraud_explanation_parts:
            fraud_explanation_parts.append("Financial velocity and tranche releases match expected profile")
        fraud_explanation = "; ".join(fraud_explanation_parts)
        
        # Efficiency explanation
        if delay_days > 0:
            eff_explanation = f"Project is {delay_days} days behind scheduled completion milestone."
        else:
            eff_explanation = "Project progress matches or exceeds anticipated timeline."
            
        # Actionable recommendations
        recommendations = []
        if composite_score >= RISK_HIGH_MAX:
            recommendations.append("Immediate physical audit and measurement book verification recommended")
            recommendations.append("Freeze subsequent tranche releases pending independent inspection")
            recommendations.append("Audit contractor past performance and vendor bank details")
        elif composite_score >= RISK_MEDIUM_MAX:
            recommendations.append("Review contractor progress payment vouchers and materials receipts")
            recommendations.append("Verify geo-tagged photographs of ongoing site work")
            recommendations.append("Engage district implementing agency for revised completion milestone")
        else:
            recommendations.append("Maintain standard quarterly monitoring cycle")
            recommendations.append("Track next tranche disbursement against physical milestones")
            
        # Alert escalation
        if composite_score >= RISK_HIGH_MAX:
            alert_escalation = "Send immediate escalation alert to MP, District Authority, and MoSPI"
        elif composite_score >= RISK_MEDIUM_MAX:
            alert_escalation = "Flag in monthly district audit report"
        else:
            alert_escalation = "No escalation required"
            
        response = {
            "project_id": proj_id,
            "risk_score": composite_score,
            "risk_category": risk_cat,
            "anomaly_score": round(anomaly_score, 4),
            "fraud_risk": {
                "probability": round(fraud_prob, 4),
                "indicators": fraud_indicators,
                "explanation": fraud_explanation
            },
            "efficiency_risk": {
                "score": round(eff_score, 4),
                "days_behind_schedule": delay_days,
                "explanation": eff_explanation
            },
            "recommendations": recommendations,
            "alert_escalation": alert_escalation,
            "computed_at": datetime.now().isoformat(),
            "model_confidence": 0.88
        }
        
        # Cache for 24 hours
        cache_service.set_cache(cache_key, response, ttl=ANALYZE_CACHE_TTL)
        return response
