from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class ProjectAnalysisRequest(BaseModel):
    project_id: str = Field(..., json_schema_extra={"example": "AP-2024-001"})
    amount_sanctioned: float = Field(..., gt=0, json_schema_extra={"example": 500000.0})
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
