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
    rss_mb = 0.0
    try:
        import psutil, os
        proc = psutil.Process(os.getpid())
        rss_mb = round(proc.memory_info().rss / (1024 * 1024), 1)
    except Exception:
        pass
    return {
        "status": "healthy",
        "version": "2.1.0-memopt",
        "system": "MPLADS Anomaly Monitoring Pipeline",
        "rss_mb": rss_mb,
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
