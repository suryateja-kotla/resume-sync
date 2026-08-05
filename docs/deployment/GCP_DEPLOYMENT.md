# GCP Deployment — Reference Guide

> How resume-sync is deployed: GCP project `sync-folio`, Cloud Run (backend + frontend),
> Artifact Registry, Firestore (MongoDB-compatible), and an Azure Pipelines CI/CD pipeline
> triggered via the GitHub → Azure DevOps mirror.

---

## 1. Architecture Overview

```
Local code (GitHub repo, origin)
        │  git push (any branch)
        ▼
GitHub Actions: sync-azure-devops.yml
        │  mirrors push → Azure DevOps repo
        ▼
Azure DevOps Repo
        │  push to resume-sync/surya triggers azure-pipelines.yml
        ▼
Azure Pipelines (hosted ubuntu-latest agent)
        │  1. gcloud auth (sync-folio-deployer key)
        │  2. docker build + push (backend, frontend)
        │  3. gcloud run deploy (backend, frontend)
        ▼
Artifact Registry (sync-folio, us-central1)
        │  Cloud Run pulls image from here
        ▼
Cloud Run
   ├── sync-folio-backend   (FastAPI API, runs as sync-folio-backend SA)
   └── sync-folio           (frontend static SPA via nginx)
        │
        ├──> Firestore (MongoDB-compatible mode) — sync-folio-resumes database
        ├──> GCS bucket — sync-folio-resumes
        └──> Vertex AI (Gemini) — resume extraction
```

**Key point:** Azure DevOps holds source code only. It cannot run containers or deploy
anything by itself — Azure Pipelines is the CI/CD engine that builds a container image
from that code and pushes/deploys it into GCP. Source control (Azure DevOps) and the
container registry (Artifact Registry, in GCP) are two separate, unrelated systems;
Cloud Run can only pull images from a registry like Artifact Registry, never directly
from a Git repo.

---

## 2. GCP Resources

| Resource | Name | Details |
|---|---|---|
| Project | `sync-folio` | All resources below live here |
| Region | `us-central1` | Used consistently for every resource, to avoid cross-region latency/egress cost |
| Firestore database | `sync-folio-resumes` | Enterprise edition, **MongoDB-compatible data access mode enabled** — the app connects to it via a standard `MONGO_URI` (Motor/PyMongo), not the native Firestore SDK. Already existed before this deployment work; not created as part of this process. |
| GCS bucket | `sync-folio-resumes` | Stores generated resume `.docx` files, under `employee-resumes/{employee_id}/{filename}`. Already existed before this deployment work. |
| Artifact Registry repo | `sync-folio` (Docker format, Standard mode, `us-central1`) | Holds both container images, pushed as `backend` and `frontend` under this one repo. **Created during this deployment.** |
| Cloud Run service (backend) | `sync-folio-backend` | FastAPI app. Public (unauthenticated invocations allowed), min instances = 0, request-based billing, 1 GiB memory, port 8000. **Created during this deployment.** |
| Cloud Run service (frontend) | `sync-folio` | Static SPA served by nginx. Public, min instances = 0, port 8080. **Created during this deployment.** |

### Service Accounts

| Service account | Purpose | Roles granted |
|---|---|---|
| `sync-folio-backend@sync-folio.iam.gserviceaccount.com` | **Runtime identity** — the Cloud Run backend service runs *as* this account. Used by the FastAPI app to call Vertex AI (Gemini extraction) and read/write the GCS bucket. | `Vertex AI User` (shows as "Agent Platform User" in some console role-picker views — same underlying capability; confirmed working via a live resume-upload test), `Storage Object Admin` |
| `sync-folio-deployer@sync-folio.iam.gserviceaccount.com` | **CI/CD identity** — used only by the Azure Pipeline to build/push images and deploy. Kept separate from the runtime account so a leaked pipeline credential can't be used to read application data, only to redeploy. | `Artifact Registry Writer`, `Cloud Run Admin`, `Service Account User` (project-wide — lets it deploy services that run as `sync-folio-backend`) |

**Not used:** `Cloud Datastore User` — despite Firestore being the database, the app talks
to it entirely through the MongoDB-compatible wire protocol via `MONGO_URI` (username/password
in the connection string), never through the native Firestore SDK/IAM path. That role would
have no effect on this app.

---

## 3. Container Images

Both Dockerfiles already existed in the repo before this deployment effort and needed no changes —
they were written with Cloud Run in mind (dynamic `$PORT` handling, multi-stage build).

- **`backend/Dockerfile`** — `python:3.11-slim`, installs `libgl1` (needed by PyMuPDF/Pillow for
  PDF/image processing), installs `requirements.txt`, runs
  `uvicorn main:app --host 0.0.0.0 --port ${PORT}`. Cloud Run injects `$PORT` at runtime.
- **`frontend/Dockerfile`** — two-stage build: `node:20-slim` builds the Vite/React app
  (`VITE_API_URL` is baked into the static JS bundle at this build stage — there is no
  runtime env var once it's a static SPA), then `nginx:1.27-alpine` serves the built
  `dist/` output on port 8080 (see `frontend/nginx.conf`).

Images are tagged twice on every push: `:$(Build.BuildId)` (unique, traceable, enables rollback
to a specific past build) and `:latest`.

---

## 4. Environment Variables (Backend)

Set directly on the Cloud Run service (Console → Cloud Run → `sync-folio-backend` → Edit &
Deploy New Revision → Variables & Secrets) — **not** Secret Manager. This was a deliberate
choice: simpler to set up, zero cost at this scale, and avoids baking secrets into the
container image. Trade-off accepted: values are visible in plaintext to anyone with read
access to the Cloud Run service config in the console — acceptable for an internal tool,
worth revisiting (Secret Manager) if this app's data sensitivity increases.

| Variable | Notes |
|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` — uses Vertex AI (ADC-based auth via the service account), not a plain Gemini API key |
| `GOOGLE_CLOUD_PROJECT` | `sync-folio` |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `ALLOWED_ORIGINS` | Set to the **frontend's** live Cloud Run URL (CORS). Must match the browser's `Origin` header exactly — no trailing slash. |
| `FRONTEND_BASE_URL` | Same frontend URL — used for links in outgoing emails etc. |
| `BACKEND_BASE_URL` | The backend's own Cloud Run URL |
| `MODEL` | `gemini-2.5-flash` |
| `MONGO_URI` | Firestore Mongo-compatible connection string (`mongodb://...@<db>.nam5.firestore.goog:443/...`) |
| `MONGO_DB_NAME` | `sync-folio-resumes` |
| `MANAGE_INDEXES` | `false` — the `sync-folio-admin` Mongo credential lacks `datastore.indexes.create/update`; issuing those calls was observed to drop the connection rather than fail cleanly, so index management is skipped at startup (see `backend/db/seed.py`) |
| `GCS_BUCKET_NAME` | `sync-folio-resumes` |
| `LANGFUSE_*` | Observability/tracing — unchanged from local `.env` |
| `JWT_SECRET_KEY`, `JWT_ALGORITHM`, token expiry vars | Auth config |
| `EMAIL_DELIVERY_MODE`, `SMTP_*` | Outgoing email config |

The frontend Cloud Run service needs **no environment variables** — it's a pure static file
server; the API URL is permanently compiled into the JS bundle at build time via the
`VITE_API_URL` build arg.

---

## 5. CI/CD Pipeline

**File:** `azure-pipelines.yml` (repo root)
**Trigger:** push to branch `resume-sync/surya`
**Runs on:** Azure DevOps hosted `ubuntu-latest` agent

### Pipeline steps, in order

1. **Write GCP service account key to file** — pulls the `GCP_SA_KEY` secret (from the
   `gcp_deploy_secrets` variable group) into a temp file on the build agent
2. **Install gcloud CLI** — hosted agents don't have it preinstalled; adds ~45s to every run
3. **Authenticate to GCP** — `gcloud auth activate-service-account` as `sync-folio-deployer`,
   sets project, configures Docker's credential helper for Artifact Registry
4. **Build and push backend image**
5. **Deploy backend to Cloud Run** — updates `sync-folio-backend` with the new image; no
   `--set-env-vars` flag, so existing environment variables configured on the service are
   preserved and only the image changes
6. **Build and push frontend image** — `VITE_API_URL` build arg set to the backend's known
   live URL
7. **Deploy frontend to Cloud Run** — updates the `sync-folio` service
8. **Clean up service account key** — deletes the temp key file; runs even if an earlier
   step failed (`condition: always()`)

### Secret storage

- **Azure DevOps → Pipelines → Library → variable group `gcp_deploy_secrets`**
- Contains one secret variable, `GCP_SA_KEY`, holding the full JSON key contents for
  `sync-folio-deployer`
- The pipeline needed a one-time manual authorization the first time it accessed this
  variable group (standard Azure DevOps security prompt)

### Typical run time

~3.5–4.5 minutes end-to-end. Roughly fixed cost per run (no cross-run caching, since
hosted agents are ephemeral): ~46s installing gcloud, plus a full `pip install`/`npm ci`
from scratch each time (no Docker layer cache persists between runs).

### What "automatic" actually means here

Pushing to `resume-sync/surya` on GitHub (`origin`) is what starts the whole chain:
GitHub Action mirrors to Azure DevOps (triggers on push to **any** branch) → Azure
Pipeline triggers **only** on `resume-sync/surya` specifically (per the `trigger:` block
in `azure-pipelines.yml`) → build/deploy runs. Pushing to a different branch will mirror
to Azure DevOps but will **not** trigger a deploy. Expect ~4–6 minutes total from
`git push` to the change being live.

---

## 6. Manual Commands Reference

These are the actual commands used to build and push each image, and their `gcloud`
equivalents for deploying — useful for a manual/one-off deploy without going through the
console UI or waiting on the pipeline. Run from the repo root.

### One-time setup (already done, listed here for reference)

```bash
# Authenticate gcloud CLI
gcloud auth login
gcloud config set project sync-folio

# Let Docker push to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Backend — build, push, deploy

```bash
# Build
docker build -t us-central1-docker.pkg.dev/sync-folio/sync-folio/backend:v1 ./backend

# Push
docker push us-central1-docker.pkg.dev/sync-folio/sync-folio/backend:v1

# Deploy (updates the existing sync-folio-backend Cloud Run service)
gcloud run deploy sync-folio-backend \
  --image=us-central1-docker.pkg.dev/sync-folio/sync-folio/backend:v1 \
  --region=us-central1 \
  --service-account=sync-folio-backend@sync-folio.iam.gserviceaccount.com
```

### Frontend — build, push, deploy

```bash
# Build (VITE_API_URL must be the backend's real, live URL — it gets baked into the
# static JS bundle at build time and cannot be changed afterward without rebuilding)
docker build \
  --build-arg VITE_API_URL=https://sync-folio-backend-327366424759.us-central1.run.app/api \
  -t us-central1-docker.pkg.dev/sync-folio/sync-folio/frontend:v1 \
  ./frontend

# Push
docker push us-central1-docker.pkg.dev/sync-folio/sync-folio/frontend:v1

# Deploy (updates the existing sync-folio frontend Cloud Run service)
gcloud run deploy sync-folio \
  --image=us-central1-docker.pkg.dev/sync-folio/sync-folio/frontend:v1 \
  --region=us-central1
```

### Useful checks

```bash
# Confirm the backend booted and responds
curl https://sync-folio-backend-327366424759.us-central1.run.app/api/health

# Tail recent logs for a service (useful for debugging a failed revision)
gcloud run services logs read sync-folio-backend --project=sync-folio --region=us-central1 --limit=50

# List images currently in the Artifact Registry repo
gcloud artifacts docker images list us-central1-docker.pkg.dev/sync-folio/sync-folio
```

**Note:** `gcloud run deploy` without a `--set-env-vars` flag preserves whatever
environment variables are already configured on the service — only the image is updated.
The Azure Pipeline steps use this same pattern (see section 5) so routine deploys never
risk wiping the manually-configured env vars.

---

## 7. Step-by-Step: How This Was Set Up (for reference / redoing on a new project)

1. Confirmed the correct GCP project (`sync-folio`, not a different project the deploying
   account also had stale `gcloud config` pointed at) and confirmed IAM role (`roles/editor`)
2. Inventoried existing resources: Firestore database and GCS bucket already existed;
   `run.googleapis.com`, `artifactregistry.googleapis.com`, `firestore.googleapis.com`,
   `aiplatform.googleapis.com` were already enabled
3. Created `sync-folio-backend` service account, granted `Vertex AI User` + `Storage Object Admin`
   (roles determined by actually reading the code — `gcs_service.py` and `resume_tool.py` —
   rather than assuming)
4. Created the `sync-folio` Artifact Registry repo (Docker, Standard, `us-central1`)
5. Authenticated Docker locally (`gcloud auth configure-docker us-central1-docker.pkg.dev`)
6. Built and pushed the backend image manually once, as a proof of concept, before
   automating anything
7. Created the `sync-folio-backend` Cloud Run service manually through the console:
   selected the image, set region/port/service account, pasted in environment variables
   (bulk-pasted from local `.env`, excluding the `localhost` placeholder URLs), set
   authentication to public, billing to request-based, min instances to 0
8. Verified the live backend: `/api/health` returned 200, and a real Firestore-backed
   endpoint (`/api/employee-profile`) returned a correctly-structured response — proving
   the DB connection, not just that the container booted
9. Built and pushed the frontend image, passing `VITE_API_URL` as a build arg pointing at
   the backend's real Cloud Run URL (required at build time — Vite bakes it into the
   static bundle, there is no way to change it after the image is built)
10. Created the `sync-folio` (frontend) Cloud Run service — port 8080 (not 8000; nginx
    listens on 8080 per `nginx.conf`), no env vars needed, default compute service account
    (the frontend never talks to Firestore/GCS/Vertex AI directly — only the browser calls
    the backend API)
11. Went back and updated the backend's `ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` from
    `localhost` placeholders to the frontend's real URL, redeployed
12. Hit a transient failure on that redeploy: `pymongo.errors.AutoReconnect` during the
    startup HR-seed check in `db/seed.py` crashed the whole container before it could bind
    to its port. Retried the deploy with no changes — succeeded (Cloud Run's revision model
    meant the previous working revision kept serving traffic throughout, zero downtime)
13. Verified full end-to-end in the browser: login, resume upload (exercises both Vertex AI
    and GCS permissions together), resume preview
14. Created `sync-folio-deployer`, a separate service account for CI/CD (deliberately kept
    separate from the runtime account — a leaked deploy credential shouldn't also carry
    application data access), granted `Artifact Registry Writer` + `Cloud Run Admin` +
    `Service Account User`
15. Generated a JSON key for `sync-folio-deployer`, stored it as a secret variable
    (`GCP_SA_KEY`) in an Azure DevOps variable group (`gcp_deploy_secrets`), deleted the
    local copy of the key file
16. Wrote `azure-pipelines.yml`, committed it on its own (kept isolated from other unrelated
    pending changes in the working tree at the time), pushed to GitHub
17. Created the pipeline in Azure DevOps, pointed at `azure-pipelines.yml`, authorized its
    one-time request to access the `gcp_deploy_secrets` variable group
18. Ran the pipeline — full green run, ~3m 34s, all 8 steps passed

---

## 8. Known Follow-Ups (not yet done)

- **Rotate secrets** — the Mongo password, JWT signing secret, and SMTP password were at
  one point pasted into a chat session during setup. They still work as-is, but should be
  rotated (new Firestore Mongo user password, new `JWT_SECRET_KEY`, new SMTP app password)
  since those values are no longer confidential.
- **Harden `db/seed.py`** — the startup HR-seed check (`db.user_accounts.find_one(...)`)
  has no error handling; a transient Firestore connection drop there crashes the entire
  container (`sys.exit(1)` in `main.py`'s lifespan handler) instead of logging a warning
  and continuing. Already caused one failed deploy (recovered by retrying); worth fixing
  at the source.
- **`docker-compose.yml`** still hardcodes a personal Windows path
  (`C:/Users/LENOVO/AppData/Roaming/gcloud/application_default_credentials.json`) for local
  dev ADC — unrelated to the deployed path above, but worth cleaning up or documenting as
  machine-specific if other developers will use this repo.
- **Branch strategy** — the pipeline currently triggers on `resume-sync/surya` (a personal
  working branch), which was a deliberate simplification for solo iteration. Revisit once
  more than one person is contributing, so deploys are gated on a real `main`/review flow
  rather than any push to that specific branch.
