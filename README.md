# HSE Report Scanning & Compliance Review System — Pilot MVP

AI pilot for **Al-Essa** (Saudi Aramco contractor). A safety officer photographs or uploads a
filled HSE report; the AI reads it (OCR + vision), checks it against Aramco standards, and returns
**Accepted / Not Accepted / Duplicate** with findings cited to the exact Aramco clause. HSE managers
get a dashboard over the real observation data.

## What's included in this pilot

Scoped to the **3 report types the shared data supports**:

1. **HSE Observation Tracking Log** — seeded from 22 weeks of real Al-Essa data (~4,100 observations).
2. **24-Hour Initial Report** — GI 6.000 Supplement 4.
3. **Investigation Status Report** — GI 6.000 Supplement 7.

## Stack

- **Backend** — Node.js + Express + TypeScript, SQLite (`better-sqlite3`), `multer`, `xlsx`, `mammoth`, OpenAI SDK.
- **Frontend** — React + Vite + TypeScript, TailwindCSS, Recharts.
- One Express server serves the built React app **and** the `/api`.

## Prerequisites

- Node.js 20+ (built and tested on Node 22).

## Setup

```bash
cd hse-pilot
npm run install:all       # installs server + web dependencies
cp server/.env.example server/.env   # (a working .env is already included for the demo)
npm run seed              # imports the 22 weekly Excel logs into SQLite
npm run build:corpus      # indexes the 90+ Aramco PDFs/DOCX for RAG (one time)
```

`npm run build:corpus` reads every PDF/Word doc under `KNOWLEDGE_DIR` (set in `server/.env`,
defaults to the shared `Waseet Technology (AI) Solutions` folder), extracts the text, and writes a
searchable index to `server/data/corpus.json` (~6,200 passages from 118 documents).

`npm run seed` prints the row count imported per file (~4,100 total). It reads the Excel files from
`CLIENT_DATA_DIR` in `server/.env` — point that at the folder holding the
`Week NN Observation Tracking Log 2026.xlsx` files.

## Run

**Production-style (single server, serves the built UI):**

```bash
npm run build             # builds the React app into web/dist
npm start                 # http://localhost:3001
```

**Development (hot reload, two processes):**

```bash
npm run dev               # server on :3001, Vite UI on :5173 (proxies /api → :3001)
```

- **Submit Report** (`/`) — mobile-first page: take a photo or upload a file → instant verdict.
- **Manager Dashboard** (`/dashboard`) — KPIs, risk/week/category/clause/location charts, auto-flagged
  high-risk open items, recent submissions, per-reporter compliance.

## Turning on the real AI (OpenAI / ChatGPT key)

Out of the box the app runs with a **mock AI provider** so the whole flow demos without a key.
To run live OCR + extraction on **GPT-4o vision**, edit `server/.env`:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your key...
OPENAI_MODEL=gpt-4o
```

Restart the server. `GET /api/health` reports the active provider. If `AI_PROVIDER=openai` but the
key is empty, it safely falls back to the mock.

## How it works

```
upload ─▶ extract.ts ─▶ AI provider (openai | mock) ─▶ structured fields
                                   │
                                   ├─▶ duplicate.ts        (exact hash + same-reporter/near-duplicate)
                                   ├─▶ compliance/checker.ts ─▶ verdict + clause-cited findings   (shortlist)
                                   └─▶ rag/enrich.ts ──────▶ real clause text + grounded AI summary (RAG)
```

Compliance uses **two layers that complement each other**:

1. **Shortlist (curated rules)** — `server/src/services/compliance/rules.ts` defines the required
   fields per report type, each mapped to an Aramco clause; `server/src/knowledge/aramco-clauses.ts`
   resolves clause codes/titles. This drives the deterministic verdict.
2. **RAG (retrieval)** — `server/src/services/rag/` indexes the **actual text of the 90+ Aramco
   documents** (`build:corpus` → `corpus.json`) and, at check time, retrieves the real clause
   wording behind each finding (BM25 search, no API key needed). Each finding gets an `evidence`
   excerpt + source document, plus a list of `relevantClauses` for the whole report.

The AI is then **fed both** — the shortlist rules and the retrieved clause passages — to produce a
short **grounded assessment** (`review()` on the AI provider; real text with an OpenAI key, a
deterministic quote-based summary in mock mode).

- **Duplicate detection**: identical file bytes (SHA-256) → exact duplicate; same reporter + same
  report type + same narrative with only the date changed → near-duplicate.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/health` | Liveness + active AI provider |
| POST | `/api/reports` | Upload a report (`file`), returns verdict + findings |
| GET  | `/api/reports` | Recent submissions |
| GET  | `/api/reports/:id` | One submission's full detail |
| GET  | `/api/dashboard/stats` | KPIs + chart aggregations |
| GET  | `/api/dashboard/high-risk` | Open high-risk observations |
| GET  | `/api/observations` | Filterable observation list (`status`, `risk`, `week`, `location`, `q`) |

## Not in this pilot (next phase — pending client files)

- OCR for the 5 missing GI 6.000 supplements (5, 8, 9, 10, 11) and physical paper form templates.
- Scanned-PDF page rendering (camera/image is the primary path; PDFs are accepted but not OCR'd yet).
- Formally-rejected and duplicate **training** examples to tune the AI.
- Authentication/SSO, Arabic UI, and Aramco-intranet/cloud deployment.
