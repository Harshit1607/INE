# System Architecture

## 1. Topology

A React dashboard, an Express backend that owns all scraping, a Supabase Postgres database, and an external cron trigger. Everything runs on free tiers, which drives most of the design (see [`DESIGN_NOTE.md`](../DESIGN_NOTE.md)).

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                               SCHEDULING                                │
 │   cron-job.org: GET /api/health at T-1m; POST /api/cron/scrape at T0    │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                      BACKEND CONTAINER (Render, Docker)                 │
 │                                                                         │
 │  ┌───────────────────────────────────────────────────────────────────┐  │
 │  │                         Express REST API                          │  │
 │  │  /health  /cron/scrape  /runs/manual  /runs/health  /search       │  │
 │  │  /catalog  /store-products/:id  /tracked  /export.csv             │  │
 │  └─────────────────┬───────────────────────────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    ▼                               ▼                    │
 │  ┌───────────────────────────────────┐ ┌─────────────────────────────┐  │
 │  │     Catalogue snapshot service    │ │       RunCoordinator        │  │
 │  │  (HTTP /api/v2/listings & items)  │ │  (run lock, stale recovery) │  │
 │  └─────────────────┬─────────────────┘ └───────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    │                               ▼                    │
 │                    │                   ┌─────────────────────────────┐  │
 │                    │                   │      ScrapeRunService       │  │
 │                    │                   │  (bounded retries, backoff) │  │
 │                    │                   └───────────┬─────────────────┘  │
 │                    │                               │                    │
 │                    │                               ▼                    │
 │                    │                   ┌─────────────────────────────┐  │
 │                    │                   │    PlaywrightPriceReader    │  │
 │                    │                   │     (headless Chromium)     │  │
 │                    │                   └───────────┬─────────────────┘  │
 └────────────────────┼───────────────────────────────┼────────────────────┘
                      │                               │
                      ▼                               ▼
       ┌──────────────────────────────┐ ┌──────────────────────────────┐
       │     Supabase Postgres        │ │      INE mock store SPA      │
       │ - catalog_products           │ │ - /api/v2/ui/manifest        │
       │ - tracked_products           │ │ - /item/:id (gated price)    │
       │ - scrape_runs                │ │ - challenge / token API      │
       │ - scrape_attempts (honesty)  │ └──────────────────────────────┘
       └──────────────▲───────────────┘
                      │ (via the backend API only)
       ┌──────────────┴───────────────┐
       │     Frontend SPA (Vercel)    │
       │ - React 18 + Vite + Tailwind │
       │ - Recharts (time series)     │
       └──────────────────────────────┘
```

---

## 2. Infrastructure

| Tier | Provider | Artifact | Role |
|---|---|---|---|
| **Frontend** | Vercel | Static React build (`frontend/dist`) | Dashboard, search and track, price history, Scrape Log, CSV download. Talks only to the backend API, never to the database. |
| **Backend** | Render (free tier) | Docker image from the root `Dockerfile` (`mcr.microsoft.com/playwright:v1.63.0-noble`) | Express API, run coordination, Playwright scraper, catalogue snapshot sync. |
| **Database** | Supabase | Managed Postgres, schema in `supabase/schema.sql` | Tracked Products, runs, attempts, catalogue snapshot; unique and honesty constraints. |
| **Scheduler** | cron-job.org | Two HTTP jobs | Scrape trigger every 2 hours (`0 */2 * * *` UTC) and a warm-up ping one minute earlier (`59 1-23/2 * * *` UTC). |

---

## 3. Backend modules

```
backend/
├── src/
│   ├── index.ts                     # Wiring, CORS, boot-time orphaned-run recovery, catalogue freshness check
│   ├── domain/
│   │   ├── types.ts                 # TrackedProduct, ScrapeRun, ScrapeAttempt, Outcome, ErrorCode, ScrapeError, ports
│   │   └── validator.ts             # ReadingValidator: identity, price > 0, stock present
│   ├── catalog/                     # Store JSON APIs over plain HTTP (no browser)
│   │   ├── catalog-client.ts        # Manifest, listings, item details; retry with backoff
│   │   └── catalog-snapshot.ts      # Catalogue snapshot in Postgres (in-memory fallback); search and paging
│   ├── reader/                      # Playwright
│   │   ├── playwright-price-reader.ts # Interaction gate, stale-quote handling, extraction
│   │   └── price-normalizer.ts      # Invisible-character stripping, currency and stock parsing
│   ├── service/
│   │   ├── scrape-run-service.ts    # Per-product retry loop, try timeout, backoff with jitter, outcome derivation
│   │   ├── run-coordinator.ts       # Run lock, stale-run recovery, background execution
│   │   ├── supabase-attempt-store.ts  # Postgres adapter
│   │   └── in-memory-attempt-store.ts # Dry runs and tests
│   ├── api/
│   │   ├── routes.ts                # HTTP routes
│   │   └── csv-exporter.ts          # RFC 4180 CSV
│   └── cli/
│       ├── headed-runner.ts         # Visible-browser single-product run
│       └── sync-catalog.ts          # Manual catalogue snapshot sync
└── tests/
    └── scrape-run-service.test.ts   # Vitest: normaliser, validator, CSV, ScrapeRunService, RunCoordinator
```

`ScrapeRunService` depends only on the `PriceReader` and `AttemptStore` interfaces in `domain/types.ts`, so tests drive it with a fake reader and the in-memory store.

---

## 4. Key patterns

### A. Two scraping paths
- **Catalogue and metadata:** `CatalogClient` calls `/api/v2/listings`, `/api/v2/items/:id` and `/api/v2/ui/manifest` with `fetch` (10 s timeout, 3 attempts, 300 ms → 600 ms backoff). No browser.
- **Price and stock:** `PlaywrightPriceReader`, only where the store requires a real browser interaction and client-side challenge. Details in [`design.md`](design.md).

### B. Run lock and stale-run recovery
`RunCoordinator.startRun(trigger)` uses `scrape_runs` as the lock:

1. Marks any run still `running` after 20 minutes as `abandoned`.
2. If a run is still `running`, throws. Cron and manual endpoints answer `409 Conflict`; a new track's `on_track` read is skipped (the variant is picked up by the next run).
3. Otherwise inserts a `running` row, and runs the scrape in the background. The HTTP endpoints respond `202 Accepted { runId }` immediately.
4. On completion the row becomes `completed` with per-outcome counts; if the run throws, it becomes `abandoned`.

On boot, the server marks every run that started before the process booted as `abandoned`: only one instance runs, so such a run belonged to a process that crashed, was killed for memory, or was redeployed.

`on_track` runs scrape only the newly tracked variant; `cron` and `manual` runs scrape every active Tracked Product.

### C. Sequential execution within 512 MB
- One Chromium instance is launched lazily and reused.
- Tracked Products are scraped one after another, never in parallel.
- Each try gets a fresh `BrowserContext`, closed immediately after the read.
- `page.route()` aborts images, media and fonts to cut memory and bandwidth.

### D. Honesty guarantee
Enforced in `ScrapeRunService` and by the database:

```sql
CONSTRAINT honesty_check CHECK (
  (outcome = 'failed' AND price IS NULL AND stock_status IS NULL) OR
  (outcome IN ('success', 'retried') AND price IS NOT NULL)
)
```

- If every try fails, the attempt is `failed` with `price = null`, a machine-readable `error_code`, and every try's reason in `error_detail`.
- The price chart uses `connectNulls={false}`, so failed attempts are gaps (each marked with a red dashed line), never zeros or carried-forward prices.
- Price history, the Scrape Log and the CSV all come from `scrape_attempts`; there is no separate history table.

### E. Schedule health
`GET /api/runs/health` judges the schedule on `cron` runs only, so manual or on-track runs cannot hide a broken cron job. The schedule is overdue when the latest cron run started more than 150 minutes ago, or when no cron run exists. The dashboard polls every 45 s, and every 5 s while a run is in progress.
