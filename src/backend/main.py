import os
import sys
import time
import logging
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Path resolution
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from src.config import MODELS_DIR
from src.backend.routes import health, analyze, dashboard, auth as auth_routes, alerts as alerts_routes
from src.backend.services.cache import cache_service
from src.backend.services.auth_service import auth_service  # noqa: ensure demo users are hashed on startup

from contextlib import asynccontextmanager

# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger("FastAPIMain")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MPLADS backend services and checking models...")
    # Verify models on startup
    iso = (MODELS_DIR / "isolation_forest.pkl").exists()
    fraud = (MODELS_DIR / "fraud_classifier.pkl").exists()
    eff = (MODELS_DIR / "efficiency_analyzer.pkl").exists()
    logger.info(f"Model status on startup: IsolationForest={iso}, FraudClassifier={fraud}, EfficiencyAnalyzer={eff}")
    logger.info("FastAPI backend initialized successfully.")
    yield
    logger.info("FastAPI backend shutting down.")

app = FastAPI(
    title="MPLADS Monitoring & Anomaly Detection System API",
    description="AI-driven anomaly, fraud, and efficiency analytics for MPLADS across India's Lok Sabha and Rajya Sabha public works.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware for local React and frontend dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} ({duration * 1000:.1f}ms)")
    return response

# Include API Routers
app.include_router(health.router, tags=["Health"])
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(auth_routes.router, prefix="/api", tags=["Authentication"])
app.include_router(alerts_routes.router, prefix="/api", tags=["Alerts"])

# ---------- Serve React Frontend Build in Production ----------

# Resolve frontend build directory
FRONTEND_BUILD = Path(__file__).resolve().parent.parent.parent / "frontend" / "build"

if FRONTEND_BUILD.exists():
    # Serve static assets (JS, CSS, images) from the React build
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD / "static")), name="static")

    # Catch-all: serve index.html for any non-API route (React Router SPA)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If requesting a real file in build dir, serve it
        file_path = FRONTEND_BUILD / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for client-side routing
        return FileResponse(str(FRONTEND_BUILD / "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "message": "MPLADS AI Monitoring Portal — API Backend",
            "docs_url": "/docs",
            "health_check": "/health",
            "ready_check": "/ready",
            "note": "Frontend build not found. Run 'cd frontend && npm run build' to enable serving the dashboard."
        }

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("src.backend.main:app", host="0.0.0.0", port=port, reload=False)
