# Between Points MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable first-version Python-backed web app for Between Points with local multi-user data, daily check-ins, charts, analysis, history editing, import confirmation, predictions, and bilingual UI.

**Architecture:** Use a Dockerized Python backend that serves JSON APIs, a separate Dockerized JavaScript frontend served by Nginx, and PostgreSQL for persistence. Keep business logic in `backend/core.py` so Python unit tests can verify records, moving averages, predictions, import parsing, and user isolation. Use `backend/server.py` for HTTP routing, `backend/storage.py` for PostgreSQL persistence, and `frontend/app.js` for DOM state, API calls, rendering, and interactions.

**Tech Stack:** Python standard library (`http.server`, `unittest`), Psycopg 3, PostgreSQL, Docker Compose, Nginx, HTML, CSS, ES modules, Canvas charts, browser localStorage for session convenience.

---

## File Structure

- `backend/__init__.py`: package marker.
- `backend/core.py`: pure data and analytics functions.
- `backend/storage.py`: PostgreSQL repository and row serialization.
- `backend/server.py`: HTTP API and static file server.
- `backend/requirements.txt`: Python backend dependencies.
- `backend/Dockerfile`: backend image.
- `frontend/index.html`: SPA shell and fixed navigation targets.
- `frontend/i18n.js`: Simplified Chinese and English translation dictionaries.
- `frontend/app.js`: API calls, routing, form handling, rendering, canvas chart calls.
- `frontend/styles.css`: dark dashboard visual system and responsive layout.
- `frontend/nginx.conf`: static frontend and `/api` reverse proxy.
- `frontend/Dockerfile`: frontend image.
- `docker-compose.yml`: frontend, backend, and PostgreSQL services.
- `.env.example`: deployment defaults.
- `tests/test_core.py`: tests for core behaviors from the design doc.
- `tests/test_storage.py`: optional PostgreSQL integration tests when `TEST_DATABASE_URL` is set.

## Tasks

### Task 1: Backend Tests

**Files:**
- Create: `tests/test_core.py`
- Create: `tests/test_storage.py`

- [ ] Write failing tests for account normalization, numeric validation, moving averages, chart summaries, prediction ranges, CSV parsing, import confirmation, login-as-register, record upsert, and multi-user isolation.
- [ ] Run `python -m unittest discover -s tests`.
- [ ] Expected: tests fail because backend modules do not exist yet.

### Task 2: Python Backend

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/core.py`
- Create: `backend/storage.py`
- Create: `backend/server.py`

- [ ] Implement pure functions in `backend/core.py`.
- [ ] Implement PostgreSQL repository in `backend/storage.py`.
- [ ] Implement API routes in `backend/server.py`.
- [ ] Add `backend/requirements.txt` and backend Dockerfile.
- [ ] Run `python -m unittest discover -s tests`.
- [ ] Expected: all backend tests pass.

### Task 3: Static App UI

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/i18n.js`
- Create: `frontend/app.js`
- Create: `frontend/styles.css`

- [ ] Build login-as-register flow.
- [ ] Add language switcher and persist current user's language preference through backend.
- [ ] Add dashboard with daily check-in, weight stepper, goal progress, weight/exercise/sleep canvas charts, and prediction card.
- [ ] Add analysis page with basic nutrition, tag impact, sleep, and prediction accuracy panels.
- [ ] Add history page with filters and inline edit/delete actions.
- [ ] Add import page with CSV paste/upload, manual row add, image fallback message, editable confirmation table, and commit-to-records action.
- [ ] Keep all UI strings in `frontend/i18n.js`.
- [ ] Add frontend Dockerfile and Nginx proxy config.

### Task 4: Docker Deployment

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] Define `db`, `backend`, and `frontend` services.
- [ ] Expose frontend on port `4173`.
- [ ] Expose backend on port `8000` for direct API debugging.
- [ ] Configure backend with `DATABASE_URL=postgresql://between_points:between_points@db:5432/between_points`.
- [ ] Persist PostgreSQL data with a named volume.

### Task 5: Verification

**Files:**
- Verify all app files.

- [ ] Run `python -m unittest discover -s tests`.
- [ ] Run `docker compose config`.
- [ ] Start the app with `docker compose up --build`.
- [ ] Open `http://127.0.0.1:4173` in the in-app browser.
- [ ] Verify desktop and mobile widths render without overlapping text and that login, save, language switch, import, and navigation work.
