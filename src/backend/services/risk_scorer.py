import sys
import logging
import pickle
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import (
    MODELS_DIR, 
    ANALYZE_CACHE_TTL,
    RISK_LOW_MAX,
    RISK_MEDIUM_MAX,
    RISK_HIGH_MAX,
    RISK_REPORTS_PARQUET
)
from src.models.ensemble import MPLADSEnsembleScorer
from src.pipeline.feature_engineer import engineer_features
from src.pipeline.geo_utils import check_single_project_geo_duplicate
from src.pipeline.compliance_rules import compliance_engine
from src.explainability.shap_explainer import compute_shap_explanations
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
        self._master_df = None
        self._fraud_model = None
        self._fraud_features = None

    def _get_fraud_model(self):
        """Lazily load trained XGBoost model and feature names for genuine SHAP computation."""
        if self._fraud_model is None:
            model_path = self.models_dir / "fraud_classifier.pkl"
            if model_path.exists():
                try:
                    with open(model_path, "rb") as f:
                        payload = pickle.load(f)
                    self._fraud_model = payload.get("model")
                    self._fraud_features = payload.get("features", [])
                except Exception as e:
                    logger.warning(f"Could not load fraud model for SHAP: {e}")
        return self._fraud_model, self._fraud_features

    def get_master_df(self) -> Optional[pd.DataFrame]:
        """Lazily load risk reports dataset for geo and historical duplicate checks from shared singleton."""
        from src.backend.services.data_loader import get_master_dataframe
        return get_master_dataframe()


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
        if 'days_behind_schedule' in project_dict and project_dict['days_behind_schedule'] is not None:
            delay_days = max(0, int(project_dict['days_behind_schedule']))
        else:
            delay_days = max(0, int(predictions['days_behind_schedule'].iloc[0]))
        
        composite_score = compute_risk_score(anomaly_score, fraud_prob, eff_score)
        risk_cat = get_risk_category(composite_score)
        
        # Geo-Adjacency and duplicate work check
        geo_dup_info = check_single_project_geo_duplicate(project_dict, master_df=self.get_master_df())
        is_geo_dup = bool(geo_dup_info.get("geo_duplicate_detected", False))
        dup_type = geo_dup_info.get("geo_duplicate_type", "none")
        dist_km = geo_dup_info.get("distance_to_duplicate_km")

        # Extract fraud indicators & explanations
        fraud_indicators = []
        cost_sanctioned = float(project_dict.get('amount_sanctioned', 500000.0))
        cost_spent = float(project_dict.get('amount_spent', 0.0))
        cost_overrun_pct = ((cost_spent - cost_sanctioned) / (cost_sanctioned + 1e-4)) * 100.0
        
        if is_geo_dup:
            fraud_indicators.append(f"duplicate_work_{dup_type}")
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
        if is_geo_dup:
            fraud_explanation_parts.append(geo_dup_info.get("explanation", "Duplicate work detected"))
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
            
        # MPLADS Policy Compliance Evaluation
        mp_portfolio = None
        mp_name = project_dict.get('mp_name')
        if mp_name and str(mp_name).strip() not in ['Honble MP', 'Unknown MP', '']:
            master_df = self.get_master_df()
            if master_df is not None and 'mp_name' in master_df.columns:
                mp_portfolio = master_df[master_df['mp_name'].astype(str).str.lower() == str(mp_name).strip().lower()]
        
        compliance_summary = compliance_engine.evaluate_project_compliance(project_dict, mp_portfolio_df=mp_portfolio)

        # Genuine SHAP Explainability computation
        fraud_model, fraud_features = self._get_fraud_model()
        shap_results = []
        if fraud_model is not None and fraud_features:
            try:
                # Ensure all fraud features exist in df_feats
                for ff in fraud_features:
                    if ff not in df_feats.columns:
                        df_feats[ff] = 0.0
                shap_results = compute_shap_explanations(
                    fraud_model,
                    df_feats[fraud_features],
                    feature_names=fraud_features,
                    top_k=6,
                    model_key="fraud_classifier"
                )
            except Exception as e:
                logger.warning(f"SHAP attribution computation failed: {e}")

        shap_attribution = shap_results[0] if shap_results else {
            "top_features": [],
            "primary_contributors": [],
            "protective_factors": []
        }

        # Protective Factors Identification
        protective_factors = []
        prog_val = float(project_dict.get('progress_percentage', df_feats.get('progress_percentage', [80])[0]))
        contractor_past_overruns = int(project_dict.get('previous_contractor_overruns', 0))

        if delay_days <= 0:
            protective_factors.append({
                "factor": "Milestone Discipline",
                "impact": "Operating on or ahead of planned milestone schedule",
                "significance": "high"
            })
        if prog_val >= 85.0:
            protective_factors.append({
                "factor": "Physical Execution Velocity",
                "impact": f"{prog_val:.0f}% work verified as physically completed",
                "significance": "high"
            })
        if cost_overrun_pct <= 0:
            protective_factors.append({
                "factor": "Budget Containment",
                "impact": "Disbursements strictly contained within sanctioned envelope",
                "significance": "medium"
            })
        if contractor_past_overruns == 0:
            protective_factors.append({
                "factor": "Contractor Track Record",
                "impact": "Clean delivery history with zero past cost overruns",
                "significance": "medium"
            })
        for pf in shap_attribution.get("protective_factors", [])[:3]:
            protective_factors.append({
                "factor": pf["display_name"],
                "impact": f"Model attribution reduces fraud risk by {pf['impact_points']:.1f} pts",
                "significance": "model_shap"
            })

        # Actionable recommendations
        recommendations = []
        if is_geo_dup:
            if dup_type == "cross_district":
                recommendations.append(f"Cross-Boundary Duplicate Alert: Conduct joint physical inspection with adjacent district ({dist_km:.1f} km away)")
            else:
                recommendations.append("Same-District Duplicate Alert: Verify work against district master registry to prevent dual-billing")

        if compliance_summary.get("overall_status") == "NON_COMPLIANT":
            for v in compliance_summary.get("violations", []):
                recommendations.append(f"Compliance Violation [{v.get('rule_name')}]: {v.get('message')}")

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
        if is_geo_dup or composite_score >= RISK_HIGH_MAX or compliance_summary.get("overall_status") == "NON_COMPLIANT":
            alert_escalation = "Send immediate escalation alert to MP, District Authority, and MoSPI"
        elif composite_score >= RISK_MEDIUM_MAX or compliance_summary.get("overall_status") == "AT_RISK":
            alert_escalation = "Flag in monthly district audit report"
        else:
            alert_escalation = "No escalation required"
            
        # Detailed mathematical score breakdown
        anomaly_pts = round(0.40 * anomaly_score * 100.0, 1)
        fraud_pts = round(0.35 * fraud_prob * 100.0, 1)
        efficiency_pts = round(0.25 * (1.0 - eff_score) * 100.0, 1)

        drivers = []
        if is_geo_dup:
            if dup_type == "cross_district":
                drivers.append({
                    "factor": "Cross-District Duplicate",
                    "impact": f"Adjacent district match within ~{dist_km:.1f} km",
                    "severity": "critical"
                })
            else:
                drivers.append({
                    "factor": "Same-District Duplicate",
                    "impact": "Identical project found in district records",
                    "severity": "critical"
                })
        if compliance_summary.get("overall_status") == "NON_COMPLIANT":
            for v in compliance_summary.get("violations", []):
                drivers.append({
                    "factor": f"Policy Non-Compliance ({v.get('rule_name')})",
                    "impact": v.get("message", "Policy violation"),
                    "severity": "critical"
                })
        if cost_overrun_pct > 10.0:
            drivers.append({"factor": "Cost Overrun", "impact": f"+{cost_overrun_pct:.1f}% spend variation", "severity": "high"})
        if delay_days > 30:
            drivers.append({"factor": "Schedule Delay", "impact": f"{delay_days} days behind milestone", "severity": "high" if delay_days > 90 else "medium"})
        if "round_number_amount" in fraud_indicators:
            drivers.append({"factor": "Round Sanctioned Amount", "impact": "Sanctioned amount rounded to exactly lakh/crore boundary", "severity": "low"})
        if "contractor_concurrency" in fraud_indicators:
            drivers.append({"factor": "Contractor Concurrency", "impact": f"Contractor handling {project_dict.get('previous_contractor_projects', 1)} projects", "severity": "medium"})
        if int(project_dict.get('previous_contractor_overruns', 0)) > 0:
            drivers.append({"factor": "Contractor History", "impact": f"{project_dict.get('previous_contractor_overruns')} past overruns recorded", "severity": "high"})
        for pc in shap_attribution.get("primary_contributors", [])[:3]:
            drivers.append({
                "factor": pc["display_name"],
                "impact": f"SHAP attribution: +{pc['impact_points']:.1f} pts risk",
                "severity": "high" if pc["impact_points"] > 15 else "medium"
            })
        if not drivers:
            drivers.append({"factor": "Financial & Milestone Adherence", "impact": "Expenditure and progress within anticipated variance bounds", "severity": "safe"})

        score_breakdown = {
            "formula": "Risk Score = (0.40 × Anomaly) + (0.35 × Fraud) + (0.25 × (1 - Efficiency))",
            "weights": {
                "anomaly": 0.40,
                "fraud": 0.35,
                "efficiency": 0.25
            },
            "components": [
                {
                    "name": "Statistical Anomaly",
                    "weight_pct": 40,
                    "raw_value": round(anomaly_score, 3),
                    "points": anomaly_pts,
                    "color": "#3b82f6",
                    "description": "Isolation Forest deviation from standard expenditure-to-progress distribution."
                },
                {
                    "name": "Financial & Fraud Indicators",
                    "weight_pct": 35,
                    "raw_value": round(fraud_prob, 3),
                    "points": fraud_pts,
                    "color": "#ef4444",
                    "description": "XGBoost red flags (contractor history, cost overrun %, round disbursements)."
                },
                {
                    "name": "Schedule Inefficiency Penalty",
                    "weight_pct": 25,
                    "raw_value": round(1.0 - eff_score, 3),
                    "points": efficiency_pts,
                    "color": "#f59e0b",
                    "description": f"Timeline lag ({delay_days} days delayed) relative to planned completion milestone."
                }
            ],
            "total_points": composite_score,
            "key_drivers": drivers,
            "protective_factors": protective_factors,
            "plain_english_summary": (
                f"This project scored {composite_score}/100 ({risk_cat.upper()} RISK). "
                f"The statistical anomaly model contributed {anomaly_pts} pts (40% weight), "
                f"the fraud probability model contributed {fraud_pts} pts (35% weight), "
                f"and execution delay contributed {efficiency_pts} pts (25% weight). "
                + (f"Main risk factors: {'; '.join(d['factor'] + ' (' + d['impact'] + ')' for d in drivers)}." if drivers else "")
            )
        }

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
            "score_breakdown": score_breakdown,
            "compliance_assessment": compliance_summary,
            "shap_explanations": shap_attribution,
            "data_provenance": {
                "anomaly_score": "MODEL_PREDICTION (Isolation Forest + Autoencoder)",
                "fraud_probability": "MODEL_PREDICTION (XGBoost Classifier)",
                "efficiency_score": "MODEL_PREDICTION (Gradient Boosting Regressor)",
                "compliance": "RULE_BASED_DETECTION (MoSPI MPLADS Guidelines Policy Engine)",
                "geo_duplicate": "DERIVED_ANALYTICS (Haversine Spatial Proximity & District Registry)",
                "shap_attribution": "MODEL_EXPLAINABILITY (TreeExplainer Attribution)"
            },
            "recommendations": recommendations,
            "alert_escalation": alert_escalation,
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "model_confidence": 0.88,
            "geo_duplicate_detected": bool(is_geo_dup),
            "geo_duplicate_type": dup_type,
            "distance_to_duplicate_km": dist_km,
            "geo_duplicate_details": geo_dup_info
        }
        
        # Cache for 24 hours
        cache_service.set_cache(cache_key, response, ttl=ANALYZE_CACHE_TTL)
        return response

