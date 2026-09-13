import unittest
import pandas as pd
from datetime import datetime
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.pipeline.compliance_rules import MPLADSComplianceEngine, DEFAULT_ANNUAL_CEILING_INR

class TestMPLADSComplianceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = MPLADSComplianceEngine()

    def test_financial_ceiling_below_limit(self):
        project = {
            "project_id": "TEST-01",
            "amount_sanctioned": 5000000.0,  # 50 Lakhs
            "approval_date": "2024-05-10",
            "mp_name": "Test MP"
        }
        res = self.engine.check_financial_ceiling(project)
        self.assertEqual(res["status"], "PASS")
        self.assertLess(res["evidence"]["cumulative_sanctioned_inr"], DEFAULT_ANNUAL_CEILING_INR)

    def test_financial_ceiling_above_limit(self):
        # MP portfolio already at 4.8 Crore, new project 50 Lakhs -> 5.3 Crore (exceeds 5 Cr)
        portfolio = pd.DataFrame([
            {
                "project_id": "PRIOR-01",
                "mp_name": "Test MP",
                "amount_sanctioned": 48000000.0,
                "approval_date": "2024-04-15"
            }
        ])
        project = {
            "project_id": "NEW-01",
            "amount_sanctioned": 5000000.0,
            "approval_date": "2024-06-20",
            "mp_name": "Test MP"
        }
        res = self.engine.check_financial_ceiling(project, mp_portfolio_df=portfolio)
        self.assertEqual(res["status"], "FAIL")
        self.assertEqual(res["severity"], "CRITICAL")
        self.assertIn("exceed annual ceiling", res["message"])

    def test_sc_allocation_pass_and_insufficient_data(self):
        # 1. Without demographic data -> INSUFFICIENT_DATA
        p_no_demo = {
            "project_id": "TEST-NO-DEMO",
            "amount_sanctioned": 1000000.0,
            "work_description": "General road paving work"
        }
        res_ind = self.engine.check_sc_allocation(p_no_demo)
        self.assertEqual(res_ind["status"], "INSUFFICIENT_DATA")

        # 2. Explicit SC benefit -> PASS
        p_sc = {
            "project_id": "TEST-SC",
            "amount_sanctioned": 1000000.0,
            "work_description": "Construction of community hall in SC colony ward 4"
        }
        res_sc = self.engine.check_sc_allocation(p_sc)
        self.assertEqual(res_sc["status"], "PASS")

    def test_st_allocation_portfolio_warning(self):
        # Portfolio with 0 ST allocation out of 2 Crore -> Shortfall WARNING
        portfolio = pd.DataFrame([
            {"project_id": "P1", "amount_sanctioned": 10000000.0, "work_description": "Road work", "target_demographic": "General"},
            {"project_id": "P2", "amount_sanctioned": 10000000.0, "work_description": "Water tank", "target_demographic": "General"}
        ])
        project = {
            "project_id": "P3",
            "amount_sanctioned": 500000.0,
            "work_description": "Electricity poles",
            "approval_date": "2024-07-01"
        }
        res = self.engine.check_st_allocation(project, mp_portfolio_df=portfolio)
        self.assertEqual(res["status"], "WARNING")
        self.assertIn("below the required 7.5%", res["message"])

    def test_prohibited_works_detection(self):
        # Religious structure prohibited
        p_religious = {
            "project_id": "PROHIBITED-01",
            "work_description": "Renovation and marble flooring of local temple and prayer hall",
            "category": "Community Hall"
        }
        res = self.engine.check_prohibited_works(p_religious)
        self.assertEqual(res["status"], "FAIL")
        self.assertEqual(res["evidence"]["primary_category"], "RELIGIOUS_STRUCTURE")
        self.assertIn("temple", res["evidence"]["matched_terms"])

        # Private benefit prohibited
        p_private = {
            "project_id": "PROHIBITED-02",
            "work_description": "Construction of private residence boundary wall and personal office",
            "category": "Road Infrastructure"
        }
        res_priv = self.engine.check_prohibited_works(p_private)
        self.assertEqual(res_priv["status"], "FAIL")
        self.assertEqual(res_priv["evidence"]["primary_category"], "PRIVATE_BENEFIT")

        # Public permissible work -> PASS
        p_valid = {
            "project_id": "VALID-01",
            "work_description": "Construction of public concrete link road connecting village to primary health sub-centre",
            "category": "Road Infrastructure"
        }
        res_valid = self.engine.check_prohibited_works(p_valid)
        self.assertEqual(res_valid["status"], "PASS")

    def test_overall_compliance_evaluation(self):
        # Valid safe project
        p_safe = {
            "project_id": "SAFE-01",
            "amount_sanctioned": 1000000.0,
            "approval_date": "2024-05-15",
            "work_description": "Solar street lighting for public streets and public bus stop in tribal hamlet",
            "category": "Electricity",
            "is_st_benefit": True,
            "is_sc_benefit": False
        }
        summary = self.engine.evaluate_project_compliance(p_safe)
        self.assertEqual(summary["overall_status"], "COMPLIANT")
        self.assertEqual(summary["compliance_score"], 100)

if __name__ == '__main__':
    unittest.main()
