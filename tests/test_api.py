import unittest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.backend.main import app

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_dashboard_summary_endpoint(self):
        response = self.client.get("/api/dashboard/summary")
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_projects", response.json())

    def test_state_dashboard_endpoint(self):
        response = self.client.get("/api/dashboard/state/Maharashtra")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["state"], "Maharashtra")
        self.assertIn("total_projects", data)
        self.assertIn("compliance_scorecard", data)

    def test_ministry_dashboard_endpoint(self):
        response = self.client.get("/api/dashboard/ministry")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("national_summary", data)
        self.assertIn("risk_distribution_pie", data)

    def test_alerts_endpoint(self):
        response = self.client.get("/api/dashboard/alerts?limit=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("alerts", data)

    def test_analyze_endpoint(self):
        payload = {
            "project_id": "TEST-UNIT-01",
            "state": "Maharashtra",
            "district": "Hingoli",
            "category": "Roads & Bridges",
            "contractor": "ABC Construction",
            "amount_sanctioned": 5000000.0,
            "amount_spent": 4800000.0,
            "approval_date": "2023-01-15",
            "expected_completion_date": "2024-03-30",
            "actual_completion_date": "2024-05-15",
            "progress_percentage": 85.0
        }
        response = self.client.post("/api/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("risk_score", data)
        self.assertIn("anomaly_score", data)
        self.assertIn("fraud_risk", data)
        self.assertIn("efficiency_risk", data)

    def test_export_csv_endpoint(self):
        payload = {"format": "csv", "state": "Maharashtra", "limit": 5}
        response = self.client.post("/api/dashboard/export", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers.get("content-type", ""))

    def test_projects_endpoint_date_filtering(self):
        response = self.client.get("/api/dashboard/projects?start_date=2020-01-01&end_date=2025-12-31&page_size=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("projects", data)
        self.assertIn("total", data)

    def test_auth_enforcement_demo_mode_and_strict_mode(self):
        import os
        # 1. In DEMO_MODE=true (default), request succeeds without Bearer token
        os.environ["DEMO_MODE"] = "true"
        res_demo = self.client.get("/api/dashboard/summary")
        self.assertEqual(res_demo.status_code, 200)

        # 2. In DEMO_MODE=false, unauthenticated request returns 401
        os.environ["DEMO_MODE"] = "false"
        res_unauth = self.client.get("/api/dashboard/summary")
        self.assertEqual(res_unauth.status_code, 401)

        # 3. In DEMO_MODE=false, logging in and sending valid Bearer token returns 200
        login_res = self.client.post("/api/auth/login", json={"username": "ministry_demo", "password": "demo123"})
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["access_token"]

        res_auth = self.client.get("/api/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_auth.status_code, 200)

        # Reset DEMO_MODE to true
        os.environ["DEMO_MODE"] = "true"

if __name__ == '__main__':
    unittest.main()

