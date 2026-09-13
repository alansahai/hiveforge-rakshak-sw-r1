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

    def test_analyze_validation_error_date_order(self):
        # approval_date after expected_completion_date must fail with 422
        payload = {
            "project_id": "TEST-INVALID-DATE",
            "state": "Maharashtra",
            "district": "Hingoli",
            "category": "Roads & Bridges",
            "contractor": "ABC Construction",
            "amount_sanctioned": 5000000.0,
            "amount_spent": 4800000.0,
            "approval_date": "2024-06-15",
            "expected_completion_date": "2023-01-15",  # earlier than approval!
            "progress_percentage": 50.0
        }
        response = self.client.post("/api/analyze", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_analyze_validation_overrun_allowed(self):
        # amount_spent > amount_sanctioned is a valid overrun signal, should return 200
        payload = {
            "project_id": "TEST-OVERRUN-VALID",
            "state": "Maharashtra",
            "district": "Hingoli",
            "category": "Roads & Bridges",
            "contractor": "ABC Construction",
            "amount_sanctioned": 5000000.0,
            "amount_spent": 7500000.0,  # 50% overrun
            "approval_date": "2023-01-15",
            "expected_completion_date": "2024-03-30",
            "progress_percentage": 90.0
        }
        response = self.client.post("/api/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("risk_score", response.json())

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

    def test_alert_persistence_across_restarts(self):
        from src.backend.services.alert_engine import alert_engine
        from src.config import ALERT_STATE_PATH
        import json

        # 1. Fetch an existing alert
        res = self.client.get("/api/alerts/?limit=1")
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alerts"]
        self.assertGreater(len(alerts), 0)
        target_alert = alerts[0]
        alert_id = target_alert["alert_id"]

        # 2. Acknowledge the alert via API
        ack_res = self.client.patch(
            f"/api/alerts/{alert_id}/acknowledge",
            params={"acknowledged_by": "officer_sharma", "notes": "On-site audit scheduled"}
        )
        self.assertEqual(ack_res.status_code, 200)
        self.assertEqual(ack_res.json()["alert"]["status"], "acknowledged")
        self.assertEqual(ack_res.json()["alert"]["current_owner"], "officer_sharma")

        # 3. Verify file on disk exists and contains acknowledged status
        self.assertTrue(ALERT_STATE_PATH.exists())
        with open(ALERT_STATE_PATH, "r", encoding="utf-8") as f:
            disk_alerts = json.load(f)
        matched_disk = next((a for a in disk_alerts if a["alert_id"] == alert_id), None)
        self.assertIsNotNone(matched_disk)
        self.assertEqual(matched_disk["status"], "acknowledged")

        # 4. Simulate backend restart: reload state from disk into alert engine
        alert_engine.reload_state()

        # 5. Confirm status persisted via GET /api/alerts/{id}
        get_res = self.client.get(f"/api/alerts/{alert_id}")
        self.assertEqual(get_res.status_code, 200)
        reloaded_alert = get_res.json()
        self.assertEqual(reloaded_alert["status"], "acknowledged")
        self.assertEqual(reloaded_alert["current_owner"], "officer_sharma")
        self.assertGreaterEqual(len(reloaded_alert["status_history"]), 1)
        self.assertEqual(reloaded_alert["status_history"][-1]["notes"], "On-site audit scheduled")

        # 6. Resolve the alert and verify persistence again
        res_resolve = self.client.patch(
            f"/api/alerts/{alert_id}/resolve",
            params={"resolved_by": "commissioner_patil", "resolution_notes": "Ground verification complete, contractor replaced"}
        )
        self.assertEqual(res_resolve.status_code, 200)
        self.assertEqual(res_resolve.json()["alert"]["status"], "resolved")

        # Simulate second restart
        alert_engine.reload_state()

        get_res2 = self.client.get(f"/api/alerts/{alert_id}")
        self.assertEqual(get_res2.status_code, 200)
        self.assertEqual(get_res2.json()["status"], "resolved")
        self.assertEqual(get_res2.json()["resolved_by"], "commissioner_patil")

    def test_auth_enforcement_demo_mode_and_strict_mode(self):
        import os
        routes_to_test = [
            ("GET", "/api/dashboard/summary", None),
            ("GET", "/api/dashboard/state/Maharashtra", None),
            ("GET", "/api/dashboard/district/Maharashtra/Hingoli", None),
            ("GET", "/api/dashboard/ministry", None),
            ("GET", "/api/dashboard/alerts?limit=5", None),
            ("GET", "/api/dashboard/projects?page_size=5", None),
            ("GET", "/api/dashboard/ministry-insights", None),
            ("GET", "/api/dashboard/states-districts", None),
            ("GET", "/api/dashboard/mps", None),
            ("GET", "/api/dashboard/contractor-network?limit_contractors=5", None),
            ("POST", "/api/dashboard/export", {"format": "csv", "limit": 2}),
            ("GET", "/api/alerts/?limit=5", None),
            ("POST", "/api/alerts/send-test-email?project_id=TEST-001&recipient_role=district", None),
        ]

        # 1. In DEMO_MODE=true (default), all routes succeed without Bearer token
        os.environ["DEMO_MODE"] = "true"
        for method, path, payload in routes_to_test:
            if method == "GET":
                res = self.client.get(path)
            else:
                res = self.client.post(path, json=payload or {})
            self.assertEqual(res.status_code, 200, f"DEMO_MODE=true failed on {method} {path}")

        # 2. In DEMO_MODE=false, unauthenticated requests return 401
        os.environ["DEMO_MODE"] = "false"
        for method, path, payload in routes_to_test:
            if method == "GET":
                res = self.client.get(path)
            else:
                res = self.client.post(path, json=payload or {})
            self.assertEqual(res.status_code, 401, f"DEMO_MODE=false should return 401 on {method} {path}")

        # 3. In DEMO_MODE=false, with valid Bearer token, all routes return 200
        login_res = self.client.post("/api/auth/login", json={"username": "ministry_demo", "password": "demo123"})
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        for method, path, payload in routes_to_test:
            if method == "GET":
                res = self.client.get(path, headers=headers)
            else:
                res = self.client.post(path, json=payload or {}, headers=headers)
            self.assertEqual(res.status_code, 200, f"Authenticated request failed on {method} {path}")

        # Reset DEMO_MODE to true
        os.environ["DEMO_MODE"] = "true"

    def test_contractor_network_endpoint(self):
        response = self.client.get("/api/dashboard/contractor-network?limit_contractors=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertIn("summary", data)

    def test_states_summary_endpoint(self):
        response = self.client.get("/api/dashboard/states-summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("states", data)
        self.assertIn("count", data)
        self.assertGreater(data["count"], 0)

    def test_custom_chart_endpoint(self):
        payload = {
            "x_axis": "category",
            "y_axis": "amount_sanctioned",
            "agg": "sum",
            "chart_type": "bar",
            "limit": 5
        }
        response = self.client.post("/api/dashboard/custom-chart", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("data", data)
        self.assertIn("summary", data)

    def test_contractor_detail_endpoint(self):
        # Fetch network first to get a valid contractor
        net_res = self.client.get("/api/dashboard/contractor-network?limit_contractors=5")
        self.assertEqual(net_res.status_code, 200)
        nodes = net_res.json().get("nodes", [])
        contractor_nodes = [n for n in nodes if n.get("type") == "contractor"]
        if contractor_nodes:
            c_name = contractor_nodes[0]["name"]
            c_res = self.client.get(f"/api/dashboard/contractor-detail?name={c_name}")
            self.assertEqual(c_res.status_code, 200)
            c_data = c_res.json()
            self.assertIn("contractor_name", c_data)
            self.assertIn("total_projects", c_data)
            self.assertIn("projects", c_data)
            self.assertIn("operating_districts", c_data)

    def test_project_detail_xai_enrichment(self):
        # Grab a project from dashboard summary top flagged
        sum_res = self.client.get("/api/dashboard/summary")
        self.assertEqual(sum_res.status_code, 200)
        flagged = sum_res.json().get("top_flagged_projects", [])
        if flagged:
            pid = flagged[0]["project_id"]
            p_res = self.client.get(f"/api/dashboard/project-detail?project_id={pid}")
            self.assertEqual(p_res.status_code, 200)
            p_data = p_res.json()
            self.assertIn("geo_duplicate_details", p_data)
            self.assertIn("xai_breakdown", p_data)
            self.assertIn("recommended_action", p_data)

if __name__ == '__main__':
    unittest.main()


