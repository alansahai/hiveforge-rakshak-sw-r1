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

from collections import defaultdict
import threading

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MPLADS backend services and checking models...")
    env = os.getenv("ENV", os.getenv("ENVIRONMENT", "development")).lower()
    secret = os.getenv("SECRET_KEY", "mplads-sih2026-secret-change-in-production")
    if env == "production" and (not secret or secret == "mplads-sih2026-secret-change-in-production"):
        import secrets
        os.environ["SECRET_KEY"] = secrets.token_urlsafe(32)
        logger.warning(
            "⚠️ PRODUCTION NOTICE: No custom SECRET_KEY provided. Auto-generated secure ephemeral key. "
            "For persistent authentication sessions across restarts, set SECRET_KEY in your Railway environment variables."
        )

    # Verify models on startup
    iso = (MODELS_DIR / "isolation_forest.pkl").exists()
    fraud = (MODELS_DIR / "fraud_classifier.pkl").exists()
    eff = (MODELS_DIR / "efficiency_analyzer.pkl").exists()
    logger.info(f"Model status on startup: IsolationForest={iso}, FraudClassifier={fraud}, EfficiencyAnalyzer={eff}")
    
    # Preload master reference dataset in memory for instantaneous inference
    try:
        from src.backend.services.data_loader import get_master_dataframe
        get_master_dataframe()
        logger.info("Master reference dataset cached in memory successfully.")
    except Exception as e:
        logger.warning(f"Master dataset warmup skipped: {e}")

    logger.info("FastAPI backend initialized successfully.")
    yield
    logger.info("FastAPI backend shutting down.")

app = FastAPI(
    title="MPLADS Monitoring & Anomaly Detection System API",
    description="AI-driven anomaly, fraud, and efficiency analytics for MPLADS across India's Lok Sabha and Rajya Sabha public works.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration: supports explicit origins, Vercel deployments (*.vercel.app), and wildcard
allowed_str = os.getenv("ALLOWED_ORIGINS", os.getenv("CORS_ORIGINS", "*")).strip()
if allowed_str == "*" or not allowed_str:
    cors_origins = ["*"]
    cors_regex = None
else:
    cors_origins = [o.strip() for o in allowed_str.split(",") if o.strip()]
    cors_regex = r"https:\/\/.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sliding window rate limiter (200 requests/minute per client IP)
_RATE_LIMIT_STORE = defaultdict(list)
_RATE_LOCK = threading.Lock()
RATE_LIMIT_WINDOW = 60.0
MAX_REQUESTS_PER_WINDOW = 200

@app.middleware("http")
async def rate_limiting_and_logging_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Exclude static assets and health check from rate limiting
    path = request.url.path
    if not (path.startswith("/static") or path in ("/health", "/ready", "/docs", "/openapi.json")):
        with _RATE_LOCK:
            # Clean expired timestamps
            _RATE_LIMIT_STORE[client_ip] = [t for t in _RATE_LIMIT_STORE[client_ip] if now - t < RATE_LIMIT_WINDOW]
            if len(_RATE_LIMIT_STORE[client_ip]) >= MAX_REQUESTS_PER_WINDOW:
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please throttle your request rate."}
                )
            _RATE_LIMIT_STORE[client_ip].append(now)

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
