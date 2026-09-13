"""
MPLADS Compliance Engine
Implements modular, configuration-driven compliance monitoring in accordance with
the Ministry of Statistics and Programme Implementation (MoSPI) MPLADS Guidelines.

Rules:
- RULE_A_FINANCIAL_LIMIT: Annual cumulative MP ceiling (default ₹5 Crore/year).
- RULE_B_SC_ALLOCATION: Mandatory 15% allocation for Scheduled Caste inhabited areas.
- RULE_C_ST_ALLOCATION: Mandatory 7.5% allocation for Scheduled Tribe inhabited areas.
- RULE_D_PROHIBITED_WORKS: Configurable prohibited works filter (religious, private, commercial, etc.).
- RULE_E_COMPLIANCE_SUMMARY: Composite compliance determination.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd
import numpy as np

logger = logging.getLogger("MPLADSComplianceEngine")

# ── Configuration Defaults ───────────────────────────────────────────────────

DEFAULT_ANNUAL_CEILING_INR = 50_000_000.0  # ₹5 Crore per MP per financial year
DEFAULT_SC_ALLOCATION_PCT = 15.0           # 15% mandatory SC allocation
DEFAULT_ST_ALLOCATION_PCT = 7.5            # 7.5% mandatory ST allocation

# Prohibited work categories and keywords / phrases
PROHIBITED_CATEGORIES = {
    "RELIGIOUS_STRUCTURE": {
        "description": "Places of worship, religious institutions, or sectarian structures",
        "severity": "CRITICAL",
        "keywords": [
            "temple", "mandir", "mosque", "masjid", "church", "gurudwara", 
            "ashram", "monastery", "derasar", "shrine", "dargah", "idgah",
            "prayer hall", "matha", "madrasa", "grave", "graveyard", "kabristan",
            "crematorium shed religious", "samadhi"
        ]
    },
    "PRIVATE_BENEFIT": {
        "description": "Works on private property or for exclusive private/commercial benefit",
        "severity": "HIGH",
        "keywords": [
            "private residence", "private house", "individual boundary wall",
            "private compound", "private school compound", "private trust building",
            "personal office", "commercial shop", "commercial mall", "private factory",
            "private farm", "individual well for private use"
        ]
    },
    "PROHIBITED_GRANTS_GIFTS": {
        "description": "Direct grants, loans, inventory, or movable assets for individuals",
        "severity": "CRITICAL",
        "keywords": [
            "cash grant", "individual loan", "personal laptop", "free tablet to individual",
            "personal computer gift", "direct cash assistance", "individual subsidy",
            "revenue expenditure", "recurring grant", "staff salary"
        ]
    },
    "PRIVATE_CLUBS_ASSOCIATIONS": {
        "description": "Private clubs, gated societies, or non-public associations",
        "severity": "MEDIUM",
        "keywords": [
            "golf club", "exclusive club", "private society gym", "gated community road",
            "private club tennis court", "members-only club", "private cooperative society office"
        ]
    }
}


def normalize_text(text: str) -> str:
    """Normalizes text for robust keyword and phrase matching."""
    if not text or pd.isna(text):
        return ""
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return ' '.join(text.split())


def extract_financial_year(date_val: Any) -> str:
    """Extracts Indian Financial Year (e.g. 2024-2025) from date."""
    try:
        dt = pd.to_datetime(date_val)
        if pd.isna(dt):
            return "UNKNOWN"
        year = dt.year
        month = dt.month
        if month >= 4:
            return f"{year}-{year + 1}"
        else:
            return f"{year - 1}-{year}"
    except Exception:
        return "UNKNOWN"


class MPLADSComplianceEngine:
    """
    Modular, rule-based compliance engine for MPLADS.
    Can evaluate a single project or aggregate portfolio.
    """

    def __init__(
        self,
        annual_ceiling_inr: float = DEFAULT_ANNUAL_CEILING_INR,
        sc_allocation_pct: float = DEFAULT_SC_ALLOCATION_PCT,
        st_allocation_pct: float = DEFAULT_ST_ALLOCATION_PCT,
        prohibited_rules: Optional[Dict[str, Any]] = None
    ):
        self.annual_ceiling_inr = float(annual_ceiling_inr)
        self.sc_allocation_pct = float(sc_allocation_pct)
        self.st_allocation_pct = float(st_allocation_pct)
        self.prohibited_rules = prohibited_rules or PROHIBITED_CATEGORIES

    # ── Rule A: Financial Allocation / Ceiling ─────────────────────────────────

    def check_financial_ceiling(
        self,
        project_dict: dict,
        mp_portfolio_df: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Evaluates cumulative financial sanction against the annual MP ceiling (₹5 Cr).
        """
        rule_id = "FINANCIAL_CEILING"
        sanctioned = float(project_dict.get('amount_sanctioned', 0.0))
        app_date = project_dict.get('approval_date', datetime.now().isoformat())
        fy = project_dict.get('financial_year') or extract_financial_year(app_date)
        mp_name = str(project_dict.get('mp_name', 'Honble MP')).strip()

        # If MP portfolio data is provided, compute cumulative total for this FY
        cumulative_sanctioned = sanctioned
        prior_works_count = 0

        if mp_portfolio_df is not None and not mp_portfolio_df.empty:
            df_filtered = mp_portfolio_df
            if 'mp_name' in df_filtered.columns and mp_name and mp_name != 'Honble MP':
                df_filtered = df_filtered[df_filtered['mp_name'].astype(str).str.lower() == mp_name.lower()]
            elif len(df_filtered) > 500:
                # Full national dataset passed without specific MP; evaluate project standalone
                df_filtered = pd.DataFrame()

            if not df_filtered.empty and 'approval_date' in df_filtered.columns:
                app_str = df_filtered['approval_date'].astype(str)
                df_filtered = df_filtered[app_str.apply(extract_financial_year) == fy]
            
            # Exclude current project if already in dataset
            proj_id = str(project_dict.get('project_id', ''))
            if not df_filtered.empty and 'project_id' in df_filtered.columns and proj_id:
                df_filtered = df_filtered[df_filtered['project_id'].astype(str) != proj_id]
            
            if not df_filtered.empty:
                prior_sanctioned = float(pd.to_numeric(df_filtered.get('amount_sanctioned', 0), errors='coerce').sum())
                prior_works_count = len(df_filtered)
                cumulative_sanctioned = prior_sanctioned + sanctioned

        remaining_entitlement = max(0.0, self.annual_ceiling_inr - cumulative_sanctioned)
        utilization_pct = round((cumulative_sanctioned / (self.annual_ceiling_inr + 1e-4)) * 100.0, 2)

        evidence = {
            "financial_year": fy,
            "mp_name": mp_name,
            "annual_ceiling_inr": self.annual_ceiling_inr,
            "project_sanctioned_inr": sanctioned,
            "cumulative_sanctioned_inr": round(cumulative_sanctioned, 2),
            "remaining_entitlement_inr": round(remaining_entitlement, 2),
            "utilization_pct": utilization_pct,
            "prior_works_count": prior_works_count
        }

        if cumulative_sanctioned > self.annual_ceiling_inr:
            excess = round(cumulative_sanctioned - self.annual_ceiling_inr, 2)
            return {
                "rule_id": rule_id,
                "rule_name": "Annual Financial Ceiling (₹5 Crore/Year)",
                "status": "FAIL",
                "severity": "CRITICAL",
                "message": f"Cumulative sanctions (₹{cumulative_sanctioned:,.0f}) exceed annual ceiling of ₹{self.annual_ceiling_inr:,.0f} by ₹{excess:,.0f} for FY {fy}.",
                "evidence": evidence
            }
        elif cumulative_sanctioned >= self.annual_ceiling_inr * 0.90:
            return {
                "rule_id": rule_id,
                "rule_name": "Annual Financial Ceiling (₹5 Crore/Year)",
                "status": "WARNING",
                "severity": "MEDIUM",
                "message": f"Cumulative sanctions have reached {utilization_pct}% of the ₹{self.annual_ceiling_inr:,.0f} ceiling for FY {fy}.",
                "evidence": evidence
            }
        else:
            return {
                "rule_id": rule_id,
                "rule_name": "Annual Financial Ceiling (₹5 Crore/Year)",
                "status": "PASS",
                "severity": "NONE",
                "message": f"Sanction within annual entitlement ceiling ({utilization_pct}% utilized).",
                "evidence": evidence
            }

    # ── Rule B: SC Allocation ──────────────────────────────────────────────────

    def check_sc_allocation(
        self,
        project_dict: dict,
        mp_portfolio_df: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Monitors 15% mandatory allocation for Scheduled Caste population/areas.
        If demographic/target beneficiary data is absent, returns INSUFFICIENT_DATA.
        """
        rule_id = "SC_ALLOCATION"
        
        is_sc_benefit = project_dict.get('is_sc_benefit') or project_dict.get('sc_component')
        target_demo = str(project_dict.get('target_demographic', '')).lower()
        desc = normalize_text(str(project_dict.get('work_description', '')) + " " + str(project_dict.get('category', '')))
        
        if is_sc_benefit is None:
            if any(k in desc for k in ['sc colony', 'sc habitation', 'dalit', 'scheduled caste', 'sc basti', 'sc ward']):
                is_sc_benefit = True
            elif target_demo in ['sc', 'scheduled caste']:
                is_sc_benefit = True
            elif 'general' in target_demo or target_demo == 'none':
                is_sc_benefit = False

        if mp_portfolio_df is None or mp_portfolio_df.empty or len(mp_portfolio_df) > 500:
            if is_sc_benefit is True:
                return {
                    "rule_id": rule_id,
                    "rule_name": "SC Allocation (15% Requirement)",
                    "status": "PASS",
                    "severity": "NONE",
                    "message": "Project explicitly earmarked for Scheduled Caste community / area benefit.",
                    "evidence": {
                        "is_sc_tagged": True,
                        "required_pct": self.sc_allocation_pct,
                        "project_sanctioned": float(project_dict.get('amount_sanctioned', 0.0))
                    }
                }
            elif is_sc_benefit is False:
                return {
                    "rule_id": rule_id,
                    "rule_name": "SC Allocation (15% Requirement)",
                    "status": "PASS",
                    "severity": "NONE",
                    "message": "General infrastructure work; portfolio-level 15% quota must be verified across annual constituency works.",
                    "evidence": {
                        "is_sc_tagged": False,
                        "required_pct": self.sc_allocation_pct,
                        "portfolio_tracking": "Verify against annual MP work tally"
                    }
                }
            else:
                return {
                    "rule_id": rule_id,
                    "rule_name": "SC Allocation (15% Requirement)",
                    "status": "INSUFFICIENT_DATA",
                    "severity": "LOW",
                    "message": "Demographic beneficiary tag missing from project metadata. Cannot ascertain SC allocation status.",
                    "evidence": {
                        "is_sc_tagged": None,
                        "required_pct": self.sc_allocation_pct,
                        "note": "MoSPI guidelines recommend explicit demographic tagging."
                    }
                }

        # Portfolio-level aggregation
        fy = project_dict.get('financial_year') or extract_financial_year(project_dict.get('approval_date'))
        total_sanctioned = float(pd.to_numeric(mp_portfolio_df.get('amount_sanctioned', 0), errors='coerce').sum())
        
        sc_mask = pd.Series(False, index=mp_portfolio_df.index)
        if 'is_sc_benefit' in mp_portfolio_df.columns:
            sc_mask = sc_mask | (mp_portfolio_df['is_sc_benefit'] == True)
        if 'target_demographic' in mp_portfolio_df.columns:
            sc_mask = sc_mask | mp_portfolio_df['target_demographic'].astype(str).str.lower().isin(['sc', 'scheduled caste'])
        if 'work_description' in mp_portfolio_df.columns:
            sc_mask = sc_mask | mp_portfolio_df['work_description'].astype(str).str.lower().str.contains(
                r'sc colony|sc habitation|scheduled caste|sc basti', regex=True, na=False
            )

        sc_sanctioned = float(pd.to_numeric(mp_portfolio_df.loc[sc_mask, 'amount_sanctioned'], errors='coerce').sum())
        sc_pct = round((sc_sanctioned / (total_sanctioned + 1e-4)) * 100.0, 2) if total_sanctioned > 0 else 0.0

        evidence = {
            "financial_year": fy,
            "total_portfolio_sanctioned": round(total_sanctioned, 2),
            "sc_sanctioned": round(sc_sanctioned, 2),
            "sc_actual_pct": sc_pct,
            "sc_required_pct": self.sc_allocation_pct,
            "variance_pct": round(sc_pct - self.sc_allocation_pct, 2)
        }

        if total_sanctioned > 0 and sc_pct < self.sc_allocation_pct:
            shortfall = round((self.sc_allocation_pct - sc_pct) * total_sanctioned / 100.0, 2)
            return {
                "rule_id": rule_id,
                "rule_name": "SC Allocation (15% Requirement)",
                "status": "WARNING",
                "severity": "MEDIUM",
                "message": f"Annual SC allocation is {sc_pct}%, below the required {self.sc_allocation_pct}% (Shortfall: ₹{shortfall:,.0f}).",
                "evidence": evidence
            }
        else:
            return {
                "rule_id": rule_id,
                "rule_name": "SC Allocation (15% Requirement)",
                "status": "PASS",
                "severity": "NONE",
                "message": f"SC allocation compliance met ({sc_pct}% allocated vs {self.sc_allocation_pct}% required).",
                "evidence": evidence
            }

    # ── Rule C: ST Allocation ──────────────────────────────────────────────────

    def check_st_allocation(
        self,
        project_dict: dict,
        mp_portfolio_df: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Monitors 7.5% mandatory allocation for Scheduled Tribe population/areas.
        If demographic/target beneficiary data is absent, returns INSUFFICIENT_DATA.
        """
        rule_id = "ST_ALLOCATION"
        
        is_st_benefit = project_dict.get('is_st_benefit') or project_dict.get('st_component')
        target_demo = str(project_dict.get('target_demographic', '')).lower()
        desc = normalize_text(str(project_dict.get('work_description', '')) + " " + str(project_dict.get('category', '')))
        
        if is_st_benefit is None:
            if any(k in desc for k in ['st colony', 'st habitation', 'tribal', 'scheduled tribe', 'adivasi', 'girijan', 'st basti']):
                is_st_benefit = True
            elif target_demo in ['st', 'scheduled tribe', 'tribal']:
                is_st_benefit = True
            elif 'general' in target_demo or target_demo == 'none':
                is_st_benefit = False

        if mp_portfolio_df is None or mp_portfolio_df.empty or len(mp_portfolio_df) > 500:
            if is_st_benefit is True:
                return {
                    "rule_id": rule_id,
                    "rule_name": "ST Allocation (7.5% Requirement)",
                    "status": "PASS",
                    "severity": "NONE",
                    "message": "Project explicitly earmarked for Scheduled Tribe community / tribal area benefit.",
                    "evidence": {
                        "is_st_tagged": True,
                        "required_pct": self.st_allocation_pct,
                        "project_sanctioned": float(project_dict.get('amount_sanctioned', 0.0))
                    }
                }
            elif is_st_benefit is False:
                return {
                    "rule_id": rule_id,
                    "rule_name": "ST Allocation (7.5% Requirement)",
                    "status": "PASS",
                    "severity": "NONE",
                    "message": "General infrastructure work; portfolio-level 7.5% quota must be verified across annual constituency works.",
                    "evidence": {
                        "is_st_tagged": False,
                        "required_pct": self.st_allocation_pct,
                        "portfolio_tracking": "Verify against annual MP work tally"
                    }
                }
            else:
                return {
                    "rule_id": rule_id,
                    "rule_name": "ST Allocation (7.5% Requirement)",
                    "status": "INSUFFICIENT_DATA",
                    "severity": "LOW",
                    "message": "Demographic beneficiary tag missing from project metadata. Cannot ascertain ST allocation status.",
                    "evidence": {
                        "is_st_tagged": None,
                        "required_pct": self.st_allocation_pct,
                        "note": "MoSPI guidelines recommend explicit tribal/demographic tagging."
                    }
                }

        # Portfolio-level aggregation
        fy = project_dict.get('financial_year') or extract_financial_year(project_dict.get('approval_date'))
        total_sanctioned = float(pd.to_numeric(mp_portfolio_df.get('amount_sanctioned', 0), errors='coerce').sum())
        
        st_mask = pd.Series(False, index=mp_portfolio_df.index)
        if 'is_st_benefit' in mp_portfolio_df.columns:
            st_mask = st_mask | (mp_portfolio_df['is_st_benefit'] == True)
        if 'target_demographic' in mp_portfolio_df.columns:
            st_mask = st_mask | mp_portfolio_df['target_demographic'].astype(str).str.lower().isin(['st', 'scheduled tribe', 'tribal'])
        if 'work_description' in mp_portfolio_df.columns:
            st_mask = st_mask | mp_portfolio_df['work_description'].astype(str).str.lower().str.contains(
                r'st colony|st habitation|tribal|scheduled tribe|adivasi', regex=True, na=False
            )

        st_sanctioned = float(pd.to_numeric(mp_portfolio_df.loc[st_mask, 'amount_sanctioned'], errors='coerce').sum())
        st_pct = round((st_sanctioned / (total_sanctioned + 1e-4)) * 100.0, 2) if total_sanctioned > 0 else 0.0

        evidence = {
            "financial_year": fy,
            "total_portfolio_sanctioned": round(total_sanctioned, 2),
            "st_sanctioned": round(st_sanctioned, 2),
            "st_actual_pct": st_pct,
            "st_required_pct": self.st_allocation_pct,
            "variance_pct": round(st_pct - self.st_allocation_pct, 2)
        }

        if total_sanctioned > 0 and st_pct < self.st_allocation_pct:
            shortfall = round((self.st_allocation_pct - st_pct) * total_sanctioned / 100.0, 2)
            return {
                "rule_id": rule_id,
                "rule_name": "ST Allocation (7.5% Requirement)",
                "status": "WARNING",
                "severity": "MEDIUM",
                "message": f"Annual ST allocation is {st_pct}%, below the required {self.st_allocation_pct}% (Shortfall: ₹{shortfall:,.0f}).",
                "evidence": evidence
            }
        else:
            return {
                "rule_id": rule_id,
                "rule_name": "ST Allocation (7.5% Requirement)",
                "status": "PASS",
                "severity": "NONE",
                "message": f"ST allocation compliance met ({st_pct}% allocated vs {self.st_allocation_pct}% required).",
                "evidence": evidence
            }

    # ── Rule D: Prohibited Works Detection ─────────────────────────────────────

    def check_prohibited_works(self, project_dict: dict) -> Dict[str, Any]:
        """
        Evaluates project description, category, and location for prohibited works.
        Returns structured confidence and matched terms.
        """
        rule_id = "PROHIBITED_WORKS"
        desc = normalize_text(str(project_dict.get('work_description', '')))
        cat = normalize_text(str(project_dict.get('category', '')))
        loc = normalize_text(str(project_dict.get('location', '')))
        combined = f"{desc} {cat} {loc}"

        matched_findings = []

        for cat_key, config in self.prohibited_rules.items():
            matched_terms = []
            for kw in config["keywords"]:
                pattern = r'\b' + re.escape(kw) + r'\b'
                if re.search(pattern, combined):
                    matched_terms.append(kw)

            if matched_terms:
                conf = min(0.95, 0.65 + 0.15 * len(matched_terms))
                matched_findings.append({
                    "prohibited_category": cat_key,
                    "description": config["description"],
                    "severity": config["severity"],
                    "confidence": round(conf, 2),
                    "matched_terms": matched_terms
                })

        if matched_findings:
            highest_severity = "CRITICAL" if any(f["severity"] == "CRITICAL" for f in matched_findings) else "HIGH"
            top_finding = sorted(matched_findings, key=lambda x: x["confidence"], reverse=True)[0]
            
            return {
                "rule_id": rule_id,
                "rule_name": "Prohibited Works Detection",
                "status": "FAIL" if top_finding["confidence"] >= 0.80 else "WARNING",
                "severity": highest_severity,
                "message": (
                    f"Potentially Prohibited Work: Matched '{top_finding['prohibited_category']}' "
                    f"(Confidence: {top_finding['confidence'] * 100:.0f}%). Matched terms: {', '.join(top_finding['matched_terms'])}. "
                    "Requires verification against MoSPI Ineligible Works Annexure."
                ),
                "evidence": {
                    "findings": matched_findings,
                    "confidence": top_finding["confidence"],
                    "primary_category": top_finding["prohibited_category"],
                    "matched_terms": top_finding["matched_terms"]
                }
            }
        else:
            return {
                "rule_id": rule_id,
                "rule_name": "Prohibited Works Detection",
                "status": "PASS",
                "severity": "NONE",
                "message": "Work description and category adhere to permissible public infrastructure criteria.",
                "evidence": {
                    "findings": [],
                    "checked_categories": list(self.prohibited_rules.keys())
                }
            }

    # ── Rule E: Compliance Summary & Orchestration ─────────────────────────────

    def evaluate_project_compliance(
        self,
        project_dict: dict,
        mp_portfolio_df: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Executes all compliance rules and generates an overall compliance scorecard.
        """
        r_financial = self.check_financial_ceiling(project_dict, mp_portfolio_df)
        r_sc = self.check_sc_allocation(project_dict, mp_portfolio_df)
        r_st = self.check_st_allocation(project_dict, mp_portfolio_df)
        r_prohibited = self.check_prohibited_works(project_dict)

        all_rules = [r_financial, r_sc, r_st, r_prohibited]

        violations = [r for r in all_rules if r["status"] == "FAIL"]
        warnings = [r for r in all_rules if r["status"] == "WARNING"]
        insufficient = [r for r in all_rules if r["status"] == "INSUFFICIENT_DATA"]
        passed = [r for r in all_rules if r["status"] == "PASS"]

        if violations:
            overall_status = "NON_COMPLIANT"
            overall_severity = "CRITICAL" if any(v["severity"] == "CRITICAL" for v in violations) else "HIGH"
        elif warnings:
            overall_status = "AT_RISK"
            overall_severity = "MEDIUM"
        elif insufficient and len(passed) < 2:
            overall_status = "INSUFFICIENT_DATA"
            overall_severity = "LOW"
        else:
            overall_status = "COMPLIANT"
            overall_severity = "NONE"

        score = 100
        for v in violations:
            score -= 35 if v["severity"] == "CRITICAL" else 25
        for w in warnings:
            score -= 10
        score = max(0, min(100, score))

        summary = {
            "overall_status": overall_status,
            "overall_severity": overall_severity,
            "compliance_score": score,
            "rule_breakdown": {
                "financial_ceiling": r_financial["status"],
                "sc_allocation": r_sc["status"],
                "st_allocation": r_st["status"],
                "prohibited_works": r_prohibited["status"]
            },
            "violations": violations,
            "warnings": warnings,
            "insufficient_data": insufficient,
            "passed_checks": passed,
            "evaluation_timestamp": datetime.now().isoformat()
        }

        return summary


# Global singleton instance
compliance_engine = MPLADSComplianceEngine()
