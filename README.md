# INE Product Price Tracker

A resilient, honest full-stack price and stock tracking system for INE's mock e-commerce store ([demo.inelabteamdev.com](https://demo.inelabteamdev.com)). Built with Node.js, TypeScript, Express, Playwright, React, Tailwind CSS, Supabase Postgres, and cron-job.org.

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
- **Run Lock & Cold-Start Recovery:** Prevents overlapping runs; automatically marks stale crashed runs ($> 20\text{min}$) as `abandoned`.
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
git clone <repo-url>
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
1. **Warm-Up Ping:** `GET https://<your-backend-render-url>/api/health` at `59 */2 * * *` (UTC) to warm Render's free-tier container.
2. **Scrape Trigger:** `POST https://<your-backend-render-url>/api/cron/scrape` at `0 */2 * * *` (UTC) with header:
   ```
   x-cron-secret: <CRON_SECRET>
   ```

---

## Environment Variables Reference

See [`docs/env-config.md`](docs/env-config.md) for full configuration details.

### Backend (`backend`)
- `PORT`: Server port (default: `3001`, Render: `10000`)
- `STORE_BASE_URL`: `https://demo.inelabteamdev.com`
- `CRON_SECRET`: Secret token for cron endpoint authentication
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `CORS_ORIGIN`: Allowed frontend origin (e.g. `https://your-app.vercel.app` or `*`)
- `HEADLESS`: `true` for production headless runs
- `SCRAPE_MAX_TRIES`: Maximum retries per attempt (default: `3`)
- `SCRAPE_TRY_TIMEOUT_MS`: Timeout per try in milliseconds (default: `25000`)

### Frontend (`frontend`)
- `VITE_API_BASE_URL`: Render backend API URL (e.g. `https://your-backend.onrender.com`)

---

## Deployment Instructions

1. **Backend (Render):** Deploy using Docker with root `Dockerfile`. Set environment variables in Render Dashboard.
2. **Frontend (Vercel):** Connect the GitHub repository, set root directory to `frontend`, build command `npm run build`, output directory `dist`. Set `VITE_API_BASE_URL`.
3. **Cron Job (cron-job.org):** Set up the 2-hour schedule with the `x-cron-secret` header.
