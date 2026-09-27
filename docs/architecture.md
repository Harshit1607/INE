# System Architecture

## 1. Overview & Infrastructure Topology

The INE Product Price Tracker is architected as a decoupled, multi-tiered system designed to operate reliably within free-tier cloud constraints while scraping a deliberately hostile mock store.

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                               SCHEDULING                                │
 │   cron-job.org: Ping /api/health at T-1m; POST /api/cron/scrape at T0   │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                      BACKEND CONTAINER (Render Docker)                  │
 │                                                                         │
 │  ┌───────────────────────────────────────────────────────────────────┐  │
 │  │                         Express REST API                          │  │
 │  │   /health   /cron/scrape   /search   /store-products   /tracked   │  │
 │  │   /runs/health             /export.csv                            │  │
 │  └─────────────────┬───────────────────────────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    ▼                               ▼                    │
 │  ┌───────────────────────────────────┐ ┌─────────────────────────────┐  │
 │  │       Catalog Snapshot Engine     │ │    Scrape Run Coordinator   │  │
 │  │  (HTTP /api/v2/listings & items)  │ │      (Mutex Lock Engine)    │  │
 │  └─────────────────┬─────────────────┘ └───────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    │                               ▼                    │
 │                    │                   ┌─────────────────────────────┐  │
 │                    │                   │      Scrape Run Service     │  │
 │                    │                   │  (Bounded Retries & Backoff)│  │
 │                    │                   └───────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    │                               ▼                    │
 │                    │                   ┌─────────────────────────────┐  │
 │                    │                   │   Playwright Price Reader   │  │
 │                    │                   │  (Headless Chromium Engine) │  │
 │                    │                   └───────────┬─────────────────┘  │
 └────────────────────┼───────────────────────────────┼────────────────────┘
                      │                               │
                      ▼                               ▼
       ┌──────────────────────────────┐ ┌──────────────────────────────┐
       │     Supabase Postgres DB     │ │      INE Mock Store SPA      │
       │ - catalog_products           │ │ - /api/v2/ui/manifest        │
       │ - tracked_products           │ │ - /item/:id (Interactive)    │
       │ - scrape_runs                │ │ - Challenge / Token API      │
       │ - scrape_attempts (Honesty)  │ └──────────────────────────────┘
       └──────────────▲───────────────┘
                      │
                      ▼
       ┌──────────────────────────────┐
       │     Frontend SPA (Vercel)    │
       │ - React 18 + Vite + Tailwind │
       │ - Recharts (Time Series)     │
       └──────────────────────────────┘
```

---

## 2. Infrastructure Tiers

| Tier | Provider | Deployment Artifact | Role & Configuration |
|---|---|---|---|
| **Frontend** | Vercel | Single-Page React App | Dashboard, variant search, price history charts, Scrape Log table, CSV export trigger. Never accesses DB directly. |
| **Backend** | Render | Docker Container (`mcr.microsoft.com/playwright:v1.63.0-noble`) | Express API, background queue, Playwright Chromium scraper, catalog snapshot sync. |
| **Database** | Supabase | Managed PostgreSQL 15 | Relational persistence, unique constraints, case-insensitive search indexes, honesty check constraint. |
| **Scheduler** | cron-job.org | External Cron Service | Triggers backend scrape every 2 hours (`0 */2 * * *` UTC) with a warm-up ping 1 min prior (`59 */2 * * *` UTC). |

---

## 3. Module Boundaries & Ports/Adapters

The backend codebase follows clean architectural seams to isolate domain logic from external side-effects and browser lifecycles:

```
src/
├── domain/                  # Pure domain types, error classifications, validator
│   ├── types.ts             # Entities: TrackedProduct, ScrapeRun, ScrapeAttempt, Outcome
│   └── validator.ts         # ReadingValidator: pure rules for product & price integrity
├── catalog/                 # Lightweight HTTP communications (No browser)
│   ├── catalog-client.ts    # HTTP client with exponential retry for store APIs
│   └── catalog-snapshot.ts  # Snapshot service: caches 960+ products in Postgres
├── reader/                  # Playwright Browser Automation
│   ├── playwright-price-reader.ts # Headless/Headed price reader, gate automation
│   └── price-normalizer.ts  # Strips zero-width chars, parses currency & stock
├── service/                 # Core Scraper Workflow & Orchestration
│   ├── scrape-run-service.ts# Retry loop, backoff with jitter, outcome derivation
│   ├── run-coordinator.ts   # Mutex locking, background promise management
│   ├── in-memory-attempt-store.ts # In-memory adapter (dry runs, seam tests)
│   └── supabase-attempt-store.ts  # Supabase Postgres adapter
├── api/                     # Express HTTP layer
│   ├── routes.ts            # Route controllers & middleware
│   └── csv-exporter.ts      # RFC 4180 CSV export generator
└── cli/                     # Command Line Entry Points
    ├── headed-runner.ts     # Visual headed scraping CLI
    └── sync-catalog.ts      # Manual snapshot synchronization CLI
```

---

## 4. Key Architectural Patterns

### A. Two-Tier Scraping Seam
- **Tier 1 (Catalogue & Metadata):** Pure HTTP + JSON (`CatalogClient`). Pulls `/api/v2/listings` and `/api/v2/items/:id` with zero browser overhead.
- **Tier 2 (Price & Stock):** Isolated Playwright Chromium sessions (`PlaywrightPriceReader`). Used only when human-like interaction and client-side challenge execution are required.

### B. Mutex Locking & Stale Run Recovery
- To prevent overlapping scrape runs from multiple cron triggers, `RunCoordinator` maintains a run lock in the `scrape_runs` table:
  1. Checks for any run with `status = 'running'`.
  2. If a running row is older than the stale threshold ($20\text{ minutes}$), it is automatically updated to `status = 'abandoned'`.
  3. If a valid active run exists, the endpoint rejects the incoming trigger with `409 Conflict`.
  4. Otherwise, creates a new `scrape_runs` entry, releases the HTTP response immediately with `202 Accepted { runId }`, and executes the scrape asynchronously in the background.

### C. Sequential Execution & Memory Safety (512MB RAM Limit)
- Free-tier hosting limits the container to 512MB RAM.
- A single browser instance is launched per Scrape Run.
- Products are processed **sequentially**, not concurrently.
- Each product/try runs in a lightweight, isolated `BrowserContext` which is closed immediately after reading.
- Media routing (`page.route()`) intercepts and aborts images, web fonts, and audio/video, keeping the browser memory footprint under $100\text{MB}$.

### D. Data Honesty Guarantee
- Enforced at both the domain layer and database level:
  ```sql
  CONSTRAINT honesty_check CHECK (
    (outcome = 'failed' AND price IS NULL AND stock_status IS NULL) OR
    (outcome IN ('success', 'retried') AND price IS NOT NULL)
  )
  ```
- If all tries fail, the outcome is recorded as `failed` with `price = null` and a machine-readable `error_code`.
- The frontend line charts configure `connectNulls={false}`, ensuring failed attempts appear as honest gaps in history.
