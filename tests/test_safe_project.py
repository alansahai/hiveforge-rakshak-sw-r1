"""
Regression Test: Safe Project Risk Calibration
Verifies that a well-performing, compliant, on-time, and within-budget MPLADS project
is rigorously scored as LOW RISK (< 35) by the composite AI ensemble without artificial penalties.
"""

import sys
from pathlib import Path
import pytest

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.backend.services.risk_scorer import RiskScorerService


def test_safe_project_scores_low_risk():
    scorer = RiskScorerService()
    
    safe_project = {
        "project_id": "REG_TEST_SAFE_01",
        "project_name": "Installation of High-Mast Solar Street Lights in Gram Panchayat",
        "category": "Energy",
        "amount_sanctioned": 1000000.0,
        "amount_spent": 850000.0,
        "progress_percentage": 92.0,
        "approval_date": "2023-01-01",
        "expected_completion_date": "2023-10-01",
        "actual_completion_date": "2023-09-15",
        "days_behind_schedule": 0,
        "cost_overrun": 0,
        "district": "Varanasi",
        "state": "Uttar Pradesh",
        "contractor_name": "UP Power Infrastructure Ltd",
        "previous_contractor_projects": 10,
        "previous_contractor_overruns": 0,
        "work_description": "Installation of 20 high-mast solar street lights in public squares and community center."
    }
    
    result = scorer.analyze_single_project(safe_project)
    
    # 1. Composite risk score must be LOW (< 35)
    assert result["risk_score"] < 35, f"Safe project scored high risk: {result['risk_score']}"
    assert result["risk_category"] == "low", f"Category is {result['risk_category']}"
    
    # 2. Individual sub-model assertions
    assert result["fraud_risk"]["probability"] < 0.20, f"Fraud probability unexpectedly high: {result['fraud_risk']['probability']}"
    assert result["efficiency_risk"]["score"] > 0.80, f"Efficiency score too low: {result['efficiency_risk']['score']}"
    assert result["efficiency_risk"]["days_behind_schedule"] == 0
    
    # 3. Policy compliance must be COMPLIANT
    assert result["compliance_assessment"]["overall_status"] == "COMPLIANT"
    assert result["compliance_assessment"]["compliance_score"] == 100
    
    # 4. Explanations and provenance
    assert "data_provenance" in result
    assert result["data_provenance"]["anomaly_score"].startswith("MODEL_PREDICTION")
    assert result["data_provenance"]["fraud_probability"].startswith("MODEL_PREDICTION")
    assert result["data_provenance"]["efficiency_score"].startswith("MODEL_PREDICTION")
    assert result["data_provenance"]["compliance"].startswith("RULE_BASED_DETECTION")
    
    # 5. Protective factors must be identified
    assert len(result["score_breakdown"]["protective_factors"]) > 0
    
    # 6. SHAP explanations must be populated with genuine values
    assert "top_features" in result["shap_explanations"]
    assert len(result["shap_explanations"]["top_features"]) > 0


def test_prohibited_work_elevates_risk_and_flags_compliance():
    scorer = RiskScorerService()
    
    prohibited_project = {
        "project_id": "REG_TEST_PROHIBITED_01",
        "project_name": "Renovation of Private Temple Mandir and Prayer Hall",
        "category": "Religious Structure",
        "amount_sanctioned": 800000.0,
        "amount_spent": 400000.0,
        "progress_percentage": 50.0,
        "approval_date": "2023-01-01",
        "expected_completion_date": "2023-10-01",
        "district": "Varanasi",
        "state": "Uttar Pradesh",
        "contractor_name": "Local Builders",
        "work_description": "Construction and renovation of private mandir boundary wall and religious prayer hall."
    }
    
    result = scorer.analyze_single_project(prohibited_project)
    
    # Compliance must catch this prohibited work
    assert result["compliance_assessment"]["overall_status"] == "NON_COMPLIANT"
    assert any("Prohibited Works" in v["rule_name"] for v in result["compliance_assessment"]["violations"])
    assert result["alert_escalation"] != "No escalation required"
