import io
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from PIL import Image, ExifTags

from src.backend.models.schemas import ProjectAnalysisRequest, RiskScoreResponse, AssetVerificationResponse
from src.backend.services.risk_scorer import RiskScorerService
from src.backend.services.alert_engine import alert_engine, should_alert
from src.pipeline.geo_utils import haversine_distance_km, get_district_coordinates

router = APIRouter()
logger = logging.getLogger("AnalyzeRoute")
risk_service = RiskScorerService()


def extract_exif_gps_from_bytes(image_bytes: bytes):
    """Extracts latitude, longitude, and capture timestamp from image EXIF tags."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif_raw = img._getexif()
        if not exif_raw:
            return None, None, None

        gps_info = {}
        dt_orig = None
        for tag_id, value in exif_raw.items():
            tag_name = ExifTags.TAGS.get(tag_id, tag_id)
            if tag_name == "GPSInfo":
                for gps_tag_id, gps_val in value.items():
                    sub_tag = ExifTags.GPSTAGS.get(gps_tag_id, gps_tag_id)
                    gps_info[sub_tag] = gps_val
            elif tag_name in ("DateTimeOriginal", "DateTime"):
                dt_orig = str(value)

        if not gps_info or "GPSLatitude" not in gps_info or "GPSLongitude" not in gps_info:
            return None, None, dt_orig

        def _dms_to_dd(dms, ref):
            d = float(dms[0])
            m = float(dms[1])
            s = float(dms[2])
            dd = d + (m / 60.0) + (s / 3600.0)
            if str(ref).upper() in ["S", "W"]:
                dd = -dd
            return dd

        lat = _dms_to_dd(gps_info["GPSLatitude"], gps_info.get("GPSLatitudeRef", "N"))
        lon = _dms_to_dd(gps_info["GPSLongitude"], gps_info.get("GPSLongitudeRef", "E"))
        return round(lat, 6), round(lon, 6), dt_orig
    except Exception as e:
        logger.warning(f"Error extracting EXIF GPS metadata: {e}")
        return None, None, None


@router.post("/analyze", response_model=RiskScoreResponse)
@router.post("/analyze/project", response_model=RiskScoreResponse)
def analyze_project(payload: ProjectAnalysisRequest):
    """
    POST /api/analyze endpoint to score project risk, detect anomalies,
    compute fraud probability, analyze efficiency, and return SHAP-based explanations.

    If the resulting risk_score is above the alert threshold (>= 60),
    an alert is automatically created in the lifecycle alert engine with
    an email notification dispatched (demo mode: logged to console).
    """
    try:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        res = risk_service.analyze_single_project(data)

        # Auto-create lifecycle alert for high-risk results
        risk_score = res.get("risk_score", 0)
        if should_alert(risk_score):
            fraud_detail = res.get("fraud_risk", {})
            eff_detail = res.get("efficiency_risk", {})
            parts = []
            if fraud_detail.get("explanation"):
                parts.append(fraud_detail["explanation"])
            if eff_detail.get("explanation"):
                parts.append(eff_detail["explanation"])
            explanation = " | ".join(parts) if parts else f"Composite risk score {risk_score}/100 — review required."

            try:
                alert_engine.create_alert(
                    project_data=data,
                    risk_score=float(risk_score),
                    explanation=explanation,
                    send_email=True,
                )
                logger.info(f"Lifecycle alert created for project {data.get('project_id')} (risk={risk_score})")
            except Exception as alert_err:
                logger.warning(f"Alert creation failed (non-fatal): {alert_err}")

        return res

    except ValueError as ve:
        logger.warning(f"Validation error in analyze request: {str(ve)}")
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        logger.error(f"Internal error processing analyze request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model analysis failed: {str(e)}")


@router.post("/verify-asset", response_model=AssetVerificationResponse)
@router.post("/projects/{project_id}/verify-asset", response_model=AssetVerificationResponse)
async def verify_asset(
    project_id: Optional[str] = None,
    file: Optional[UploadFile] = File(None),
    photo_lat: Optional[float] = Form(None),
    photo_lon: Optional[float] = Form(None),
    site_lat: Optional[float] = Form(None),
    site_lon: Optional[float] = Form(None),
    district: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    tolerance_km: float = Form(5.0)
):
    """
    POST /api/verify-asset
    Verifies physical execution of public works using geo-tagged site photographs.
    Extracts embedded EXIF GPS coordinates and computes the spatial Haversine distance
    to registered project coordinates. Flags discrepancy if physical site distance
    exceeds permissible threshold (default: 5.0 km).
    """
    proj_id = project_id or "PROJ-ASSET-CHECK"
    extracted_time = None

    # 1. Extract GPS from uploaded image if provided
    if file is not None:
        content = await file.read()
        exif_lat, exif_lon, extracted_time = extract_exif_gps_from_bytes(content)
        if exif_lat is not None and exif_lon is not None:
            photo_lat, photo_lon = exif_lat, exif_lon

    # If still no photo coordinates, return NO_GPS_DATA
    if photo_lat is None or photo_lon is None:
        target_lat, target_lon = (site_lat or 20.0, site_lon or 78.0)
        if site_lat is None and district and state:
            target_lat, target_lon = get_district_coordinates(district, state)
        return AssetVerificationResponse(
            project_id=proj_id,
            verified=False,
            status="NO_GPS_DATA",
            distance_km=None,
            tolerance_km=tolerance_km,
            site_location={"latitude": target_lat, "longitude": target_lon},
            photo_location=None,
            message="Uploaded image lacks embedded EXIF GPS tags. Camera location permission was not enabled.",
            photo_timestamp=extracted_time,
            provenance="EXIF_GPS_VERIFICATION"
        )

    # 2. Determine target site coordinates
    if site_lat is not None and site_lon is not None:
        expected_lat, expected_lon = float(site_lat), float(site_lon)
    elif district and state:
        expected_lat, expected_lon = get_district_coordinates(district, state)
    else:
        # Fallback to master registry lookup
        master_df = risk_service.get_master_df()
        if master_df is not None and 'project_id' in master_df.columns:
            match = master_df[master_df['project_id'].astype(str) == str(proj_id)]
            if not match.empty:
                m_dist = str(match['district'].iloc[0])
                m_state = str(match['state'].iloc[0])
                expected_lat, expected_lon = get_district_coordinates(m_dist, m_state)
            else:
                expected_lat, expected_lon = 25.3176, 82.9739  # Default Varanasi benchmark
        else:
            expected_lat, expected_lon = 25.3176, 82.9739

    # 3. Compute Haversine distance
    distance_km = round(haversine_distance_km(photo_lat, photo_lon, expected_lat, expected_lon), 2)
    is_verified = distance_km <= tolerance_km
    status_label = "VERIFIED" if is_verified else "DISCREPANCY"

    if is_verified:
        msg = f"Asset physically verified. Photograph captured within {distance_km:.2f} km of registered project site (tolerance: {tolerance_km} km)."
    else:
        msg = (
            f"Asset geo-tag discrepancy flagged: Photograph was taken {distance_km:.1f} km away from registered project site "
            f"({expected_lat:.4f}, {expected_lon:.4f}). Exceeds {tolerance_km} km permissible threshold."
        )

    return AssetVerificationResponse(
        project_id=proj_id,
        verified=is_verified,
        status=status_label,
        distance_km=distance_km,
        tolerance_km=tolerance_km,
        site_location={"latitude": expected_lat, "longitude": expected_lon},
        photo_location={"latitude": photo_lat, "longitude": photo_lon},
        message=msg,
        photo_timestamp=extracted_time,
        provenance="EXIF_GPS_VERIFICATION"
    )
