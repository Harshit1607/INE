# INE Product Price Tracker

Tracks the price and stock of chosen product variants on INE's mock store ([demo.inelabteamdev.com](https://demo.inelabteamdev.com)) every 2 hours, and records every scrape honestly: a failed read is stored as a failure, never as a zero or a carried-forward price.

Stack: Node.js, TypeScript, Express, Playwright, React, Tailwind CSS, Recharts, Supabase Postgres, cron-job.org.

- **Live dashboard:** https://ine-taupe.vercel.app/
- **Backend API:** https://ine-613p.onrender.com (health: [`/api/health`](https://ine-613p.onrender.com/api/health), schedule health: [`/api/runs/health`](https://ine-613p.onrender.com/api/runs/health))
- **Source:** https://github.com/Harshit1607/INE
- **Design note** (reliability, trade-offs, AI corrections): [`DESIGN_NOTE.md`](DESIGN_NOTE.md)
- **Further docs:** [`docs/index.md`](docs/index.md)

---

## Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   External Cron Service                │
 │               (cron-job.org: 0 */2 * * *)              │
 └───────────────────────────┬────────────────────────────┘
                             │ POST /api/cron/scrape (header: x-cron-secret)
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │              Express Backend (Render, Docker)          │
 │  ┌───────────────────────┐  ┌───────────────────────┐  │
 │  │ Catalogue over HTTP   │  │ Playwright price read │  │
 │  │ (/api/v2/listings,    │  │ (headless Chromium)   │  │
 │  │  /api/v2/items/:id)   │  │                       │  │
 │  └──────────┬────────────┘  └──────────┬────────────┘  │
 └─────────────┼──────────────────────────┼───────────────┘
               │                          │
               ▼                          ▼
 ┌───────────────────────────┐  ┌─────────────────────────┐
 │   Supabase Postgres       │  │   INE mock store (SPA)  │
 │ - catalog_products        │  │ - pointer/dwell gate    │
 │ - tracked_products        │  │ - rotating UI manifest  │
 │ - scrape_runs (run lock)  │  │ - client-side price     │
 │ - scrape_attempts         │  │   decoding              │
 └─────────────▲─────────────┘  └─────────────────────────┘
               │ REST API (/api/tracked, /api/export.csv, …)
 ┌─────────────┴─────────────┐
 │    React SPA (Vercel)     │
 │ - price chart with gaps   │
 │ - scrape log              │
 │ - search and track        │
 └───────────────────────────┘
```

Details: [`docs/architecture.md`](docs/architecture.md).

---

## Features

- **Hybrid scraping:** catalogue search, product details and options come from the store's JSON APIs over plain HTTP. A Playwright Chromium browser is used only to read the gated price and stock.
- **Manifest-driven selectors:** fetches `/api/v2/ui/manifest` before each read, so rotating class names and price encodings are handled without hardcoded class names.
- **Human-like interaction gate:** 12 pointer moves across the price panel and a 750 ms dwell (the store requires at least 8 moves and 600 ms), then a trusted click, re-clicked if the store drops it.
- **Stale-quote rejection:** dimmed "Refreshing prices" quotes are rejected and re-requested; if only stale quotes arrive the try fails with `stale_price`.
- **Normalisation and validation:** strips zero-width characters, non-breaking spaces and full-width digits; parses INR, EUR, USD and GBP; validates product/option identity, price > 0 and stock.
- **Honest outcomes:** a database check constraint makes a `failed` attempt carry no price or stock. Charts show failed runs as gaps with a red marker.
- **Retries with backoff and jitter:** retryable errors (timeouts, `429`, `5xx`, stale quotes, invalid readings) are retried in a fresh browser context, up to 3 tries per product.
- **Run lock and crash recovery:** only one run at a time. On boot, runs left `running` by a previous process are marked `abandoned`; a run still `running` after 20 minutes is abandoned when the next run starts.
- **CSV export:** one-click RFC 4180 download of every scrape attempt.

---

## Local setup

### 1. Prerequisites

- **Node.js 22 or newer** (the backend uses `Promise.withResolvers`, which Node 20 lacks).
- A free [Supabase](https://supabase.com) project. Without one the API cannot store or read tracked products; the headed runner still works in dry-run mode.

### 2. Install

```bash
git clone https://github.com/Harshit1607/INE.git
cd INE

cd backend
npm install
npx playwright install chromium

cd ../frontend
npm install
```

### 3. Database

1. In the Supabase dashboard, open the **SQL Editor**.
2. Run the contents of [`supabase/schema.sql`](supabase/schema.sql). It creates the four tables and seeds three Tracked Products.

### 4. Backend environment

Create `backend/.env` (it is git-ignored):

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CRON_SECRET=<any-long-random-string>
```

Every other variable has a working default; see [Environment variables](#environment-variables).

The frontend needs no configuration locally: with `VITE_API_BASE_URL` unset, Vite proxies `/api` to `http://localhost:3001`.

---

## Running

```bash
# Terminal 1: backend API on http://localhost:3001
cd backend
npm run dev

# Terminal 2: dashboard on http://localhost:5173
cd frontend
npm run dev
```

On boot the backend syncs the catalogue snapshot in the background if it is missing or older than 24 hours. To sync it by hand: `npm run snapshot:sync` in `backend`.

### Headed runner (CLI)

Scrapes one Tracked Product in a visible browser and prints the recorded Scrape Attempt. Used for local debugging and the screen recording.

```bash
cd backend

# Visible browser, 250 ms slow motion, writes to Supabase
npm run scrape:headed

# Same, but records into an in-memory store (no database writes)
npm run scrape:headed:dry

# Headless
npm run scrape:headless

# A specific product and option (defaults: --productId 2692 --optionId o2)
npx tsx src/cli/headed-runner.ts --productId 2818 --optionId o1
```

Notes:

- Dry-run mode is also used automatically when `SUPABASE_URL` is unset.
- The runner always uses 3 tries, a 45 s try timeout, and 250 ms slow motion when headed; it ignores `SCRAPE_MAX_TRIES` and `SLOW_MO_MS`.
- `HEADLESS=true` in the environment forces headless mode.

### Tests

```bash
cd backend
npm test
```

Vitest covers the normaliser, validator, CSV exporter, `ScrapeRunService` (outcomes, retries, try timeout, per-product isolation) and `RunCoordinator`, using a fake Price Reader and the in-memory attempt store. The Playwright Price Reader itself is verified by headed runs against the live store.

---

## API

All routes are served under `/api` (and also at the root path).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness and warm-up ping |
| `POST` | `/api/cron/scrape` | Start a scheduled run. Requires `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`. `202` with `runId`, `409` if a run is active, `401` on a bad secret |
| `POST` | `/api/runs/manual` | Start a manual run from the dashboard. `409` while a run is active, `429` within 10 minutes of the previous run |
| `GET` | `/api/runs/health` | Latest run, last cron run time, minutes since it, and `isOverdue` |
| `GET` | `/api/search?q=` | Search the catalogue snapshot by name |
| `GET` | `/api/catalog?offset=&limit=` | Page through the catalogue snapshot (limit 1–50, default 10) |
| `GET` | `/api/store-products/:id` | Live product details and options from the store |
| `GET` | `/api/tracked` | Tracked Products with latest reading, success rate and attempt count |
| `POST` | `/api/tracked` | Track `{ storeProductId, optionId }` and start an immediate `on_track` read. `409` if already tracked |
| `DELETE` | `/api/tracked/:id` | Untrack (sets `active = false`; history is kept) |
| `GET` | `/api/tracked/:id/attempts` | One Tracked Product and all its Scrape Attempts |
| `GET` | `/api/export.csv` | Every Scrape Attempt as CSV |

---

## Scraping schedule

Production runs are triggered by [cron-job.org](https://cron-job.org):

1. **Warm-up ping:** `GET https://ine-613p.onrender.com/api/health` at `59 1-23/2 * * *` (UTC), one minute before each scrape, so Render's free-tier container is awake when the trigger arrives.
2. **Scrape trigger:** `POST https://ine-613p.onrender.com/api/cron/scrape` at `0 */2 * * *` (UTC: 00:00, 02:00, … 22:00) with the header:
   ```
   x-cron-secret: <CRON_SECRET>
   ```

The endpoint answers `202 Accepted` immediately and scrapes in the background, so cron-job.org's short request timeout is never hit.

The schedule is **overdue** when no cron run has started for more than 150 minutes (or none exists). Manual and `on_track` runs are recorded with their own trigger and do not affect the countdown or the overdue check.

---

## Environment variables

Full reference with examples: [`docs/env-config.md`](docs/env-config.md).

### Backend (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | none; required for the API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only, never the frontend) | none; required for the API |
| `CRON_SECRET` | Secret the cron trigger sends as `x-cron-secret` or `Authorization: Bearer` | `dev-secret-123`; **must** be set in production |
| `PORT` | HTTP port | `3001` (the Docker image sets `10000`) |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated, or `*` | `*` |
| `STORE_BASE_URL` | Mock store base URL | `https://demo.inelabteamdev.com` |
| `HEADLESS` | `false` opens a visible browser | `true` |
| `SLOW_MO_MS` | Delay in ms between browser actions (server only) | `0` |
| `SCRAPE_MAX_TRIES` | Max tries per Tracked Product per run (server only) | `3` |
| `SCRAPE_TRY_TIMEOUT_MS` | Timeout per try in ms | `45000` |

### Frontend (`frontend/.env.local` or Vercel settings)

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend base URL, e.g. `https://ine-613p.onrender.com` | empty (uses the Vite dev proxy to `localhost:3001`) |

---

## Deployment

1. **Backend (Render):** create a Docker web service from this repo using the root [`Dockerfile`](Dockerfile) (Playwright base image, listens on port `10000`). Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `CORS_ORIGIN` (the Vercel URL).
2. **Frontend (Vercel):** import the repo with root directory `frontend`, build command `npm run build`, output directory `dist`. Set `VITE_API_BASE_URL` to the Render URL.
3. **Scheduler (cron-job.org):** create the two jobs described in [Scraping schedule](#scraping-schedule).
