from fastapi import APIRouter, HTTPException
import logging
from src.backend.models.schemas import ProjectAnalysisRequest, RiskScoreResponse
from src.backend.services.risk_scorer import RiskScorerService

router = APIRouter()
logger = logging.getLogger("AnalyzeRoute")
risk_service = RiskScorerService()

@router.post("/analyze", response_model=RiskScoreResponse)
def analyze_project(payload: ProjectAnalysisRequest):
    """
    POST /api/analyze endpoint to score project risk, detect anomalies,
    compute fraud probability, analyze efficiency, and return SHAP-based explanations.
    """
    try:
        # Convert pydantic v2 payload to dict
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        res = risk_service.analyze_single_project(data)
        return res
    except ValueError as ve:
        logger.warning(f"Validation error in analyze request: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Internal error processing analyze request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model analysis failed: {str(e)}")
