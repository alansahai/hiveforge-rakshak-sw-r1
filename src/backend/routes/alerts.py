"""
MPLADS Alert Lifecycle Routes
All routes under /api/alerts/

GET    /api/alerts/                            — list all alerts (filterable by status/severity/state)
GET    /api/alerts/{alert_id}                  — single alert with audit trail
PATCH  /api/alerts/{alert_id}/acknowledge      — acknowledge alert
PATCH  /api/alerts/{alert_id}/investigate      — start investigation
PATCH  /api/alerts/{alert_id}/resolve          — resolve alert
GET    /api/alerts/{alert_id}/recommendations  — role-specific action recommendations
POST   /api/alerts/send-test-email             — trigger a test notification email
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional

from src.backend.services.alert_engine import alert_engine
from src.backend.services.email_service import email_service

router = APIRouter(prefix="/alerts", tags=["alerts"])
logger = logging.getLogger("AlertsRoutes")


# ── List & detail ──────────────────────────────────────────────────────────────

@router.get("/", summary="List all alerts with lifecycle status")
def list_alerts(
    status: Optional[str] = Query(None, description="open | acknowledged | investigating | resolved"),
    severity: Optional[str] = Query(None, description="critical | high | medium"),
    state: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Returns all in-memory lifecycle-tracked alerts.
    Filter by status, severity, or state.
    Also includes status counts for dashboard tabs.
    """
    alerts = alert_engine.get_all_alerts(
        status=status, severity=severity, state=state, limit=limit
    )
    return {
        "total": len(alerts),
        "status_counts": alert_engine.get_status_counts(),
        "filters": {"status": status, "severity": severity, "state": state},
        "alerts": alerts,
    }


@router.get("/{alert_id}", summary="Get single alert with full audit trail")
def get_alert(alert_id: str):
    """Retrieve a single alert including its complete `status_history` audit trail."""
    alert = alert_engine.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


# ── Lifecycle transitions ──────────────────────────────────────────────────────

@router.patch("/{alert_id}/acknowledge", summary="Acknowledge an alert")
def acknowledge_alert(
    alert_id: str,
    acknowledged_by: str = Query(..., description="Username or role acknowledging the alert"),
    notes: str = Query("", description="Optional acknowledgment notes"),
):
    """
    Transition alert status to **acknowledged**.
    Records the action in the audit trail with timestamp, user, and notes.
    """
    try:
        alert = alert_engine.acknowledge_alert(alert_id, acknowledged_by, notes)
        return {"success": True, "message": "Alert acknowledged", "alert": alert}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.patch("/{alert_id}/investigate", summary="Start investigation on an alert")
def start_investigation(
    alert_id: str,
    investigator: str = Query(..., description="Username of the investigator"),
    notes: str = Query("", description="Investigation plan or initial findings"),
):
    """
    Transition alert status to **investigating**.
    Assigns the investigator as the current owner.
    """
    try:
        alert = alert_engine.start_investigation(alert_id, investigator, notes)
        return {"success": True, "message": "Investigation started", "alert": alert}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.patch("/{alert_id}/resolve", summary="Resolve an alert")
def resolve_alert(
    alert_id: str,
    resolved_by: str = Query(..., description="Username resolving the alert"),
    resolution_notes: str = Query(..., description="What was found and what action was taken"),
):
    """
    Transition alert status to **resolved**.
    Records the resolver, timestamp, and resolution notes in the audit trail.
    """
    try:
        alert = alert_engine.resolve_alert(alert_id, resolved_by, resolution_notes)
        return {"success": True, "message": "Alert resolved", "alert": alert}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Recommendations ────────────────────────────────────────────────────────────

@router.get("/{alert_id}/recommendations", summary="Get role-specific action recommendations")
def get_recommendations(
    alert_id: str,
    role: str = Query("district", description="mp | district | state | ministry"),
):
    """
    Returns prioritised, role-specific action items for an alert.
    Includes priority level, action steps, timeline, and escalation path.
    """
    alert = alert_engine.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    recommendations = alert_engine.get_recommendations(alert, role)
    return {
        "alert_id": alert_id,
        "role": role,
        "risk_score": alert.get("risk_score"),
        "recommendations": recommendations,
    }


# ── Email test ────────────────────────────────────────────────────────────────

@router.post("/send-test-email", summary="Send a test alert email (demo mode)")
def send_test_email(
    project_id: str = Query("WS/TEST/2024/001", description="Project to alert about"),
    recipient_role: str = Query("district", description="mp | district | state | ministry"),
):
    """
    Triggers a sample alert email.
    In demo mode (default) the content is logged to the backend console.
    To send real emails set ENABLE_SMTP=true and configure SMTP env vars.
    """
    demo_alert = {
        "alert_id": f"ALT-TEST-{int(datetime.utcnow().timestamp())}",
        "project_id": project_id,
        "approval_id": "WS/DEMO/2024/001",
        "risk_score": 75.5,
        "risk_category": "high",
        "explanation": (
            "Project shows 35% cost overrun and 4-month schedule delay. "
            "Urgent ground-level review required."
        ),
        "created_at": datetime.utcnow().isoformat(),
    }
    recipient_email = email_service.get_recipient_email(recipient_role)
    result = email_service.send_alert_email(recipient_email, recipient_role, demo_alert)
    return {
        "success": result.get("success"),
        "mode": result.get("mode"),
        "message": result.get("message", result.get("error")),
        "email_sent_to": result.get("recipient"),
        "timestamp": result.get("timestamp"),
    }
