"""
MPLADS Ministry Insights Service
Generates national-level policy insights from the real risk_reports dataset.
"""

import logging
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path
import sys

import pandas as pd
import numpy as np

sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import RISK_REPORTS_PARQUET, RISK_REPORTS_CSV

logger = logging.getLogger("InsightsService")


def _safe_pct(part: int, total: int) -> float:
    return round(part / total * 100, 1) if total else 0.0


class InsightsService:
    """Generates policy insights from scored MPLADS project data."""

    def __init__(self):
        self._df: pd.DataFrame | None = None

    def _load(self) -> pd.DataFrame:
        if self._df is not None:
            return self._df
        if RISK_REPORTS_PARQUET.exists():
            self._df = pd.read_parquet(RISK_REPORTS_PARQUET)
        elif RISK_REPORTS_CSV.exists():
            self._df = pd.read_csv(RISK_REPORTS_CSV, low_memory=False)
        else:
            self._df = pd.DataFrame()
        return self._df

    def get_national_insights(self) -> dict:
        """Compute all four policy insights from real data."""
        df = self._load()
        insights = []

        if df.empty:
            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_projects_analyzed": 0,
                "insights": [{"title": "No data", "finding": "Risk dataset not yet generated.", "impact": "", "recommendation": "Run the scoring pipeline first."}],
            }

        total = len(df)

        # ── Insight 1: Risk Distribution Overview ────────────────────────────
        high_risk = len(df[df["risk_category"].astype(str).str.lower() == "high"])
        critical_risk = len(df[df["risk_score"] >= 80]) if "risk_score" in df.columns else 0
        high_pct = _safe_pct(high_risk, total)
        crit_pct = _safe_pct(critical_risk, total)

        risk_rec = (
            "Prioritise audit resources on the top 5% risk-scored projects first. "
            "Deploy district-level review teams to high-concentration states."
        )
        if high_pct > 30:
            risk_rec = (
                f"Immediate action required: {high_pct}% of projects are flagged High Risk. "
                "Consider mandatory geo-tagging and mid-project cost audits for all new sanctions."
            )

        insights.append({
            "title": "⚠️ National Risk Distribution",
            "finding": (
                f"{high_pct}% of projects ({high_risk:,}) are High Risk; "
                f"{crit_pct}% ({critical_risk:,}) are Critical (score ≥ 80)."
            ),
            "impact": "Concentrated risk indicates potential systemic implementation failures in specific states or categories.",
            "recommendation": risk_rec,
        })

        # ── Insight 2: Contractor Concentration ──────────────────────────────
        if "contractor" in df.columns:
            contractor_counts = Counter(df["contractor"].dropna().astype(str))
            top5_count = sum(c for _, c in contractor_counts.most_common(5))
            top5_pct = _safe_pct(top5_count, total)
            top_contractor, top_count = contractor_counts.most_common(1)[0]

            # Average risk of top-5 contractor projects
            top5_names = [n for n, _ in contractor_counts.most_common(5)]
            top5_df = df[df["contractor"].astype(str).isin(top5_names)]
            top5_avg_risk = round(float(pd.to_numeric(top5_df.get("risk_score", pd.Series()), errors="coerce").mean()), 1) if len(top5_df) else 0.0

            insights.append({
                "title": "🏢 Contractor Concentration Risk",
                "finding": (
                    f"Top 5 contractors handle {top5_pct}% of all projects. "
                    f"'{top_contractor}' alone handles {top_count:,} projects. "
                    f"Average risk score of top-5 portfolios: {top5_avg_risk}/100."
                ),
                "impact": "Over-reliance on a small contractor base creates single-point-of-failure risk. A contractor default cascades to hundreds of projects.",
                "recommendation": (
                    "Introduce a per-contractor project cap (e.g., max 3% of national portfolio). "
                    "Require performance bonds for contractors with >50 active projects."
                ),
            })

        # ── Insight 3: State Performance Gap ─────────────────────────────────
        if "state" in df.columns and "risk_score" in df.columns:
            state_risk = (
                df.groupby("state")["risk_score"]
                .agg(["mean", "count"])
                .reset_index()
                .rename(columns={"mean": "avg_risk", "count": "projects"})
            )
            state_risk = state_risk[state_risk["projects"] >= 50]  # min sample
            if len(state_risk) >= 2:
                best = state_risk.loc[state_risk["avg_risk"].idxmin()]
                worst = state_risk.loc[state_risk["avg_risk"].idxmax()]
                gap = round(float(worst["avg_risk"]) - float(best["avg_risk"]), 1)

                insights.append({
                    "title": "📊 State Performance Gap",
                    "finding": (
                        f"Best performer: {best['state']} (avg risk {best['avg_risk']:.1f}/100, {int(best['projects'])} projects). "
                        f"Worst performer: {worst['state']} (avg risk {worst['avg_risk']:.1f}/100, {int(worst['projects'])} projects). "
                        f"Performance gap: {gap} risk score points."
                    ),
                    "impact": f"{worst['state']} projects carry {gap:.0f}% higher average risk, suggesting systemic implementation or oversight issues.",
                    "recommendation": (
                        f"Deploy capacity-building teams from {best['state']} experience to {worst['state']}. "
                        "Benchmark implementation best-practices and standardise reporting."
                    ),
                })

        # ── Insight 4: Cost Overrun Trend ─────────────────────────────────────
        if "amount_sanctioned" in df.columns and "amount_spent" in df.columns:
            sanc = pd.to_numeric(df["amount_sanctioned"], errors="coerce").fillna(0)
            spent = pd.to_numeric(df["amount_spent"], errors="coerce").fillna(0)
            overrun_20 = ((spent > sanc * 1.20) & (sanc > 0)).sum()
            overrun_50 = ((spent > sanc * 1.50) & (sanc > 0)).sum()
            overrun_pct = _safe_pct(int(overrun_20), total)
            excess_cr = round(float((spent.clip(upper=sanc * 2.0) - sanc).clip(lower=0).sum()) / 1e7, 1)

            insights.append({
                "title": "💰 Cost Inflation & Overrun Trend",
                "finding": (
                    f"{overrun_pct}% of projects ({overrun_20:,}) have spending >20% over sanctioned amount. "
                    f"{overrun_50:,} projects exceed sanction by >50%. "
                    f"Estimated excess expenditure: ₹{excess_cr} Cr."
                ),
                "impact": "Unchecked overruns erode fund utilisation efficiency and may indicate contractor fraud or weak DPR quality.",
                "recommendation": (
                    "Mandate pre-disbursement cost audits for projects requesting >15% overspend. "
                    "Tighten DPR (Detailed Project Report) quality checks at sanction stage."
                ),
            })

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_projects_analyzed": total,
            "insights": insights,
        }


# Singleton
insights_service = InsightsService()
