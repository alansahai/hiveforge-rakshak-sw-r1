from fastapi import APIRouter
from datetime import datetime
from pathlib import Path
import sys

# Adjust python path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent))
from src.config import MODELS_DIR

router = APIRouter()

@router.get("/health")
def health_check():
    """Liveness and health check endpoint."""
    return {
        "status": "healthy",
        "system": "MPLADS Anomaly Monitoring Pipeline",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/ready")
def readiness_check():
    """Readiness probe checking model availability."""
    iso_exists = (MODELS_DIR / "isolation_forest.pkl").exists()
    fraud_exists = (MODELS_DIR / "fraud_classifier.pkl").exists()
    eff_exists = (MODELS_DIR / "efficiency_analyzer.pkl").exists()
    
    models_ready = iso_exists and fraud_exists and eff_exists
    return {
        "ready": models_ready,
        "models_loaded": models_ready,
        "models": {
            "isolation_forest": iso_exists,
            "fraud_classifier": fraud_exists,
            "efficiency_analyzer": eff_exists
        },
        "timestamp": datetime.now().isoformat()
    }
