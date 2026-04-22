# Auth Component Detector

Detects login/authentication components on any web page using a three-tier strategy:
1. **Static fetch** (httpx + BeautifulSoup) — fast, covers server-rendered pages
2. **Headless browser** (Playwright + Chromium) — handles SPAs and client-rendered login forms
3. **LLM fallback** (Claude) — optional, kicks in when heuristic confidence is low

---

## System Workflow (High-Level)

### Overview

A user pastes any website URL into the frontend. The frontend calls the FastAPI backend, which runs the URL through a progressive detection pipeline. Results — including the extracted HTML login snippet, confidence score, and detected field types — are returned and rendered in the UI.

```
User (Browser)
    │
    │  URL input
    ▼
Frontend (Next.js / React)
    │
    │  POST /detect
    ▼
Backend (FastAPI)
    │
    ▼
Pipeline Orchestrator  (services/pipeline.py)
    │
    ├── Tier 1: Static Scraper ──────► Heuristic Detector
    │          (httpx)                 (BeautifulSoup scoring)
    │                                         │
    │                    confidence OK? ───► Return result
    │                                         │
    │                    confidence LOW? ─────┤
    │                                         │
    ├── Tier 2: Headless Browser ────► Heuristic Detector (re-run)
    │          (Playwright/Chromium)          │
    │                                         │
    │                    still LOW? ──────────┤
    │                                         │
    └── Tier 3: LLM Fallback ────────► Structured JSON result
               (Claude API, optional)
```

---

### Pipeline Steps in Detail

#### Step 1 — Static Fetch (`scraper/static.py`)

The pipeline opens with a lightweight HTTP GET via `httpx`, using browser-like headers to reduce bot detection. This is fast (~1–2s) and works well for traditional server-rendered pages (e.g. GitHub, PyPI, MediaWiki).

#### Step 2 — Heuristic Detection (`detector/heuristic.py`)

The fetched HTML is parsed with BeautifulSoup and scored on a 0.0–1.0 confidence scale. Detection takes one of two paths:

**Path A — Page has `<form>` tags:**
Each form is scored on multiple weighted signals:
- Presence of `<input type="password">` (+0.4)
- Username/email input in same form (+0.2)
- Form `action` URL contains auth keywords like `login`, `signin`, `session` (+0.15)
- Form `id` or `class` contains auth keywords (+0.1)
- Submit button text matches known phrases ("Log in", "Sign in", etc.) (+0.1)
- ARIA labels containing auth keywords (+0.05)

The highest-scoring form is selected. A score ≥ 0.4 is considered a successful detection.

**Path B — No `<form>` tags (SPA pattern):**
Modern SPAs (like Twitter/X) inject inputs directly into `div` containers without a `<form>` wrapper. The detector falls back to page-wide signals:
- Password input anywhere on the page (+0.4)
- Username/email input (+0.2)
- Page heading text matches ("Sign in", "Welcome back", etc.) (+0.25)
- Button or link with auth text (+0.1)
- `data-testid` attributes containing auth keywords (+0.1)

**Bot protection detection:** If the page has no interactive inputs and contains phrases like "checking your browser" or "access denied", the page is flagged as bot-protected rather than falsely reporting no login form.

#### Step 3 — Headless Fallback (`scraper/headless.py`)

Triggered when:
- The static fetch fails entirely
- Bot protection was detected (stealth browser may bypass it)
- Heuristic confidence is below the threshold
- A SPA pattern was detected but the score is still uncertain

A stealth-configured Chromium instance is launched via Playwright with:
- `--disable-blink-features=AutomationControlled` to avoid headless fingerprinting
- Injected JavaScript to spoof `navigator.webdriver`, plugins, and language arrays
- A realistic viewport (1280×800) and `Accept-Language` headers
- A smart wait strategy: up to 8s for known auth input selectors, then a flat 3s fallback

The heuristic detector re-runs on the rendered HTML. If the headless result scores higher than the static result, it replaces it.

#### Step 4 — LLM Fallback (`detector/llm.py`)

Optional. Activated only when both `ENABLE_LLM_FALLBACK=true` and a valid `ANTHROPIC_API_KEY` are set.

When heuristic confidence remains low after both scraping tiers, the HTML is cleaned (scripts, styles, and SVGs stripped; whitespace compressed; truncated to 8,000 chars) and sent to `claude-sonnet-4-5`. The model returns structured JSON:

```json
{
  "found": true,
  "confidence": 0.9,
  "detected_fields": ["password", "username_or_email"],
  "form_action": "/login",
  "reasoning": "Found <input type=\"password\"> and autocomplete=\"username\""
}
```

#### Step 5 — Response

The pipeline always returns a `DetectionResult` object:

| Field | Description |
|---|---|
| `url` | The URL that was analyzed |
| `found` | Whether an auth component was detected |
| `confidence` | Score from 0.0 to 1.0 |
| `method` | Which tier succeeded: `static`, `headless`, `llm`, or `none` |
| `html_snippet` | Cleaned HTML of the detected login form (≤ 2,000 chars) |
| `detected_fields` | e.g. `["password", "username_or_email"]` |
| `form_action` | The form's `action` attribute if present |
| `bot_protection` | `true` if the site actively blocked scraping |
| `fallback_reason` | Explains why a higher tier was needed |
| `error` | Error message if all tiers failed |

---

### Frontend

A Next.js App Router single-page app (`ClientPage.tsx`) that:
- Accepts any URL via text input or one-click sample buttons (GitHub, LinkedIn, Docker Hub, etc.)
- Shows a loading state while the backend pipeline runs
- Renders results across three tabs:
  - **HTML Snippet** — syntax-highlighted extracted form HTML with a copy button
  - **Auth Keywords** — badge list of detected field types and form metadata
  - **Raw JSON** — full API response for debugging
- Displays a stats row showing forms found, password inputs, auth keywords, and fetch method used
- Shows an orange warning banner when bot protection is detected

---

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

---

## Local Setup

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 20+ (see `.nvmrc`) |
| npm | 9+ |
| Git | any recent |

---

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

---

### 2. Backend Setup

#### 2a. Create and activate a virtual environment

```bash
cd backend

python3 -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

You should see `(venv)` in your shell prompt.

#### 2b. Install Python dependencies

```bash
pip install -r requirements.txt
```

#### 2c. Install the Playwright browser

```bash
playwright install chromium

# On Linux you may also need system dependencies:
playwright install-deps chromium
```

#### 2d. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set values as needed:

```env
# Optional — enables the Claude LLM fallback tier
ANTHROPIC_API_KEY=sk-ant-...

# Detection tuning
CONFIDENCE_THRESHOLD=0.5        # minimum score to consider auth "found"
ENABLE_LLM_FALLBACK=false       # set to true to enable Claude fallback

# Scraping behaviour
REQUEST_TIMEOUT_SECONDS=15
USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36

# CORS — must exactly match your frontend origin
FRONTEND_ORIGIN=http://localhost:3000
```

> **Note:** The app works without an `ANTHROPIC_API_KEY`. The LLM tier simply won't activate unless both the key and `ENABLE_LLM_FALLBACK=true` are set.

#### 2e. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

Verify it's running:
- Health check: http://localhost:8000/health → should return `{"status": "ok"}`
- Interactive API docs (Swagger UI): http://localhost:8000/docs

---

### 3. Frontend Setup

Open a **new terminal** (keep the backend running).

#### 3a. Install Node dependencies

```bash
cd frontend
npm install
```

#### 3b. Configure environment variables

```bash
cp .env.local.example .env.local
```

`.env.local` should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3c. Start the development server

```bash
npm run dev
```

The UI is available at: http://localhost:3000

---

### 4. Running Tests

---

### 5. Quick Smoke Test via curl

With the backend running, test a detection directly from your terminal:

```bash
curl -X POST http://localhost:8000/detect \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/login"}'
```

Expected response (abbreviated):

```json
{
  "url": "https://github.com/login",
  "found": true,
  "confidence": 0.77788,
  "method": "static",
  "detected_fields": ["password", "username_or_email"],
  "form_action": "/session",
  "bot_protection": false
}
```

---

### Troubleshooting

| Symptom | Fix |
|---|---|
| `playwright install` fails on Linux | Run `playwright install-deps chromium` to install system libraries |
| CORS errors in the browser | Ensure `FRONTEND_ORIGIN=http://localhost:3000` is set in `backend/.env` and matches exactly |
| Headless browser times out frequently | Increase `REQUEST_TIMEOUT_SECONDS` in `.env` (try `30`) |
| LLM fallback not activating | Confirm `ENABLE_LLM_FALLBACK=true` and a valid `ANTHROPIC_API_KEY` are both set |
| `ModuleNotFoundError` on startup | Make sure the virtual environment is activated: `source venv/bin/activate` |
| Port 8000 already in use | Change the port: `uvicorn app.main:app --reload --port 8001` and update `NEXT_PUBLIC_API_URL` accordingly |

---

## Deployment

| Service | Platform |
|---|---|
| Backend | Render (uses `Dockerfile`) |
| Frontend | Vercel |
