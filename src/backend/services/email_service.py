"""
MPLADS Email Notification Service
Sends alert emails to appropriate role authorities when anomalies are detected.
Demo mode (default): logs email content to console without real SMTP.
Production mode: enable via ENABLE_SMTP=true environment variable.
"""

import smtplib
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("EmailService")


class EmailService:
    """Email notification service for MPLAD alerts."""

    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("SENDER_EMAIL", "mplad-alerts@mospi.gov.in")
        self.sender_password = os.getenv("SENDER_PASSWORD", "")
        self.enable_smtp = os.getenv("ENABLE_SMTP", "false").lower() == "true"

    # ── Role metadata ─────────────────────────────────────────────────────────

    ROLE_EMAILS = {
        "mp": "mp@parliament.gov.in",
        "district": "district@mplads.gov.in",
        "state": "state@mplads.gov.in",
        "ministry": "ministry@mospi.gov.in",
    }

    ROLE_ACTIONS = {
        "mp": (
            "Request a detailed status update from your District Authority. "
            "Ask specifically about the cost variance and timeline concerns. "
            "Escalate to the State Nodal Officer if a satisfactory explanation "
            "is not received within 7 days."
        ),
        "district": (
            "Verify project status on ground immediately. "
            "Review contractor capacity and existing delays. "
            "If cost overrun is unjustified, prepare a remedial action plan "
            "and submit your investigation report within 3 days."
        ),
        "state": (
            "Coordinate with the District Authority for an investigation. "
            "Cross-check with tender and approval documents. "
            "If fraud is suspected, escalate to CBI/Vigilance at once. "
            "Update status within 5 days."
        ),
        "ministry": (
            "Add to monthly oversight dashboard. "
            "Monitor high-risk projects nationally and analyse cross-state trends. "
            "Prepare quarterly compliance report and provide policy recommendations "
            "if systematic issues are identified."
        ),
    }

    # ── Public API ─────────────────────────────────────────────────────────────

    def get_recipient_email(self, role: str) -> str:
        """Return canonical demo email address for a given role."""
        return self.ROLE_EMAILS.get(role.lower(), "admin@mplads.gov.in")

    def send_alert_email(
        self,
        recipient_email: str,
        recipient_role: str,
        alert_data: dict,
    ) -> dict:
        """
        Send (or log in demo mode) an alert email to the recipient.

        Returns a status dict with keys:
            success (bool), mode (str), message (str),
            recipient (str), timestamp (str), [error (str)]
        """
        subject = self._build_subject(alert_data)
        plain_body = self._build_plain_body(recipient_role, alert_data)
        html_body = self._build_html_body(recipient_role, alert_data)
        timestamp = datetime.now(timezone.utc).isoformat()

        # ── Demo mode ────────────────────────────────────────────────────────
        if not self.enable_smtp:
            logger.info("[DEMO EMAIL] ═══════════════════════════════════════════")
            logger.info(f"[DEMO EMAIL] To      : {recipient_email}")
            logger.info(f"[DEMO EMAIL] Role    : {recipient_role.upper()}")
            logger.info(f"[DEMO EMAIL] Subject : {subject}")
            logger.info(f"[DEMO EMAIL] Body    :\n{plain_body}")
            logger.info("[DEMO EMAIL] ═══════════════════════════════════════════")
            return {
                "success": True,
                "mode": "demo",
                "message": "Email content logged to console (SMTP disabled — set ENABLE_SMTP=true for real delivery)",
                "recipient": recipient_email,
                "timestamp": timestamp,
            }

        # ── Production SMTP ──────────────────────────────────────────────────
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.sender_email
            msg["To"] = recipient_email
            msg.attach(MIMEText(plain_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, recipient_email, msg.as_string())

            logger.info(f"Alert email sent to {recipient_email}")
            return {
                "success": True,
                "mode": "production",
                "message": "Email sent successfully via SMTP",
                "recipient": recipient_email,
                "timestamp": timestamp,
            }
        except Exception as exc:
            logger.error(f"Failed to send alert email: {exc}")
            return {
                "success": False,
                "mode": "production",
                "error": str(exc),
                "recipient": recipient_email,
                "timestamp": timestamp,
            }

    # ── Private helpers ────────────────────────────────────────────────────────

    def _build_subject(self, data: dict) -> str:
        score = data.get("risk_score", 0)
        pid = data.get("project_id", "UNKNOWN")
        prefix = "[CRITICAL]" if score >= 80 else "[HIGH]" if score >= 60 else "[MEDIUM]"
        return f"{prefix} MPLAD Alert: Project {pid} — Risk Score {score:.0f}/100"

    def _build_plain_body(self, role: str, data: dict) -> str:
        action = self.ROLE_ACTIONS.get(role.lower(), self.ROLE_ACTIONS["district"])
        return (
            f"MPLAD ANOMALY DETECTION ALERT\n{'=' * 60}\n\n"
            f"ALERT DETAILS:\n"
            f"  Alert ID     : {data.get('alert_id', 'N/A')}\n"
            f"  Project ID   : {data.get('project_id', 'N/A')}\n"
            f"  Approval ID  : {data.get('approval_id', 'N/A')}\n"
            f"  Risk Score   : {data.get('risk_score', 0):.1f}/100\n"
            f"  Risk Category: {str(data.get('risk_category', 'UNKNOWN')).upper()}\n"
            f"  Created      : {data.get('created_at', 'N/A')}\n\n"
            f"EXPLANATION:\n{data.get('explanation', 'No explanation available')}\n\n"
            f"RECOMMENDED ACTION FOR {role.upper()}:\n{action}\n\n"
            f"NEXT STEPS:\n"
            f"  1. Log in to the MPLAD dashboard: http://localhost:3000/\n"
            f"  2. Navigate to Alerts section\n"
            f"  3. Acknowledge and investigate this alert\n"
            f"  4. Update resolution status when complete\n\n"
            f"{'=' * 60}\n"
            f"This is an automated alert. Do not reply to this email.\n"
            f"Support: mplad-support@mospi.gov.in\n"
        )

    def _build_html_body(self, role: str, data: dict) -> str:
        score = data.get("risk_score", 0)
        action = self.ROLE_ACTIONS.get(role.lower(), self.ROLE_ACTIONS["district"])
        color = "#dc3545" if score >= 80 else "#fd7e14" if score >= 60 else "#ffc107"
        severity = "CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MEDIUM"

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}}
    .wrap {{max-width:620px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.12);}}
    .hdr {{background:{color};color:#fff;padding:24px 28px;}}
    .hdr h2 {{margin:0 0 6px;font-size:22px;}}
    .hdr p {{margin:0;opacity:.88;font-size:14px;}}
    .body {{padding:28px;}}
    .field {{display:flex;gap:10px;margin:8px 0;font-size:14px;}}
    .label {{font-weight:700;color:#555;min-width:120px;}}
    .action-box {{background:#e8f4fd;border-left:4px solid #2196f3;padding:16px;border-radius:4px;margin:18px 0;}}
    .action-box h4 {{margin:0 0 8px;color:#1565c0;}}
    .action-box p {{margin:0;font-size:14px;}}
    .btn {{display:inline-block;background:{color};color:#fff;padding:10px 22px;border-radius:5px;text-decoration:none;font-weight:700;margin-top:10px;}}
    .footer {{font-size:12px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:12px;}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h2>🚨 MPLAD ALERT — {severity}</h2>
      <p>Project {data.get('project_id', 'N/A')} has been flagged for review</p>
    </div>
    <div class="body">
      <h3>Alert Summary</h3>
      <div class="field"><span class="label">Risk Score</span><span>{score:.0f}/100</span></div>
      <div class="field"><span class="label">Category</span><span>{str(data.get('risk_category','Unknown')).upper()}</span></div>
      <div class="field"><span class="label">Project ID</span><span>{data.get('project_id','N/A')}</span></div>
      <div class="field"><span class="label">Alert ID</span><span>{data.get('alert_id','N/A')}</span></div>
      <div class="field"><span class="label">Timestamp</span><span>{data.get('created_at','N/A')}</span></div>

      <h3>What We Found</h3>
      <p style="font-size:14px;color:#333;">{data.get('explanation','No explanation available')}</p>

      <div class="action-box">
        <h4>👉 Your Action Item ({role.upper()})</h4>
        <p>{action}</p>
      </div>

      <a href="http://localhost:3000/alerts" class="btn">Review in Dashboard →</a>

      <div class="footer">
        <p>Alert ID: {data.get('alert_id','N/A')}</p>
        <p>This is an automated alert from the MPLAD AI Monitoring System.
           Do not reply. Support: mplad-support@mospi.gov.in</p>
      </div>
    </div>
  </div>
</body>
</html>"""


# Singleton instance
email_service = EmailService()
