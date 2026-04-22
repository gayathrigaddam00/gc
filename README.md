# Auth Component Detector

Detects login/authentication components on any web page using a two-tier strategy:
1. **Static fetch** (httpx + BeautifulSoup) — fast, covers server-rendered pages
2. **Headless browser** (Playwright + Chromium) — handles SPAs and client-rendered login forms
3. **LLM fallback** (Claude) — optional, kicks in when heuristic confidence is low

## Architecture

```
backend/
  app/
    scraper/    static.py + headless.py
    detector/   heuristic.py + llm.py
    services/   pipeline.py  (orchestrator)
    main.py     FastAPI routes
frontend/
  app/          Next.js App Router
  components/   UrlInput, ResultCard, HtmlSnippet
  lib/api.ts    Backend client
```

## Local Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY if you want LLM fallback

uvicorn app.main:app --reload --port 8000
```

API available at http://localhost:8000  
Swagger UI at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install

cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

UI available at http://localhost:3000

### Tests

```bash
cd backend
source venv/bin/activate

# Unit tests (no network)
pytest tests/test_heuristic.py -v

# Integration tests (real network, five sample sites)
pytest tests/test_pipeline.py -v -m integration
```

## Deployment

| Service  | Platform |
|----------|----------|
| Backend  | Railway (uses Dockerfile) |
| Frontend | Vercel   |

Set `FRONTEND_ORIGIN` in Railway to your Vercel URL.  
Set `NEXT_PUBLIC_API_URL` in Vercel to your Railway URL.
