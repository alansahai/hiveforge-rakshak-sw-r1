"""
MPLADS Alert Engine — with lifecycle status tracking
Manages alert creation, acknowledgment, investigation, and resolution.
Maintains in-memory audit trail per alert.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path
import sys
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import RISK_REPORTS_PARQUET, RISK_REPORTS_CSV, RISK_HIGH_MAX, RISK_MEDIUM_MAX
from src.backend.services.email_service import email_service

logger = logging.getLogger("AlertEngine")

# ── In-memory alert store ─────────────────────────────────────────────────────
_ALERTS: List[Dict[str, Any]] = []


# ── Role-specific recommendations ─────────────────────────────────────────────

ROLE_RECOMMENDATIONS = {
    "mp": [
        "Request a detailed status update from the District Authority.",
        "Ask specifically about cost variance and timeline concerns.",
        "Escalate to State Nodal Officer if response not received in 7 days.",
        "Visit the project site if feasible.",
        "Track resolution status until closure.",
    ],
    "district": [
        "Verify project status on ground immediately.",
        "Review contractor capacity, resources, and history.",
        "Prepare a remedial action plan if cost overrun is unjustified.",
        "Submit investigation report within 3 days.",
        "Consider contractor termination if fraud is confirmed.",
    ],
    "state": [
        "Coordinate with District Authority for full investigation.",
        "Cross-check with tender approval and disbursement documents.",
        "Escalate to CBI/Vigilance if fraud indicators are confirmed.",
        "Monitor all projects handled by this contractor across the state.",
        "Submit state-level compliance update within 5 days.",
    ],
    "ministry": [
        "Add to monthly national oversight dashboard.",
        "Analyse cross-state trends and contractor clustering patterns.",
        "Prepare quarterly compliance report for policy review.",
        "Provide policy recommendations if systemic issues are found.",
        "Brief Joint Secretary if risk_score >= 80.",
    ],
}

ROLE_TIMELINES = {
    "mp": "Within 7 days",
    "district": "Within 3 days",
    "state": "Within 5 days",
    "ministry": "Within 14 days",
}

ESCALATION_PATHS = {
    "mp": "Escalate to State Nodal Officer",
    "district": "Escalate to State Nodal Officer and MP Office",
    "state": "Escalate to CBI/Vigilance Wing and Ministry",
    "ministry": "Brief Joint Secretary / Minister of State",
}


# ── Helper functions (kept for backward-compat with dashboard.py) ─────────────

def should_alert(risk_score: float) -> bool:
    """Returns True if a project risk score warrants an alert (>= RISK_MEDIUM_MAX)."""
    return risk_score >= RISK_MEDIUM_MAX


def generate_alert(project_data: dict, risk_score: float) -> dict:
    """Create a structured alert payload from project data and risk score."""
    proj_id = project_data.get("project_id", "PROJ-UNKNOWN")
    state = project_data.get("state", "National")
    district = project_data.get("district", "District")
    mp = project_data.get("mp_name", "Honble MP")

    if risk_score >= RISK_HIGH_MAX:
        severity = "critical"
        alert_type = "fraud_anomaly"
        recipients = [
            f"MP Office ({mp})",
            f"District Magistrate ({district})",
            f"State Nodal Officer ({state})",
            "MoSPI Monitoring Wing",
        ]
        explanation = (
            f"CRITICAL RISK: Project {proj_id} carries composite risk score "
            f"{risk_score:.0f}/100. Immediate audit and payment freeze advised."
        )
    else:
        severity = "high"
        alert_type = "inefficiency_risk"
        recipients = [
            f"MP Office ({mp})",
            f"District Planning Authority ({district})",
        ]
        explanation = (
            f"HIGH RISK: Project {proj_id} has risk score {risk_score:.0f}/100 "
            f"due to milestone delay or budget variation."
        )

    alert_id = f"ALT-{int(datetime.now().timestamp())}-{proj_id.replace('/', '_')}"

    return {
        "alert_id": alert_id,
        "project_id": proj_id,
        "risk_score": int(risk_score),
        "alert_type": alert_type,
        "severity": severity,
        "state": state,
        "district": district,
        "message": explanation,
        "explanation": explanation,
        "recipients": recipients,
        "created_at": datetime.now().isoformat(),
        "resolved_at": None,
        # lifecycle fields
        "status": "open",
        "current_owner": None,
        "resolution_notes": None,
        "resolved_by": None,
        "email_sent": False,
        "email_sent_to": None,
        "email_sent_at": None,
        "notification_status": "pending",
        "status_history": [],
    }


def store_alert(alert: dict) -> None:
    """Store an alert in memory."""
    _ALERTS.append(alert)


def get_unresolved_alerts(
    severity: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Retrieve unresolved alerts from risk_reports.csv or in-memory store.
    Kept for backward compatibility with dashboard.py.
    """
    alerts = []
    df = None
    if RISK_REPORTS_PARQUET.exists():
        try:
            df = pd.read_parquet(RISK_REPORTS_PARQUET)
        except Exception as exc:
            logger.warning(f"Failed to read alerts from Parquet: {exc}")
    elif RISK_REPORTS_CSV.exists():
        try:
            df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
        except Exception as exc:
            logger.warning(f"Failed to read alerts from CSV: {exc}")

    if df is not None and not df.empty and "risk_score" in df.columns:
        try:
            flagged = df[df["risk_score"] >= RISK_MEDIUM_MAX].copy()
            if state:
                st_clean = state.strip().lower()
                flagged = flagged[flagged["state"].astype(str).str.lower().str.contains(st_clean, na=False)]
            if severity:
                flagged = flagged[flagged["risk_category"].astype(str).str.lower() == severity.strip().lower()]
            flagged = flagged.sort_values(by="risk_score", ascending=False).head(limit * 2)
            for _, row in flagged.iterrows():
                r_dict = row.to_dict()
                pid = str(r_dict.get("project_id", "")).strip()
                if not pid or pid.lower() in ("nan", "none", "null", ""):
                    continue
                alerts.append(generate_alert(r_dict, float(row["risk_score"])))
                if len(alerts) >= limit:
                    break
        except Exception as exc:
            logger.warning(f"Error processing alerts from dataframe: {exc}")

    st_clean = state.strip().lower() if state else None
    for a in _ALERTS:
        if not a.get("resolved_at"):
            if st_clean and st_clean not in a.get("state", "").lower():
                continue
            if severity and a.get("severity", "").lower() != severity.strip().lower():
                continue
            pid = str(a.get("project_id", "")).strip()
            if not pid or pid.lower() in ("nan", "none", "null", ""):
                continue
            alerts.append(a)

    return alerts[:limit]


# ── AlertEngine class (new lifecycle management) ───────────────────────────────

class AlertEngine:
    """Manages the full alert lifecycle: create → acknowledge → investigate → resolve."""

    def __init__(self):
        self._alerts = _ALERTS  # shared reference to module-level list
        if not self._alerts:
            self._seed_initial_alerts()

    def _seed_initial_alerts(self, limit: int = 50):
        """Seed lifecycle store with top high-risk / critical alerts from dataset."""
        df = None
        if RISK_REPORTS_PARQUET.exists():
            try:
                df = pd.read_parquet(RISK_REPORTS_PARQUET)
            except Exception as e:
                logger.warning(f"Failed to read parquet for alert seed: {e}")
        elif RISK_REPORTS_CSV.exists():
            try:
                df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
            except Exception as e:
                logger.warning(f"Failed to read csv for alert seed: {e}")

        if df is not None and not df.empty and "risk_score" in df.columns:
            top_flagged = df[df["risk_score"] >= RISK_MEDIUM_MAX].sort_values(by="risk_score", ascending=False).head(limit * 2)
            for _, row in top_flagged.iterrows():
                r_dict = row.to_dict()
                pid = str(r_dict.get("project_id", "")).strip()
                if not pid or pid.lower() in ("nan", "none", "null", ""):
                    continue
                alert = generate_alert(r_dict, float(r_dict.get("risk_score", 0)))
                if r_dict.get("explanations"):
                    alert["explanation"] = str(r_dict["explanations"])
                    alert["message"] = str(r_dict["explanations"])
                self._alerts.append(alert)
                if len(self._alerts) >= limit:
                    break
            logger.info(f"Seeded {len(self._alerts)} initial lifecycle alerts into AlertEngine.")

    def _seed_alerts_for_state(self, state: str, limit: int = 30):
        """Seed lifecycle store with alerts from a specific requested state."""
        df = None
        if RISK_REPORTS_PARQUET.exists():
            try:
                df = pd.read_parquet(RISK_REPORTS_PARQUET)
            except Exception as e:
                logger.warning(f"Failed to read parquet for state alert seed: {e}")
        elif RISK_REPORTS_CSV.exists():
            try:
                df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
            except Exception as e:
                logger.warning(f"Failed to read csv for state alert seed: {e}")

        if df is not None and not df.empty and "state" in df.columns:
            state_clean = state.strip().lower()
            state_df = df[df["state"].astype(str).str.lower().str.contains(state_clean, na=False)]
            if not state_df.empty:
                flagged = state_df[state_df["risk_score"] >= RISK_MEDIUM_MAX]
                if flagged.empty:
                    # Fallback to top risk projects in this state
                    flagged = state_df.sort_values(by="risk_score", ascending=False).head(limit * 2)
                else:
                    flagged = flagged.sort_values(by="risk_score", ascending=False).head(limit * 2)

                existing_ids = {a.get("project_id") for a in self._alerts}
                added = 0
                for _, row in flagged.iterrows():
                    r_dict = row.to_dict()
                    pid = str(r_dict.get("project_id", "")).strip()
                    if not pid or pid.lower() in ("nan", "none", "null", ""):
                        continue
                    if pid not in existing_ids:
                        alert = generate_alert(r_dict, float(r_dict.get("risk_score", 0)))
                        if r_dict.get("explanations"):
                            alert["explanation"] = str(r_dict["explanations"])
                            alert["message"] = str(r_dict["explanations"])
                        self._alerts.append(alert)
                        existing_ids.add(pid)
                        added += 1
                        if added >= limit:
                            break
                logger.info(f"Seeded {added} state-specific alerts for '{state}'.")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create_alert(
        self,
        project_data: dict,
        risk_score: float,
        explanation: str = "",
        send_email: bool = True,
    ) -> dict:
        """Create a new alert, persist it, and optionally send email notification."""
        alert = generate_alert(project_data, risk_score)
        if explanation:
            alert["explanation"] = explanation
            alert["message"] = explanation

        # Determine recipient role
        role = "ministry" if risk_score >= RISK_HIGH_MAX else "state" if risk_score >= 60 else "district"
        recipient_email = email_service.get_recipient_email(role)

        if send_email:
            result = email_service.send_alert_email(recipient_email, role, alert)
            alert["email_sent"] = result.get("success", False)
            alert["email_sent_to"] = recipient_email
            alert["email_sent_at"] = result.get("timestamp")
            alert["notification_status"] = "sent" if result.get("success") else "failed"

        self._alerts.append(alert)
        logger.info(f"Alert created: {alert['alert_id']} — Risk {risk_score:.0f}")
        return alert

    def get_all_alerts(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        state: Optional[str] = None,
        limit: int = 100,
    ) -> List[dict]:
        """Return alerts from in-memory store with optional filters."""
        if state:
            state_clean = state.strip().lower()
            # If no alerts exist currently for this state, dynamically seed them
            has_state = any(state_clean in a.get("state", "").lower() for a in self._alerts)
            if not has_state:
                self._seed_alerts_for_state(state)

        results = self._alerts
        if status:
            results = [a for a in results if a.get("status", "open") == status]
        if severity:
            results = [a for a in results if a.get("severity", "") == severity]
        if state:
            state_clean = state.strip().lower()
            results = [a for a in results if state_clean in a.get("state", "").lower()]

        return sorted(results, key=lambda a: a.get("risk_score", 0), reverse=True)[:limit]

    def get_alert_by_id(self, alert_id: str) -> Optional[dict]:
        """Find an alert by its ID."""
        for a in self._alerts:
            if a.get("alert_id") == alert_id:
                return a
        return None

    def get_status_counts(self) -> dict:
        """Return count of alerts grouped by lifecycle status."""
        counts = {"open": 0, "acknowledged": 0, "investigating": 0, "resolved": 0}
        for a in self._alerts:
            s = a.get("status", "open")
            if s in counts:
                counts[s] += 1
        return counts

    # ── Lifecycle transitions ──────────────────────────────────────────────────

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str, notes: str = "") -> dict:
        """Transition alert to 'acknowledged' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "acknowledged"
        alert["current_owner"] = acknowledged_by
        self._append_history(alert, "acknowledged", acknowledged_by, notes)
        return alert

    def start_investigation(self, alert_id: str, investigator: str, notes: str = "") -> dict:
        """Transition alert to 'investigating' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "investigating"
        alert["current_owner"] = investigator
        self._append_history(alert, "investigating", investigator, notes)
        return alert

    def resolve_alert(self, alert_id: str, resolved_by: str, resolution_notes: str) -> dict:
        """Transition alert to 'resolved' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "resolved"
        alert["resolved_by"] = resolved_by
        alert["resolved_at"] = datetime.now(timezone.utc).isoformat()
        alert["resolution_notes"] = resolution_notes
        self._append_history(alert, "resolved", resolved_by, resolution_notes)
        return alert

    # ── Recommendations ────────────────────────────────────────────────────────

    def get_recommendations(self, alert: dict, role: str) -> dict:
        """Return role-specific action recommendations for an alert."""
        risk_score = alert.get("risk_score", 0)
        risk_category = alert.get("risk_category", alert.get("severity", "medium"))
        role = role.lower()
        actions = list(ROLE_RECOMMENDATIONS.get(role, ROLE_RECOMMENDATIONS["district"]))

        # Critical override
        if risk_score >= 80 and role == "ministry":
            actions = [
                "Flag for immediate ministerial review.",
                "Consider suspending fund release for this project.",
            ] + actions

        priority = "IMMEDIATE" if risk_score >= 80 else "HIGH" if risk_score >= 60 else "MEDIUM"

        return {
            "priority": priority,
            "actions": actions,
            "timeline": ROLE_TIMELINES.get(role, "Within 7 days"),
            "escalation": ESCALATION_PATHS.get(role, "Follow escalation matrix"),
        }

    # ── Private helpers ────────────────────────────────────────────────────────

    def _find_or_raise(self, alert_id: str) -> dict:
        alert = self.get_alert_by_id(alert_id)
        if alert is None:
            raise ValueError(f"Alert '{alert_id}' not found in active store.")
        return alert

    @staticmethod
    def _append_history(alert: dict, status: str, updated_by: str, notes: str):
        if "status_history" not in alert:
            alert["status_history"] = []
        alert["status_history"].append({
            "status": status,
            "updated_by": updated_by,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "notes": notes,
        })


# Module-level singleton instance
alert_engine = AlertEngine()
