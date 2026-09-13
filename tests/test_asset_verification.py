"""
Unit Test: Asset Geo-Tag & EXIF Photo Verification
Verifies physical site verification, EXIF GPS coordinate extraction,
Haversine proximity calculation, and discrepancy detection.
"""

import io
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.backend.main import app

client = TestClient(app)


def test_verify_asset_matching_coordinates():
    # Site in Varanasi (25.3176, 82.9739), photo taken 200m away (25.3185, 82.9745)
    response = client.post(
        "/api/verify-asset",
        data={
            "project_id": "TEST-ASSET-01",
            "district": "Varanasi",
            "state": "Uttar Pradesh",
            "photo_lat": 25.3185,
            "photo_lon": 82.9745,
            "tolerance_km": 5.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is True
    assert data["status"] == "VERIFIED"
    assert data["distance_km"] < 1.0
    assert "physically verified" in data["message"].lower()


def test_verify_asset_discrepancy():
    # Site in Varanasi, photo taken in Mumbai (19.0760, 72.8777)
    response = client.post(
        "/api/verify-asset",
        data={
            "project_id": "TEST-ASSET-02",
            "district": "Varanasi",
            "state": "Uttar Pradesh",
            "photo_lat": 19.0760,
            "photo_lon": 72.8777,
            "tolerance_km": 5.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False
    assert data["status"] == "DISCREPANCY"
    assert data["distance_km"] > 500.0
    assert "discrepancy" in data["message"].lower()


def test_verify_asset_no_gps_image():
    # Create simple in-memory image without EXIF GPS tags
    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    response = client.post(
        "/api/verify-asset",
        files={"file": ("site_photo.jpg", buf.getvalue(), "image/jpeg")},
        data={
            "project_id": "TEST-ASSET-03",
            "district": "Varanasi",
            "state": "Uttar Pradesh"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False
    assert data["status"] == "NO_GPS_DATA"
    assert "lacks embedded exif gps" in data["message"].lower()
