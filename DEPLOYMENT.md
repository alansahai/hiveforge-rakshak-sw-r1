# Deployment Guide: Railway (Backend) + Vercel (Frontend)

This guide provides step-by-step instructions for deploying the **MPLADS AI Monitoring & Anomaly Detection System** to **Railway** (FastAPI backend) and **Vercel** (React frontend).

---

## 🏗️ Architecture Overview

* **Backend Service (Railway)**:
  * Framework: FastAPI (Python 3.11)
  * ML Models: Isolation Forest, XGBoost, Autoencoder, and Random Forest Regressor (`models/`)
  * Data Store: Compressed Parquet dataset (`data/results/risk_reports.parquet`, ~7MB)
  * Server: Uvicorn ASGI with live geospatial and telemetry routing
  * Config: [`Procfile`](./Procfile), [`railway.json`](./railway.json), [`nixpacks.toml`](./nixpacks.toml), [`Dockerfile`](./Dockerfile)

* **Frontend Client (Vercel)**:
  * Framework: React 18 SPA (React Router v6, Leaflet GIS, Recharts)
  * Config: [`vercel.json`](./vercel.json), [`frontend/vercel.json`](./frontend/vercel.json)
  * Client Routing: Full SPA rewrite support (`/(.*) -> /index.html`)

---

## Step 1: Push Repository to GitHub

Ensure all changes, configuration files, and assets are committed and pushed to your GitHub repository:

```bash
# Check status of modified and new files
git status

# Stage all production assets and configuration
git add .

# Commit changes
git commit -m "feat(deploy): configure Railway backend, Vercel frontend, and clean gitignore"

# Push to your remote repository
git push origin main
```

---

## Step 2: Deploy Backend on Railway

1. Go to **[Railway.app](https://railway.app)** and log in with GitHub.
2. Click **"+ New Project"** → Select **"Deploy from GitHub repo"**.
3. Choose your repository: `hiveforge-rakshak-sw-r1`.
4. Railway will automatically detect [`railway.json`](./railway.json) and [`nixpacks.toml`](./nixpacks.toml).
5. **Configure Environment Variables**:
   In your Railway service settings under the **"Variables"** tab, add:

   | Variable Name | Value | Description |
   | :--- | :--- | :--- |
   | `ENVIRONMENT` | `production` | Enables production mode |
   | `SECRET_KEY` | *(A strong random 32+ char string)* | JWT signing secret |
   | `DEMO_MODE` | `true` | `true` allows evaluators/judges instant access without mandatory login; `false` strictly requires Bearer token |
   | `ALLOWED_ORIGINS` | `*` or `https://your-app.vercel.app` | Allowed CORS origins (note: `*.vercel.app` is auto-whitelisted) |

6. **Enable Auto-Deploy on Each Push**:
   * Under the **"Settings"** tab → Scroll to **"Source Repo"**.
   * Ensure **Branch** is set to `main`.
   * Ensure **Automatic Deployments** is toggled to **ON** (enabled).
   * Note: Our [`railway.json`](./railway.json) includes `"watchPatterns": ["**"]` which instructs Railway to trigger a deployment whenever any change is pushed to `main`.
   * *Troubleshooting note*: If Railway ever pauses auto-deployments due to an earlier crash or failed build, clicking **Deploy** once on the latest commit in the **Deployments** tab immediately re-arms the automatic deployment pipeline.

7. **Generate Public Domain**:
   * Under the **"Settings"** tab → Scroll to **"Networking"** / **"Public Networking"**.
   * Click **"Generate Domain"** (e.g., `https://hiveforge-rakshak-backend.up.railway.app`).
   * Copy this URL—you will use it in Step 3 for the frontend.

8. **Verify Backend Health**:

   Open in browser:
   ```
   https://<your-railway-domain>/health
   ```
   You should receive:
   ```json
   {
     "status": "healthy",
     "models_loaded": {
       "isolation_forest": true,
       "fraud_classifier": true,
       "efficiency_analyzer": true
     }
   }
   ```

---

## Step 3: Deploy Frontend on Vercel

1. Go to **[Vercel.com](https://vercel.com)** and log in with GitHub.
2. Click **"Add New..."** → Select **"Project"**.
3. Import your GitHub repository: `hiveforge-rakshak-sw-r1`.
4. **Configure Project Settings**:
   * **Framework Preset**: `Create React App`
   * **Root Directory**: Click **Edit** and choose `frontend` (or leave as root; [`vercel.json`](./vercel.json) handles both monorepo and subdirectory setups).
   * **Build Command**: `npm run build`
   * **Output Directory**: `build`
5. **Environment Variables**:
   Expand the **"Environment Variables"** section and add:

   | Variable Name | Value | Description |
   | :--- | :--- | :--- |
   | `REACT_APP_API_URL` | `https://<your-railway-domain>` | Railway backend URL without trailing slash (e.g. `https://hiveforge-rakshak-backend.up.railway.app`) |

6. Click **"Deploy"**.
7. Vercel will build the React bundle and provide a live URL (e.g., `https://hiveforge-rakshak-sw-r1.vercel.app`).

---

## Step 4: End-to-End Verification

1. **National Map & State Drill-Down**:
   * Open `https://<your-vercel-domain>/overview`.
   * Zoom and click on **Tamil Nadu** or **Maharashtra**.
   * Search for `thoothukudi` or `thiruvallur` in the district risk matrix.
   * Verify the real-time Leaflet map centers directly on the district with pulsing radar markers.

2. **District Authority Dashboard**:
   * Navigate to `https://<your-vercel-domain>/district?state=Tamil+Nadu&district=thoothukudi`.
   * Verify all 30 projects, KPI burndown charts, and contractor rankings load seamlessly.

3. **MP Constituency Portfolio**:
   * Navigate to `https://<your-vercel-domain>/mp?state=Uttar+Pradesh&mp=PRIYA+SAROJ`.
   * Verify all 1,383 projects load with risk breakdown filters (`🟢 Safe / Low (1068)`).

4. **3D Interactive Network**:
   * Click **Contractor Network** in the sidebar.
   * Verify 3D orbit rotation, auto-spin toggle, and interactive vendor dossier inspection.

---

## 🛠️ Troubleshooting & FAQ

* **Q: Why are API requests failing with CORS errors on Vercel?**
  * Check Railway's `ALLOWED_ORIGINS` variable. Ensure it includes your exact Vercel URL (e.g., `https://hiveforge-rakshak-sw-r1.vercel.app`) or set `ALLOWED_ORIGINS=*`.

* **Q: Getting 404 when refreshing deep routes (`/district`, `/overview`, `/mp`)?**
  * Both [`vercel.json`](./vercel.json) and [`frontend/vercel.json`](./frontend/vercel.json) contain SPA rewrite rules. Verify that Vercel is using the project settings configured in Step 3.

* **Q: Can I deploy with Docker on Railway?**
  * Yes. A production-ready [`Dockerfile`](./Dockerfile) is provided in the repository root. Railway will automatically build using Docker if selected in your service settings.
