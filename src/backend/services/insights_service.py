"""
MPLADS Ministry Insights Service
Generates national-level policy insights and deep forensic drilldowns from the real risk_reports dataset.
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
    """Generates policy insights and deep forensic drilldown payloads from scored MPLADS project data."""

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
        """Compute all four policy insights with deep structured drilldown payloads from master dataset."""
        df = self._load()
        insights = []

        if df.empty:
            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_projects_analyzed": 0,
                "insights": [{"id": "none", "title": "No data", "finding": "Risk dataset not yet generated.", "impact": "", "recommendation": "Run the scoring pipeline first.", "drilldown": {}}],
            }

        total = len(df)

        # ── Insight 1: Risk Distribution Overview ────────────────────────────
        low_risk = len(df[df["risk_score"] < 40]) if "risk_score" in df.columns else 0
        med_risk = len(df[(df["risk_score"] >= 40) & (df["risk_score"] < 60)]) if "risk_score" in df.columns else 0
        high_risk = len(df[(df["risk_score"] >= 60) & (df["risk_score"] < 80)]) if "risk_score" in df.columns else 0
        critical_risk = len(df[df["risk_score"] >= 80]) if "risk_score" in df.columns else 0

        high_pct = _safe_pct(high_risk + critical_risk, total)
        crit_pct = _safe_pct(critical_risk, total)

        # Top high risk states
        state_crit = (
            df[df["risk_score"] >= 60]
            .groupby("state")["project_id"]
            .count()
            .reset_index()
            .rename(columns={"project_id": "flagged_count"})
            .sort_values(by="flagged_count", ascending=False)
            .head(6)
            .to_dict(orient="records")
        ) if "state" in df.columns and "risk_score" in df.columns else []

        # Category breakdown
        cat_risk = (
            df.groupby("category")
            .agg(
                count=("project_id", "count"),
                avg_risk=("risk_score", "mean"),
                critical_count=("risk_score", lambda s: (s >= 80).sum())
            )
            .reset_index()
            .sort_values(by="count", ascending=False)
            .head(6)
        )
        cat_risk["avg_risk"] = cat_risk["avg_risk"].round(1)
        cat_risk_list = cat_risk.to_dict(orient="records")

        # Top 10 critical projects
        crit_projects = []
        if "risk_score" in df.columns:
            top_crit = df.sort_values(by="risk_score", ascending=False).head(10)
            for _, r in top_crit.iterrows():
                crit_projects.append({
                    "project_id": str(r.get("project_id", "")),
                    "category": str(r.get("category", "General")),
                    "district": str(r.get("district", "N/A")),
                    "state": str(r.get("state", "N/A")),
                    "amount_sanctioned": float(pd.to_numeric(r.get("amount_sanctioned", 0), errors="coerce") or 0),
                    "amount_spent": float(pd.to_numeric(r.get("amount_spent", 0), errors="coerce") or 0),
                    "risk_score": int(round(pd.to_numeric(r.get("risk_score", 0), errors="coerce") or 0)),
                    "contractor": str(r.get("contractor", "N/A"))
                })

        risk_rec = (
            "Prioritise audit resources on the top 5% risk-scored projects first. "
            "Deploy district-level review teams to high-concentration states."
        )
        if high_pct > 30:
            risk_rec = (
                f"Immediate action required: {high_pct}% of projects are flagged High/Critical Risk. "
                "Consider mandatory geo-tagging and mid-project cost audits for all new sanctions."
            )

        insights.append({
            "id": "risk_distribution",
            "title": "⚠️ National Risk Distribution",
            "severity": "critical",
            "finding": (
                f"{high_pct}% of projects ({high_risk + critical_risk:,}) carry Elevated Risk; "
                f"{crit_pct}% ({critical_risk:,}) are Critical (score ≥ 80)."
            ),
            "impact": "Concentrated risk indicates potential systemic implementation failures in specific states or categories.",
            "recommendation": risk_rec,
            "drilldown": {
                "summary": f"Comprehensive analysis across {total:,} projects shows that {critical_risk:,} projects exceed the Critical Risk threshold (≥80/100).",
                "risk_tiers": [
                    {"tier": "Low (0-39)", "count": low_risk, "pct": _safe_pct(low_risk, total), "color": "#22c55e"},
                    {"tier": "Medium (40-59)", "count": med_risk, "pct": _safe_pct(med_risk, total), "color": "#f59e0b"},
                    {"tier": "High (60-79)", "count": high_risk, "pct": _safe_pct(high_risk, total), "color": "#f97316"},
                    {"tier": "Critical (≥80)", "count": critical_risk, "pct": _safe_pct(critical_risk, total), "color": "#ef4444"}
                ],
                "top_flagged_states": state_crit,
                "category_breakdown": cat_risk_list,
                "top_entities": crit_projects,
                "policy_playbook": [
                    "Freeze tranche disbursement for projects scoring ≥ 80 until joint physical audit report is submitted.",
                    "Enforce mandatory geo-tagged photographic evidence at 25%, 50%, and 75% expenditure milestones.",
                    "Mandate third-party quality testing by state engineering institutions for works over ₹50 Lakh."
                ]
            }
        })

        # ── Insight 2: Contractor Concentration ──────────────────────────────
        if "contractor" in df.columns:
            contractor_counts = Counter(df["contractor"].dropna().astype(str))
            top5_count = sum(c for _, c in contractor_counts.most_common(5))
            top5_pct = _safe_pct(top5_count, total)
            top_contractor, top_count = contractor_counts.most_common(1)[0]

            top10_tuples = contractor_counts.most_common(10)
            top10_names = [n for n, _ in top10_tuples]
            top10_df = df[df["contractor"].astype(str).isin(top10_names)]

            # Herfindahl-Hirschman Index (HHI)
            total_contracts = sum(contractor_counts.values())
            hhi_score = round(sum((count / total_contracts * 100) ** 2 for count in contractor_counts.values()), 1)

            top10_table = []
            for name, cnt in top10_tuples:
                c_df = top10_df[top10_df["contractor"].astype(str) == name]
                sanc_sum = float(pd.to_numeric(c_df.get("amount_sanctioned", 0), errors="coerce").sum())
                avg_risk = round(float(pd.to_numeric(c_df.get("risk_score", 0), errors="coerce").mean()), 1)
                crit_cnt = int((pd.to_numeric(c_df.get("risk_score", 0), errors="coerce") >= 60).sum())
                top10_table.append({
                    "contractor": name,
                    "project_count": cnt,
                    "total_sanctioned_cr": round(sanc_sum / 1e7, 2),
                    "avg_risk_score": avg_risk,
                    "elevated_risk_count": crit_cnt,
                    "market_share_pct": round(cnt / total * 100, 2)
                })

            top5_avg_risk = round(float(pd.to_numeric(top10_df.head(5).get("risk_score", pd.Series()), errors="coerce").mean()), 1) if len(top10_df) else 0.0

            insights.append({
                "id": "contractor_concentration",
                "title": "🏢 Contractor Concentration Risk",
                "severity": "high",
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
                "drilldown": {
                    "summary": f"Market concentration analysis identifies an HHI Index of {hhi_score}. The top 10 contractors control ₹{sum(r['total_sanctioned_cr'] for r in top10_table):,.1f} Cr in sanctioned public works.",
                    "hhi_index": hhi_score,
                    "hhi_classification": "Moderate Oligopoly Concentration" if hhi_score > 100 else "Dispersed Competition",
                    "top_contractors": top10_table,
                    "top_entities": top10_table,
                    "policy_playbook": [
                        "Enforce maximum 3% portfolio allocation ceiling per individual vendor entity across parliamentary constituencies.",
                        "Require mandatory 10% performance security bank guarantees for contractors managing more than 10 concurrent public works.",
                        "Establish cross-district vigilance blacklists: disqualification in one district immediately pauses tenders nationwide."
                    ]
                }
            })

        # ── Insight 3: State Performance Gap ─────────────────────────────────
        if "state" in df.columns and "risk_score" in df.columns:
            state_grp = (
                df.groupby("state")
                .agg(
                    avg_risk=("risk_score", "mean"),
                    projects=("project_id", "count"),
                    total_sanctioned=("amount_sanctioned", "sum"),
                    avg_progress=("progress_percentage", "mean")
                )
                .reset_index()
            )
            state_grp["avg_risk"] = state_grp["avg_risk"].round(1)
            state_grp["avg_progress"] = state_grp["avg_progress"].round(1)
            state_grp["total_sanctioned_cr"] = (state_grp["total_sanctioned"] / 1e7).round(2)
            state_grp = state_grp.sort_values(by="avg_risk", ascending=True)

            qualified = state_grp[state_grp["projects"] >= 20]
            if len(qualified) >= 2:
                best = qualified.iloc[0]
                worst = qualified.iloc[-1]
                gap = round(float(worst["avg_risk"]) - float(best["avg_risk"]), 1)

                all_states_table = state_grp.to_dict(orient="records")
                top5_states = qualified.head(5).to_dict(orient="records")
                bottom5_states = qualified.tail(5).sort_values(by="avg_risk", ascending=False).to_dict(orient="records")

                insights.append({
                    "id": "state_performance",
                    "title": "📊 State Performance Gap",
                    "severity": "medium",
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
                    "drilldown": {
                        "summary": f"National comparative benchmarking shows a {gap:.1f} risk score point spread between benchmark leader '{best['state']}' and lagging state '{worst['state']}'.",
                        "gap_points": gap,
                        "best_state": str(best['state']),
                        "worst_state": str(worst['state']),
                        "top_5_states": top5_states,
                        "bottom_5_states": bottom5_states,
                        "state_rankings": all_states_table,
                        "top_entities": all_states_table[:15],
                        "policy_playbook": [
                            f"Initiate MoSPI peer-learning exchanges between {best['state']} executing agencies and {worst['state']} district collectors.",
                            "Implement conditional fund releases linked to timely milestone reporting and DPR quality sign-offs.",
                            "Establish automated state oversight dashboards with real-time alerting for project delays exceeding 90 days."
                        ]
                    }
                })

        # ── Insight 4: Cost Overrun Trend ─────────────────────────────────────
        if "amount_sanctioned" in df.columns and "amount_spent" in df.columns:
            sanc = pd.to_numeric(df["amount_sanctioned"], errors="coerce").fillna(0)
            spent = pd.to_numeric(df["amount_spent"], errors="coerce").fillna(0)
            overrun_ratio = (spent - sanc) / (sanc.replace(0, 1))

            tier_0_10 = ((overrun_ratio >= 0.0) & (overrun_ratio <= 0.10) & (sanc > 0)).sum()
            tier_10_20 = ((overrun_ratio > 0.10) & (overrun_ratio <= 0.20) & (sanc > 0)).sum()
            tier_20_50 = ((overrun_ratio > 0.20) & (overrun_ratio <= 0.50) & (sanc > 0)).sum()
            tier_gt_50 = ((overrun_ratio > 0.50) & (sanc > 0)).sum()

            overrun_20 = ((spent > sanc * 1.20) & (sanc > 0)).sum()
            overrun_pct = _safe_pct(int(overrun_20), total)
            excess_cr = round(float((spent.clip(upper=sanc * 2.0) - sanc).clip(lower=0).sum()) / 1e7, 1)

            # Top 10 overrun projects
            df_overrun = df.copy()
            df_overrun["overrun_amt"] = (spent - sanc).clip(lower=0)
            df_overrun["overrun_pct"] = (overrun_ratio * 100.0).clip(lower=0)
            top_overrun_records = []
            for _, r in df_overrun.sort_values(by="overrun_amt", ascending=False).head(10).iterrows():
                top_overrun_records.append({
                    "project_id": str(r.get("project_id", "")),
                    "category": str(r.get("category", "General")),
                    "district": str(r.get("district", "N/A")),
                    "state": str(r.get("state", "N/A")),
                    "amount_sanctioned": float(pd.to_numeric(r.get("amount_sanctioned", 0), errors="coerce") or 0),
                    "amount_spent": float(pd.to_numeric(r.get("amount_spent", 0), errors="coerce") or 0),
                    "excess_expenditure": float(round(r.get("overrun_amt", 0), 2)),
                    "overrun_pct": float(round(r.get("overrun_pct", 0), 1)),
                    "contractor": str(r.get("contractor", "N/A"))
                })

            insights.append({
                "id": "cost_inflation",
                "title": "💰 Cost Inflation & Overrun Trend",
                "severity": "critical",
                "finding": (
                    f"{overrun_pct}% of projects ({overrun_20:,}) have spending >20% over sanctioned amount. "
                    f"{tier_gt_50:,} projects exceed sanction by >50%. "
                    f"Estimated excess expenditure: ₹{excess_cr} Cr."
                ),
                "impact": "Unchecked overruns erode fund utilisation efficiency and may indicate contractor fraud or weak DPR quality.",
                "recommendation": (
                    "Mandate pre-disbursement cost audits for projects requesting >15% overspend. "
                    "Tighten DPR (Detailed Project Report) quality checks at sanction stage."
                ),
                "drilldown": {
                    "summary": f"Cost inflation analysis detects an aggregate excess outlay of ₹{excess_cr:,} Cr across {overrun_20:,} projects spending >20% above sanctioned ceilings.",
                    "excess_cr": excess_cr,
                    "overrun_tiers": [
                        {"tier": "0-10% (Nominal)", "count": int(tier_0_10), "pct": _safe_pct(int(tier_0_10), total), "color": "#22c55e"},
                        {"tier": "10-20% (Moderate)", "count": int(tier_10_20), "pct": _safe_pct(int(tier_10_20), total), "color": "#f59e0b"},
                        {"tier": "20-50% (High)", "count": int(tier_20_50), "pct": _safe_pct(int(tier_20_50), total), "color": "#f97316"},
                        {"tier": ">50% (Extreme)", "count": int(tier_gt_50), "pct": _safe_pct(int(tier_gt_50), total), "color": "#ef4444"}
                    ],
                    "top_entities": top_overrun_records,
                    "policy_playbook": [
                        "Mandate pre-disbursement price escalation approval from State Finance Department for variances exceeding 10%.",
                        "Implement standard item-rate schedule benchmarking across contiguous districts to eliminate inflated estimates.",
                        "Conduct forensic measurement book reconciliation prior to final tranche settlement for any project with >20% cost expansion."
                    ]
                }
            })

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_projects_analyzed": total,
            "insights": insights,
        }


# Singleton
insights_service = InsightsService()
