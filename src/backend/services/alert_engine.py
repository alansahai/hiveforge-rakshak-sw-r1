import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from pathlib import Path

# Adjust python path
import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import RISK_REPORTS_CSV, RISK_HIGH_MAX, RISK_MEDIUM_MAX

logger = logging.getLogger("AlertEngine")

_ACTIVE_ALERTS: List[Dict[str, Any]] = []

def should_alert(risk_score: float) -> bool:
    """Returns True if project risk score justifies alert creation (> 60)."""
    return risk_score >= RISK_MEDIUM_MAX

def generate_alert(project_data: dict, risk_score: float) -> dict:
    """Creates structured alert payload with severity, recipients, and message."""
    proj_id = project_data.get('project_id', 'PROJ-UNKNOWN')
    state = project_data.get('state', 'National')
    district = project_data.get('district', 'District')
    mp = project_data.get('mp_name', 'Honble MP')
    
    if risk_score >= RISK_HIGH_MAX:
        severity = "critical"
        alert_type = "fraud_anomaly"
        recipients = [f"MP Office ({mp})", f"District Magistrate ({district})", f"State Nodal Officer ({state})", "MoSPI Monitoring Wing"]
        msg = f"CRITICAL RISK ALERT: Project {proj_id} flagged with composite risk score {risk_score:.0f}/100. Immediate audit and payment freeze advised."
    else:
        severity = "high"
        alert_type = "inefficiency_risk"
        recipients = [f"MP Office ({mp})", f"District Planning Authority ({district})"]
        msg = f"HIGH RISK ALERT: Project {proj_id} flagged with risk score {risk_score:.0f}/100 due to milestone delay or budget variation."
        
    alert_id = f"ALT-{int(datetime.now().timestamp())}-{proj_id.replace('/', '_')}"
    
    alert = {
        "alert_id": alert_id,
        "project_id": proj_id,
        "risk_score": int(risk_score),
        "alert_type": alert_type,
        "severity": severity,
        "state": state,
        "district": district,
        "message": msg,
        "recipients": recipients,
        "created_at": datetime.now().isoformat(),
        "resolved_at": None
    }
    return alert

def store_alert(alert: dict) -> None:
    """Stores alert in memory storage."""
    _ACTIVE_ALERTS.append(alert)

def escalate_alert(alert_id: str, new_severity: str = "critical") -> Optional[dict]:
    """Escalates an existing alert."""
    for alert in _ACTIVE_ALERTS:
        if alert['alert_id'] == alert_id:
            alert['severity'] = new_severity
            alert['message'] = f"ESCALATED: {alert['message']}"
            return alert
    return None

def get_unresolved_alerts(severity: Optional[str] = None, state: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieves unresolved alerts from master risk report CSV or active memory alerts.
    """
    alerts = []
    
    # Check if we have pre-generated alerts from batch risk report
    if RISK_REPORTS_CSV.exists():
        try:
            df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
            flagged = df[df['risk_score'] >= RISK_MEDIUM_MAX].copy()
            if state:
                flagged = flagged[flagged['state'].astype(str).str.lower() == state.lower()]
            if severity:
                flagged = flagged[flagged['risk_category'].astype(str).str.lower() == severity.lower()]
                
            flagged = flagged.sort_values(by='risk_score', ascending=False).head(limit)
            
            for _, row in flagged.iterrows():
                alert = generate_alert(row.to_dict(), float(row['risk_score']))
                alerts.append(alert)
        except Exception as e:
            logger.warning(f"Failed to read alerts from risk reports CSV: {str(e)}")
            
    # Also include in-memory created alerts
    for a in _ACTIVE_ALERTS:
        if not a.get('resolved_at'):
            if state and a.get('state', '').lower() != state.lower():
                continue
            if severity and a.get('severity', '').lower() != severity.lower():
                continue
            alerts.append(a)
            
    return alerts[:limit]
