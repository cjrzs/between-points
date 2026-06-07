# Between Points

React + Python + PostgreSQL weight tracking app for daily check-ins, trend analysis, Excel import, and optional image parsing.

## Stack

- Frontend: React, Vite, Nginx
- Backend: Python standard-library HTTP server
- Database: PostgreSQL 16
- Deployment: Docker Compose

## Start

```powershell
docker compose up --build -d
```

Open:

```text
http://127.0.0.1:4173
```

## Configuration

Copy `.env.example` to `.env` when you need custom settings.

Optional image parsing can call an OpenAI-compatible chat completion endpoint:

```text
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
```

Without these values, image import falls back to local OCR-style parsing heuristics.

## Verification

```powershell
python -m unittest discover -s tests
node tests\browser_smoke.mjs
```

