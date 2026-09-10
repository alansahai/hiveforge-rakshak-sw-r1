from fastapi import APIRouter, HTTPException
import logging
from src.backend.models.schemas import ProjectAnalysisRequest, RiskScoreResponse
from src.backend.services.risk_scorer import RiskScorerService
from src.backend.services.alert_engine import alert_engine, should_alert

router = APIRouter()
logger = logging.getLogger("AnalyzeRoute")
risk_service = RiskScorerService()


@router.post("/analyze", response_model=RiskScoreResponse)
def analyze_project(payload: ProjectAnalysisRequest):
    """
    POST /api/analyze endpoint to score project risk, detect anomalies,
    compute fraud probability, analyze efficiency, and return SHAP-based explanations.

    If the resulting risk_score is above the alert threshold (>= 60),
    an alert is automatically created in the lifecycle alert engine with
    an email notification dispatched (demo mode: logged to console).
    """
    try:
        # Convert pydantic v2 payload to dict
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        res = risk_service.analyze_single_project(data)

        # Auto-create lifecycle alert for high-risk results
        risk_score = res.get("risk_score", 0)
        if should_alert(risk_score):
            # Build explanation from fraud + efficiency risk details
            fraud_detail = res.get("fraud_risk", {})
            eff_detail = res.get("efficiency_risk", {})
            parts = []
            if fraud_detail.get("explanation"):
                parts.append(fraud_detail["explanation"])
            if eff_detail.get("explanation"):
                parts.append(eff_detail["explanation"])
            explanation = " | ".join(parts) if parts else f"Composite risk score {risk_score}/100 — review required."

            try:
                alert_engine.create_alert(
                    project_data=data,
                    risk_score=float(risk_score),
                    explanation=explanation,
                    send_email=True,
                )
                logger.info(f"Lifecycle alert created for project {data.get('project_id')} (risk={risk_score})")
            except Exception as alert_err:
                # Alert creation failure should not block the response
                logger.warning(f"Alert creation failed (non-fatal): {alert_err}")

        return res

    except ValueError as ve:
        logger.warning(f"Validation error in analyze request: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Internal error processing analyze request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model analysis failed: {str(e)}")
