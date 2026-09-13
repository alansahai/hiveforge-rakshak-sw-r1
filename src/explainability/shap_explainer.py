"""
MPLADS SHAP Explainability Engine
Connects TreeExplainer to tree models (XGBoost Fraud Classifier & GradientBoosting Regressor)
to compute genuine, mathematical feature attributions.
NO SIMULATED OR HARDCODED FALLBACKS.
"""

import os
import sys
import logging
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import MODELS_DIR

logger = logging.getLogger("SHAPExplainer")

FEATURE_DISPLAY_NAMES = {
    "cost_deviation_pct": "Cost Overrun / Spend Variation",
    "days_behind_schedule": "Schedule Delay",
    "budget_utilization_rate": "Budget Utilization Rate",
    "progress_percentage": "Physical Progress",
    "cost_per_day": "Daily Expenditure Velocity",
    "amount_sanctioned": "Sanctioned Budget",
    "amount_spent": "Actual Spent",
    "contractor_concurrency": "Contractor Concurrency (Active Sites)",
    "contractor_history_overrun_rate": "Contractor Historical Overruns",
    "contractor_completion_rate": "Contractor Historic Completion Rate",
    "contractor_project_count": "Contractor Total Public Works",
    "tranche_count": "Payment Tranches Disbursed",
    "days_to_first_payment": "Days to First Disbursement",
    "state_avg_project_cost": "State Benchmark Average Cost",
    "district_workload": "District Total Active Public Works",
    "geographic_anomaly_score": "District Cost Outlier Index",
    "cost_round_number_flag": "Round Lakh/Crore Sanction Amount",
    "ghost_project_indicator": "Dormant / Zero-Spend Signal",
    "duplicate_work_score": "Work Duplication Score",
    "financial_health_score": "Financial Adherence Health",
    "timeline_health": "Schedule Milestone Health",
    "state_encoded": "State Geographic Region",
    "category_encoded": "Public Work Category",
    "contractor_encoded": "Contractor Identifier"
}

_EXPLAINER_CACHE = {}

def get_tree_explainer(model, model_key: str = "fraud_classifier"):
    """Lazily creates and caches a TreeExplainer for the specified model."""
    global _EXPLAINER_CACHE
    if model_key not in _EXPLAINER_CACHE:
        try:
            import shap
            logger.info(f"Initializing TreeExplainer for {model_key}...")
            _EXPLAINER_CACHE[model_key] = shap.TreeExplainer(model)
        except Exception as e:
            logger.warning(f"Failed to initialize TreeExplainer for {model_key}: {e}")
            raise
    return _EXPLAINER_CACHE[model_key]



def compute_shap_explanations(
    model,
    X_sample: pd.DataFrame,
    feature_names: Optional[List[str]] = None,
    top_k: int = 6,
    model_key: str = "fraud_classifier"
) -> List[Dict[str, Any]]:
    """
    Computes genuine SHAP feature attributions using TreeExplainer.
    Returns structured list of feature attributions partitioned into
    risk-increasing contributors and protective factors.
    """
    if X_sample.empty:
        return []

    cols = feature_names if feature_names is not None else list(X_sample.columns)
    
    # Ensure X is formatted cleanly as 2D float array
    X_clean = X_sample[cols].values.astype(np.float32)
    X_clean = np.nan_to_num(X_clean, nan=0.0, posinf=1.0, neginf=0.0)

    try:
        explainer = get_tree_explainer(model, model_key=model_key)
        raw_shap_values = explainer.shap_values(X_clean)
        
        # Handle multiclass/binary output format from XGBoost or TreeExplainer
        if isinstance(raw_shap_values, list):
            # Binary classification: index 1 is positive class
            shap_matrix = raw_shap_values[1] if len(raw_shap_values) > 1 else raw_shap_values[0]
        elif len(raw_shap_values.shape) == 3:
            shap_matrix = raw_shap_values[:, :, 1]
        else:
            shap_matrix = raw_shap_values

        results = []
        for idx in range(len(X_sample)):
            sample_shap = shap_matrix[idx]
            
            # Sort by absolute SHAP impact
            sorted_indices = np.argsort(np.abs(sample_shap))[::-1]
            
            drivers = []
            protective = []
            all_top = []

            for i in sorted_indices[:top_k]:
                val = float(sample_shap[i])
                raw_feat_val = float(X_clean[idx, i])
                fname = cols[i]
                dname = FEATURE_DISPLAY_NAMES.get(fname, fname.replace('_', ' ').title())
                
                direction = "increases_risk" if val > 0 else "decreases_risk"
                
                item = {
                    "feature": fname,
                    "display_name": dname,
                    "raw_value": round(raw_feat_val, 3),
                    "contribution": round(val, 4),
                    "direction": direction,
                    "impact_points": round(abs(val) * 100.0, 1)
                }
                all_top.append(item)
                if val > 0:
                    drivers.append(item)
                else:
                    protective.append(item)

            results.append({
                "top_features": all_top,
                "primary_contributors": drivers,
                "protective_factors": protective
            })
            
        return results

    except Exception as e:
        logger.error(f"Genuine SHAP computation failed: {e}")
        # Explicit error reporting; NEVER fabricate fake SHAP values
        return [{
            "top_features": [],
            "primary_contributors": [],
            "protective_factors": [],
            "error": f"SHAP explanation unavailable: {str(e)}"
        } for _ in range(len(X_sample))]
