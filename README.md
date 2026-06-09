# Between Points

React + Python + PostgreSQL weight tracking app for daily check-ins, trend analysis, Excel import, and optional image parsing.

Users can browse an empty dashboard before logging in. Mutating actions open a login modal, date views are constrained to a six-month range, and the interface supports dark and light themes.

## Stack

- Frontend: React, Vite, Nginx
- Mini Program: native WeChat Mini Program in `miniprogram/`
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

WeChat Mini Program login uses `wx.login` and the backend `/api/wechat/login` route:

```text
WECHAT_APP_ID=...
WECHAT_APP_SECRET=...
```

For local Mini Program development, you can set `WECHAT_MOCK_OPENID=local-openid` and open `miniprogram/` in WeChat DevTools. The default API base URL is `http://127.0.0.1:4173`; for production, deploy the backend behind HTTPS and configure that domain in the WeChat Mini Program request domain allowlist.

## Verification

```powershell
python -m unittest discover -s tests
node tests\miniprogram_contracts.mjs
node tests\browser_smoke.mjs
```
