"""
MPLADS Alert Engine — with lifecycle status tracking
Manages alert creation, acknowledgment, investigation, and resolution.
Maintains in-memory audit trail per alert.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path
import sys
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import (
    DATA_DIR,
    RISK_REPORTS_PARQUET,
    RISK_REPORTS_CSV,
    ALERT_STATE_PATH,
    RISK_HIGH_MAX,
    RISK_MEDIUM_MAX,
)
from src.backend.services.email_service import email_service

logger = logging.getLogger("AlertEngine")
AUDIT_TRAIL_PATH = DATA_DIR / "results" / "audit_trail.jsonl"

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


def generate_alert(project_data: dict, risk_score: float, alert_id: Optional[str] = None) -> dict:
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

    if not alert_id:
        clean_pid = str(proj_id).replace('/', '_').replace(' ', '_').strip()
        alert_id = f"ALT-{clean_pid}"

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
    """Store an alert in memory and persist to state file."""
    _ALERTS.append(alert)
    if 'alert_engine' in globals():
        alert_engine._save_state()


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

    def __init__(self, state_file: Optional[Path] = None):
        global _ALERTS
        self.state_file = Path(state_file) if state_file else ALERT_STATE_PATH
        self._alerts = []
        _ALERTS = self._alerts
        self._load_or_seed_alerts()

    def _save_state(self):
        """Synchronously persists current alert lifecycle state to state_file."""
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_file = self.state_file.with_suffix(".json.tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(self._alerts, f, indent=2, default=str)
            tmp_file.replace(self.state_file)
            logger.debug(f"Saved {len(self._alerts)} alerts to {self.state_file}")
        except Exception as e:
            logger.warning(f"Failed to persist alert state to {self.state_file}: {e}")

    def _get_base_seeded_alerts(self, limit: int = 50) -> List[dict]:
        """Reads risk_reports.parquet/csv and creates fresh base alerts."""
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

        seeded = []
        if df is not None and not df.empty and "risk_score" in df.columns:
            top_flagged = df[df["risk_score"] >= RISK_MEDIUM_MAX].sort_values(
                by="risk_score", ascending=False
            ).head(limit * 2)
            for idx, (_, row) in enumerate(top_flagged.iterrows()):
                r_dict = row.to_dict()
                pid = str(r_dict.get("project_id", "")).strip()
                if not pid or pid.lower() in ("nan", "none", "null", ""):
                    continue
                alert = generate_alert(r_dict, float(r_dict.get("risk_score", 0)))
                if r_dict.get("explanations"):
                    alert["explanation"] = str(r_dict["explanations"])
                    alert["message"] = str(r_dict["explanations"])

                # Provide representative lifecycle distribution across all 4 workflow tiers
                cycle = idx % 5
                now_iso = datetime.now(timezone.utc).isoformat()
                if cycle == 1:
                    alert["status"] = "acknowledged"
                    alert["current_owner"] = "district_officer"
                    alert["status_history"] = [
                        {
                            "status": "acknowledged",
                            "updated_by": "district_officer",
                            "updated_at": now_iso,
                            "notes": "Audit flag acknowledged by District Planning Authority. On-site verification scheduled."
                        }
                    ]
                elif cycle == 2:
                    alert["status"] = "investigating"
                    alert["current_owner"] = "inspection_squad_lead"
                    alert["status_history"] = [
                        {
                            "status": "acknowledged",
                            "updated_by": "district_officer",
                            "updated_at": now_iso,
                            "notes": "Acknowledged for inquiry."
                        },
                        {
                            "status": "investigating",
                            "updated_by": "inspection_squad_lead",
                            "updated_at": now_iso,
                            "notes": "Field inspection team deployed to cross-check geotagged asset coordinates against measurement book."
                        }
                    ]
                elif cycle == 3:
                    alert["status"] = "resolved"
                    alert["current_owner"] = "state_nodal_officer"
                    alert["resolved_by"] = "state_nodal_officer"
                    alert["resolved_at"] = now_iso
                    alert["resolution_notes"] = "Joint physical audit completed. Discrepancy rectified and milestone expenditure ledger reconciled."
                    alert["status_history"] = [
                        {
                            "status": "acknowledged",
                            "updated_by": "district_officer",
                            "updated_at": now_iso,
                            "notes": "Statutory review initiated."
                        },
                        {
                            "status": "investigating",
                            "updated_by": "inspection_squad_lead",
                            "updated_at": now_iso,
                            "notes": "Site measurement verified."
                        },
                        {
                            "status": "resolved",
                            "updated_by": "state_nodal_officer",
                            "updated_at": now_iso,
                            "notes": "Joint physical audit completed. Discrepancy rectified."
                        }
                    ]
                else:
                    alert["status"] = "open"

                seeded.append(alert)
                if len(seeded) >= limit:
                    break
        return seeded

    def _load_or_seed_alerts(self, limit: int = 50):
        """
        Initializes alerts.
        If state_file exists:
            Loads persisted alerts.
            Seeds base risk data fresh from risk_reports.parquet/csv.
            Overrides lifecycle fields (status, owner, history, notes, etc.)
            for any alert present in persisted state.
            Appends any persisted alerts that weren't in the top seeded batch.
        If state_file does NOT exist:
            Seeds fresh from risk_reports.parquet/csv and saves to state_file.
        """
        persisted_alerts = []
        if self.state_file.exists():
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    persisted_alerts = json.load(f)
                logger.info(f"Loaded {len(persisted_alerts)} persisted alerts from {self.state_file}")
            except Exception as e:
                logger.warning(f"Error loading alert state from {self.state_file}: {e}")
                persisted_alerts = []

        if not persisted_alerts:
            # First run: seed fresh from risk_reports
            self._alerts.clear()
            self._alerts.extend(self._get_base_seeded_alerts(limit=limit))
            logger.info(f"Seeded {len(self._alerts)} initial lifecycle alerts into AlertEngine.")
            self._save_state()
            return

        # Merge logic:
        # Seeded alerts provide the base risk data fresh from latest risk_reports.parquet
        seeded_alerts = self._get_base_seeded_alerts(limit=limit)

        persisted_by_id = {a.get("alert_id"): a for a in persisted_alerts if a.get("alert_id")}
        persisted_by_pid = {a.get("project_id"): a for a in persisted_alerts if a.get("project_id")}

        merged_alerts = []
        matched_persisted_ids = set()

        for alert in seeded_alerts:
            pid = alert.get("project_id")
            aid = alert.get("alert_id")
            match = persisted_by_id.get(aid) or persisted_by_pid.get(pid)

            if match:
                # Keep base risk data fresh from parquet, but override lifecycle fields:
                alert["alert_id"] = match.get("alert_id", alert["alert_id"])
                alert["status"] = match.get("status", "open")
                alert["current_owner"] = match.get("current_owner")
                alert["status_history"] = match.get("status_history", [])
                alert["resolution_notes"] = match.get("resolution_notes")
                alert["resolved_by"] = match.get("resolved_by")
                alert["resolved_at"] = match.get("resolved_at")
                alert["email_sent"] = match.get("email_sent", False)
                alert["email_sent_to"] = match.get("email_sent_to")
                alert["email_sent_at"] = match.get("email_sent_at")
                alert["notification_status"] = match.get("notification_status", "pending")
                matched_persisted_ids.add(match.get("alert_id"))
            merged_alerts.append(alert)

        # Include any persisted alerts that weren't in the top seeded batch
        # (e.g. state-specific alerts seeded later or dynamically created via create_alert)
        for p in persisted_alerts:
            p_aid = p.get("alert_id")
            if p_aid and p_aid not in matched_persisted_ids:
                merged_alerts.append(p)

        self._alerts.clear()
        self._alerts.extend(merged_alerts)
        logger.info(f"Initialized AlertEngine with {len(self._alerts)} merged alerts.")
        self._save_state()

    def reload_state(self):
        """Reloads alert state from disk, simulating a server restart."""
        self._load_or_seed_alerts()

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
                if added > 0:
                    logger.info(f"Seeded {added} state-specific alerts for '{state}'.")
                    self._save_state()

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
        self._save_state()
        self._log_audit_event(
            action="ALERT_CREATED",
            alert_id=alert["alert_id"],
            actor="SYSTEM_DETECTION_ENGINE",
            details={
                "project_id": alert.get("project_id"),
                "risk_score": risk_score,
                "severity": alert.get("severity"),
                "explanation": explanation
            }
        )
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

    # ── Audit Trail (Append-Only JSONL) ────────────────────────────────────────

    def _log_audit_event(self, action: str, alert_id: str, actor: str, details: dict):
        """Appends an immutable audit event entry to audit_trail.jsonl."""
        try:
            AUDIT_TRAIL_PATH.parent.mkdir(parents=True, exist_ok=True)
            event = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": action,
                "alert_id": alert_id,
                "actor": actor,
                "details": details
            }
            with open(AUDIT_TRAIL_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(event) + "\n")
        except Exception as e:
            logger.warning(f"Failed to append to audit trail: {e}")

    def get_audit_trail(self, alert_id: Optional[str] = None, limit: int = 100) -> List[dict]:
        """Reads persisted audit trail from disk."""
        events = []
        if AUDIT_TRAIL_PATH.exists():
            try:
                with open(AUDIT_TRAIL_PATH, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            entry = json.loads(line)
                            if alert_id is None or entry.get("alert_id") == alert_id:
                                events.append(entry)
            except Exception as e:
                logger.warning(f"Error reading audit trail: {e}")
        return events[-limit:]

    # ── Lifecycle transitions ──────────────────────────────────────────────────

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str, notes: str = "") -> dict:
        """Transition alert to 'acknowledged' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "acknowledged"
        alert["current_owner"] = acknowledged_by
        self._append_history(alert, "acknowledged", acknowledged_by, notes)
        self._save_state()
        self._log_audit_event(
            action="ALERT_ACKNOWLEDGED",
            alert_id=alert_id,
            actor=acknowledged_by,
            details={"notes": notes, "status": "acknowledged"}
        )
        return alert

    def start_investigation(self, alert_id: str, investigator: str, notes: str = "") -> dict:
        """Transition alert to 'investigating' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "investigating"
        alert["current_owner"] = investigator
        self._append_history(alert, "investigating", investigator, notes)
        self._save_state()
        self._log_audit_event(
            action="ALERT_INVESTIGATION_STARTED",
            alert_id=alert_id,
            actor=investigator,
            details={"notes": notes, "status": "investigating"}
        )
        return alert

    def resolve_alert(self, alert_id: str, resolved_by: str, resolution_notes: str) -> dict:
        """Transition alert to 'resolved' status."""
        alert = self._find_or_raise(alert_id)
        alert["status"] = "resolved"
        alert["resolved_by"] = resolved_by
        alert["resolved_at"] = datetime.now(timezone.utc).isoformat()
        alert["resolution_notes"] = resolution_notes
        self._append_history(alert, "resolved", resolved_by, resolution_notes)
        self._save_state()
        self._log_audit_event(
            action="ALERT_RESOLVED",
            alert_id=alert_id,
            actor=resolved_by,
            details={"resolution_notes": resolution_notes, "status": "resolved"}
        )
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
