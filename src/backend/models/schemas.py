from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import pandas as pd

class ProjectAnalysisRequest(BaseModel):
    project_id: str = Field(..., json_schema_extra={"example": "AP-2024-001"})
    amount_sanctioned: float = Field(..., gt=0, le=500_000_000.0, json_schema_extra={"example": 500000.0})
    amount_spent: float = Field(..., ge=0, json_schema_extra={"example": 650000.0})
    approval_date: Union[str, datetime] = Field(..., json_schema_extra={"example": "2023-06-15"})
    expected_completion_date: Union[str, datetime] = Field(..., json_schema_extra={"example": "2024-06-15"})
    actual_completion_date: Optional[Union[str, datetime]] = Field(default=None, json_schema_extra={"example": "2024-09-20"})
    state: str = Field(..., json_schema_extra={"example": "Andhra Pradesh"})
    district: str = Field(..., json_schema_extra={"example": "Visakhapatnam"})
    category: str = Field(..., json_schema_extra={"example": "Health"})
    contractor: str = Field(..., json_schema_extra={"example": "ABC Constructions"})
    progress_percentage: float = Field(default=85.0, ge=0, le=100, json_schema_extra={"example": 85.0})
    work_description: Optional[str] = Field(default="Infrastructure and development work under MPLADS", json_schema_extra={"example": "Construction of health center"})
    previous_contractor_projects: Optional[int] = Field(default=1, ge=0, json_schema_extra={"example": 12})
    previous_contractor_overruns: Optional[int] = Field(default=0, ge=0, json_schema_extra={"example": 3})
    
    # MPLADS Policy Compliance Fields
    mp_name: Optional[str] = Field(default="Honble MP", json_schema_extra={"example": "Dr. Ramesh Kumar"})
    target_demographic: Optional[str] = Field(default="general", json_schema_extra={"example": "SC"})
    is_sc_benefit: Optional[bool] = Field(default=None, json_schema_extra={"example": True})
    is_st_benefit: Optional[bool] = Field(default=None, json_schema_extra={"example": False})

    @model_validator(mode='after')
    def validate_dates_and_financials(self):
        """Cross-field structural validations adhering to physical constraints."""
        try:
            app_dt = pd.to_datetime(self.approval_date)
            exp_dt = pd.to_datetime(self.expected_completion_date)
        except Exception as e:
            raise ValueError(f"Invalid date format for approval or expected completion: {e}")

        # Structural impossibility check: project cannot be scheduled to finish before approval
        if app_dt > exp_dt:
            raise ValueError(
                f"approval_date ({self.approval_date}) cannot be later than expected_completion_date ({self.expected_completion_date})"
            )

        # Actual completion cannot precede approval date
        if self.actual_completion_date is not None:
            try:
                act_dt = pd.to_datetime(self.actual_completion_date)
                if act_dt < app_dt:
                    raise ValueError(
                        f"actual_completion_date ({self.actual_completion_date}) cannot precede approval_date ({self.approval_date})"
                    )
            except Exception as e:
                raise ValueError(f"Invalid date format for actual_completion_date: {e}")

        # Sanctioned amount must adhere to MPLADS physical bounds
        if self.amount_sanctioned < 1000.0:
            raise ValueError("amount_sanctioned must be at least ₹1,000 for public infrastructure works")

        # Note: amount_spent > amount_sanctioned is intentionally PERMITTED as it reflects
        # real-world financial cost overruns, a primary risk signal analyzed by our models.
        return self


class FraudRiskDetail(BaseModel):
    probability: float
    indicators: List[str]
    explanation: str

class EfficiencyRiskDetail(BaseModel):
    score: float
    days_behind_schedule: int
    explanation: str

class RiskScoreResponse(BaseModel):
    project_id: str
    risk_score: int
    risk_category: str
    anomaly_score: float
    fraud_risk: FraudRiskDetail
    efficiency_risk: EfficiencyRiskDetail
    recommendations: List[str]
    alert_escalation: str
    computed_at: str
    model_confidence: float
    score_breakdown: Optional[Dict[str, Any]] = None
    compliance_assessment: Optional[Dict[str, Any]] = None
    shap_explanations: Optional[Dict[str, Any]] = None
    data_provenance: Optional[Dict[str, Any]] = None
    geo_duplicate_detected: Optional[bool] = None
    geo_duplicate_type: Optional[str] = None  # 'cross_district', 'same_district', 'none'
    distance_to_duplicate_km: Optional[float] = None
    geo_duplicate_details: Optional[Dict[str, Any]] = None

class AlertResponse(BaseModel):
    alert_id: str
    project_id: str
    risk_score: int
    alert_type: str
    severity: str
    message: str
    recipients: List[str]
    created_at: str
    resolved_at: Optional[str] = None

class DashboardStatsResponse(BaseModel):
    total_projects: int
    completed_projects: int
    at_risk_projects: int
    critical_projects: int
    avg_cost_overrun_pct: float
    avg_delay_days: int
    fraud_cases: int
    completion_rate: float

class ExportRequest(BaseModel):
    format: str = Field(default="pdf", json_schema_extra={"example": "pdf"})
    state: Optional[str] = None
    category: Optional[str] = None
    risk_category: Optional[str] = None
    limit: Optional[int] = 100

class AssetVerificationResponse(BaseModel):
    project_id: str
    verified: bool
    status: str
    distance_km: Optional[float] = None
    tolerance_km: float = 5.0
    site_location: Dict[str, float]
    photo_location: Optional[Dict[str, float]] = None
    message: str
    photo_timestamp: Optional[str] = None
    provenance: str = "EXIF_GPS_VERIFICATION"
