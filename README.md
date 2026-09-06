# 🛡️ MPLADS AI Monitoring & Anomaly Detection System

> AI-powered monitoring platform for detecting anomalies, fraud, and inefficiencies in India's **Member of Parliament Local Area Development Scheme (MPLADS)** — covering 98,000+ real projects across 28 states.

Built for **Smart India Hackathon (SIH) 2026** — Smart Automation Category.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Multi-Model ML Ensemble** | Isolation Forest + PyTorch Autoencoder + XGBoost Fraud Classifier + Gradient Boosting Efficiency Regressor |
| **50+ Engineered Features** | Financial, timeline, geographic, contractor, and pattern-based feature engineering |
| **4 Role-Based Dashboards** | MP Constituency, State Authority, District Authority, and Ministry (MoSPI) views |
| **Real-Time Risk Scoring** | Composite risk score (0-100) with anomaly, fraud, and efficiency sub-scores |
| **SHAP Explainability** | Human-readable explanations for every flagged project |
| **Alert & Escalation Engine** | Severity-based alerts with auto-routing to stakeholders |
| **PDF/CSV Compliance Reports** | Exportable audit reports with filtering |
| **Interactive Analysis** | Submit any project for on-demand AI risk scoring |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  Dashboard (Overview, MP, State, District, Ministry)     │
│  Analyze Project | Alerts | Export Reports               │
├─────────────────────────────────────────────────────────┤
│                    FastAPI Backend                        │
│  /api/analyze  /api/dashboard/*  /health  /api/export    │
├─────────────────────────────────────────────────────────┤
│              ML Ensemble Engine                          │
│  Isolation Forest │ Autoencoder │ XGBoost │ GBRegressor  │
├─────────────────────────────────────────────────────────┤
│           Data Pipeline                                  │
│  data_loader → feature_engineer → data_validator         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip / npm

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/mplads-ai-monitor.git
cd mplads-ai-monitor

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run Data Pipeline & Train Models (first time only)

```bash
python run_all.py
```

This will:
- Download/generate MPLADS data
- Engineer 50+ features
- Train all ML models
- Start both servers

### 3. Run Manually (after first setup)

```bash
# Terminal 1 — Backend (from project root)
uvicorn src.backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm start
```

### 4. Access

| Service | URL |
|---|---|
| **Dashboard** | http://localhost:3000 |
| **API Docs** | http://localhost:8000/docs |
| **Health Check** | http://localhost:8000/health |

---

## 📊 Dashboards

| Dashboard | Route | Purpose |
|---|---|---|
| National Overview | `/` | KPIs, risk distribution, category breakdown, flagged projects |
| MP Constituency | `/mp` | Fund utilization, project risk table, export reports |
| State Authority | `/state` | State selector, compliance scorecard, district heatmap |
| District Authority | `/district` | Budget burndown, contractor performance, Gantt timeline |
| Ministry (MoSPI) | `/ministry` | National trends, state comparison, quarterly analytics |
| Analyze Project | `/analyze` | Submit project data for real-time AI risk scoring |
| Alerts & Flags | `/alerts` | Live alerts with severity/state filtering |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness check with model status |
| `POST` | `/api/analyze` | Score a single project (returns risk + explanations) |
| `GET` | `/api/dashboard/summary` | National summary metrics |
| `GET` | `/api/dashboard/mp/{state}/{mp_name}` | MP portfolio dashboard |
| `GET` | `/api/dashboard/state/{state}` | State-level dashboard |
| `GET` | `/api/dashboard/district/{state}/{district}` | District-level dashboard |
| `GET` | `/api/dashboard/ministry` | Ministry national dashboard |
| `GET` | `/api/dashboard/alerts` | Filtered alert list |
| `GET` | `/api/dashboard/projects` | Paginated project list |
| `POST` | `/api/dashboard/export` | Download PDF/CSV report |

---

## 🤖 ML Models

| Model | Type | Purpose | Output |
|---|---|---|---|
| Isolation Forest | Unsupervised | Anomaly detection | `anomaly_score` (0-1) |
| Autoencoder | PyTorch Neural Net | Reconstruction-based anomaly | `reconstruction_error` |
| XGBoost Classifier | Supervised | Fraud detection | `fraud_probability` (0-1) |
| Gradient Boosting | Regression | Efficiency analysis | `efficiency_score`, `days_behind` |
| Ensemble | Weighted composite | Risk aggregation | `risk_score` (0-100) |

**Risk Score Formula:**
```
risk_score = (0.40 × anomaly + 0.35 × fraud + 0.25 × (1 - efficiency)) × 100
```

---

## ☁️ Deploy to Railway

### One-Click Deploy

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select this repo — Railway auto-detects `railway.json`
4. Set environment variable: `PORT` (Railway sets this automatically)
5. Deploy — Railway builds both Python + Node, serves everything on one URL

The backend serves the React build as static files, so you only need **one Railway service**.

### Manual Deploy

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login & deploy
railway login
railway init
railway up
```

---

## 📁 Project Structure

```
├── src/
│   ├── config.py                  # Project configuration & constants
│   ├── pipeline/
│   │   ├── data_loader.py         # MPLADS data ingestion
│   │   ├── feature_engineer.py    # 50+ feature engineering
│   │   └── data_validator.py      # Data quality checks
│   ├── models/
│   │   ├── anomaly_detector.py    # Isolation Forest + Autoencoder
│   │   ├── fraud_classifier.py    # XGBoost fraud classifier
│   │   ├── efficiency_analyzer.py # Gradient boosting regressor
│   │   └── ensemble.py            # Ensemble risk aggregation
│   ├── explainability/
│   │   ├── shap_explainer.py      # SHAP-based explanations
│   │   └── rule_extractor.py      # Human-readable rules
│   └── backend/
│       ├── main.py                # FastAPI app + SPA serving
│       ├── routes/
│       │   ├── health.py          # Health & readiness endpoints
│       │   ├── analyze.py         # POST /api/analyze
│       │   └── dashboard.py       # All dashboard endpoints
│       ├── services/
│       │   ├── risk_scorer.py     # Risk scoring service
│       │   ├── alert_engine.py    # Alert generation & escalation
│       │   ├── cache.py           # In-memory + Redis cache
│       │   └── export.py          # PDF/CSV report generation
│       └── models/
│           └── schemas.py         # Pydantic request/response models
├── frontend/
│   ├── src/
│   │   ├── api/client.js          # Axios API client
│   │   ├── components/            # Dashboard components
│   │   └── pages/Dashboard.jsx    # Overview page
│   └── public/index.html
├── models/                        # Trained model weights (.pkl, .pt)
├── data/                          # Raw & processed data (gitignored)
├── tests/                         # pytest test suite
├── docker/                        # Docker configs
├── k8s/                           # Kubernetes manifests
├── run_all.py                     # Master orchestrator
├── requirements.txt               # Python dependencies
├── railway.json                   # Railway deployment config
├── Procfile                       # Process definition
└── .gitignore
```

---

## 🧪 Testing

```bash
pytest tests/ -v
```

---

## 📜 License

MIT License. Built for SIH 2026.
