# INE Product Price Tracker

A resilient, honest full-stack price and stock tracking system for INE's mock e-commerce store ([demo.inelabteamdev.com](https://demo.inelabteamdev.com)). Built with Node.js, TypeScript, Express, Playwright, React, Tailwind CSS, Supabase Postgres, and cron-job.org.

- **Live dashboard:** https://ine-cy4qyry4v-harshit-barejas-projects.vercel.app/
- **Backend API:** https://ine-613p.onrender.com (health: [`/api/health`](https://ine-613p.onrender.com/api/health), schedule health: [`/api/runs/health`](https://ine-613p.onrender.com/api/runs/health))
- **Source:** https://github.com/Harshit1607/INE
- **Design note** (reliability, trade-offs, AI corrections): [`DESIGN_NOTE.md`](DESIGN_NOTE.md)

---

## Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                   External Cron Service                │
 │               (cron-job.org: 0 */2 * * *)              │
 └───────────────────────────┬────────────────────────────┘
                             │ POST /api/cron/scrape (Header: x-cron-secret)
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │              Express Backend (Render Docker)           │
 │  ┌───────────────────────┐  ┌───────────────────────┐  │
 │  │ Lightweight HTTP Sync │  │ Playwright Price Read │  │
 │  │  (/api/v2/listings)   │  │ (Headless Chromium)   │  │
 │  └──────────┬────────────┘  └──────────┬────────────┘  │
 └─────────────┼──────────────────────────┼───────────────┘
               │                          │
               ▼                          ▼
 ┌───────────────────────────┐  ┌─────────────────────────┐
 │   Supabase Postgres DB    │  │   INE Mock Store SPA    │
 │ - catalog_products        │  │ - Pointer Challenge     │
 │ - tracked_products        │  │ - Dynamic UI Manifest   │
 │ - scrape_runs (mutex lock)│  │ - Client Price Decode   │
 │ - scrape_attempts         │  └─────────────────────────┘
 └─────────────▲─────────────┘
               │ REST API (/api/tracked, /api/export.csv)
 ┌─────────────┴─────────────┐
 │    React SPA (Vercel)     │
 │ - Price Chart (Gaps)      │
 │ - Honest Scrape Log       │
 │ - Live Variant Search     │
 └───────────────────────────┘
```

---

## Features

- **Hybrid Scraping Architecture:** Fast HTTP+JSON for catalog search, caching, and product specifications; isolated Playwright Chromium sessions for interactive price and stock extraction.
- **Dynamic Selector Derivation:** Fetches `/api/v2/ui/manifest` before each run to adapt to rotating CSS class names and split character encodings.
- **Human-Like Interaction Gate:** Simulates continuous pointer movement ($\ge 12$ steps) and dwell ($\ge 750\text{ms}$) to satisfy anti-bot challenge thresholds.
- **Data Normalisation & Validation:** Strips zero-width unicode characters (`\u200B`), non-breaking spaces, and full-width digits. Validates currency, stock quantities, and variant identities.
- **Honest Outcomes & Database Constraints:** Database check constraint guarantees that failed scrape attempts never record false `0`s. Line charts show genuine gaps for failed runs.
- **Exponential Backoff with Jitter:** Transient errors (`429`, `5xx`, `timeout`) are automatically retried with fresh browser contexts.
- **Run Lock & Cold-Start Recovery:** Prevents overlapping runs. On boot, runs left `running` by a previous (dead) process are marked `abandoned`; any run still running after $20\text{min}$ is abandoned when the next run starts.
- **RFC 4180 CSV Export:** One-click download of all scrape attempts with exact timestamps and formatted variants.

---

## Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js:** v20.x or v22.x
- **npm:** v10.x or v11.x
- **Playwright Chromium Browser**

### 2. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/Harshit1607/INE.git
cd INE

# Install Backend Dependencies
cd backend
npm install
npx playwright install chromium

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 3. Database Setup (Supabase)
1. Create a free project on [Supabase](https://supabase.com).
2. Open the **SQL Editor** in Supabase.
3. Run the contents of `supabase/schema.sql`.

---

## Running the Application

### 1. Start the Backend API Server
```bash
cd backend
npm run dev
# Server listens on http://localhost:3001
```

### 2. Start the Frontend Application
```bash
cd frontend
npm run dev
# Dashboard available at http://localhost:5173
```

---

## Headed Runner CLI & Testing

The project includes a CLI runner for local debugging and video recording:

```bash
cd backend

# Run Headed with Slow Motion (250ms delay per step)
npm run scrape:headed

# Run in Dry-Run Mode (in-memory attempt store, no DB writes)
npm run scrape:headed:dry

# Target a Specific Product and Variant
npx tsx src/cli/headed-runner.ts --productId 2692 --optionId o2

# Run Headless
npm run scrape:headless
```

### Automated Seam Tests (Vitest)
```bash
cd backend
npm test
```

---

## Scraping Schedule Configuration

Automated runs in production are orchestrated by [cron-job.org](https://cron-job.org):
1. **Warm-Up Ping:** `GET https://ine-613p.onrender.com/api/health` at `59 1-23/2 * * *` (UTC), one minute before each scrape, so Render's free-tier container is awake when the trigger arrives.
2. **Scrape Trigger:** `POST https://ine-613p.onrender.com/api/cron/scrape` at `0 */2 * * *` (UTC, i.e. 00:00, 02:00, … 22:00) with header:
   ```
   x-cron-secret: <CRON_SECRET>
   ```

**Manual runs:** the dashboard's **Run scrape now** button calls `POST /api/runs/manual` (no secret). It is refused while a run is in progress (`409`) and within 10 minutes of the previous run of any kind (`429`). Manual and on-track runs are recorded with their own trigger and do not reset the schedule countdown or the overdue check, which only look at cron runs.

---

## Environment Variables Reference

See [`docs/env-config.md`](docs/env-config.md) for full configuration details.

### Backend (`backend`)
| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Server port | `3001` (Docker image sets `10000`) |
| `STORE_BASE_URL` | Mock store base URL | `https://demo.inelabteamdev.com` |
| `CRON_SECRET` | Secret the cron trigger must send as `x-cron-secret` (or `Authorization: Bearer`) | `dev-secret-123`; **must** be set in production |
| `SUPABASE_URL` | Supabase project URL | required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | required |
| `CORS_ORIGIN` | Allowed frontend origin | `*` |
| `HEADLESS` | `false` opens a visible browser | `true` |
| `SLOW_MO_MS` | Delay in ms between browser actions, for watching headed runs | `0` |
| `SCRAPE_MAX_TRIES` | Max tries per tracked product per run | `3` |
| `SCRAPE_TRY_TIMEOUT_MS` | Timeout per try in ms | `45000` |

### Frontend (`frontend`)
| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Render backend URL | empty (uses the local dev proxy) |

---

## Deployment Instructions

1. **Backend (Render):** Deploy using Docker with root `Dockerfile`. Set environment variables in Render Dashboard.
2. **Frontend (Vercel):** Connect the GitHub repository, set root directory to `frontend`, build command `npm run build`, output directory `dist`. Set `VITE_API_BASE_URL`.
3. **Cron Job (cron-job.org):** Set up the 2-hour schedule with the `x-cron-secret` header.
