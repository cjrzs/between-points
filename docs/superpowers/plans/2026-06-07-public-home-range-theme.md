# Public Home, Date Range, and Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see an empty home dashboard before login, require login for mutations, filter data by a maximum six-month date range, and add light/dark theme switching.

**Architecture:** Keep the existing single React entrypoint and API surface. Treat anonymous users as a read-only UI state backed by empty display data, then open the login modal only when a protected action is requested. Store display range and theme locally in the frontend.

**Tech Stack:** React, Vite, CSS variables, Docker Compose, headless Chrome smoke test.

---

### Task 1: Regression Smoke Test

**Files:**
- Modify: `tests/browser_smoke.mjs`

- [ ] Add assertions that the first screen is the dashboard, not the login page.
- [ ] Add assertions that unauthenticated save opens a transparent login modal.
- [ ] Add assertions that login closes the modal and shows the username in the account area.
- [ ] Add assertions that date range inputs exist and history only shows rows inside a six-month window.
- [ ] Add assertions that light mode can be toggled.
- [ ] Run `node tests\browser_smoke.mjs` and confirm it fails before production changes.

### Task 2: Anonymous Dashboard and Login Modal

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/i18n.js`
- Modify: `frontend/src/styles.css`

- [ ] Replace the full-page login gate with an anonymous dashboard state.
- [ ] Add `requireLogin(action)` so save/import/history mutations open login when anonymous.
- [ ] Render login as a modal with transparent backdrop.
- [ ] Show a Login button when anonymous and the username plus logout when authenticated.

### Task 3: Six-Month Date Range

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/i18n.js`

- [ ] Replace the single display end date with start/end inputs.
- [ ] Clamp the selected range to at most six months.
- [ ] Apply the range to dashboard, analysis, and history display data.
- [ ] Keep import using full data.

### Task 4: Light Theme

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/i18n.js`
- Modify: `frontend/src/styles.css`

- [ ] Add a theme toggle in the topbar.
- [ ] Persist theme to `localStorage`.
- [ ] Convert dark palette to CSS variables and add light-mode overrides.

### Task 5: Verification and Push

**Files:**
- Modify: `README.md` if commands or behavior changed.

- [ ] Run `docker compose up --build -d`.
- [ ] Run `python -m unittest discover -s tests`.
- [ ] Run `node tests\browser_smoke.mjs`.
- [ ] Confirm `docker compose ps` and frontend HTTP 200.
- [ ] Commit and push `main` to `origin`.

