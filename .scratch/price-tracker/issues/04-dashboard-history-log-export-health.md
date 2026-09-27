Status: ready-for-agent

# 04 — Dashboard: history, Scrape Log, CSV export and run health

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

A React dashboard deployed on Vercel that reads everything through the backend API (never directly from Supabase). It shows what the unattended Scrape Runs recorded, honestly.

- **Overview** of all Tracked Products: name, brand, category, Option (axis + label), latest price and stock, last successful scrape time, success rate. Inactive Tracked Products are marked but still viewable.
- **Per-Tracked-Product view**:
  - Price chart over time, where failed Scrape Attempts appear as gaps (never drawn as zero or carried forward).
  - Stock over time.
  - A history table with exact timestamps.
  - The **Scrape Log**: every Scrape Attempt with timestamp, Outcome (visually distinct `success` / `retried` / `failed`), tries, duration and error code.
  - Times displayed in local time, stored in UTC.
- **Run-health indicator**: last Scrape Run time and status, and a visible warning when no run has happened for noticeably longer than 2 hours (overdue).
- **Export button**: downloads the full history as CSV.
  - Exactly one row per Scrape Attempt, columns in order: `store_product_id, product_name, option, timestamp, price, stock, outcome`.
  - `store_product_id` is the ID shown in the product page URL (confirmed in 01).
  - Timestamp in ISO 8601 UTC with `Z`.
  - Failed attempts included with empty price and stock.
  - RFC 4180 quoting.
- Backend read endpoints: `GET /api/tracked`, `GET /api/tracked/:id/attempts`, `GET /api/runs/health`, `GET /api/export.csv`. CORS restricted to the deployed frontend origin (`CORS_ORIGIN`); frontend configured with `VITE_API_BASE_URL`.

## Acceptance criteria

- [ ] The public Vercel URL loads the overview with the seeded Tracked Products and their latest readings, including after the Render backend was asleep (show a loading state while it wakes).
- [ ] Each Tracked Product's chart and table match the `scrape_attempts` rows in Supabase. Failed attempts show as gaps in the chart and as `failed` rows in the Scrape Log with their error code.
- [ ] The run-health indicator shows the last run time, and switches to an overdue warning when the latest run is older than the threshold (verify by temporarily lowering the threshold or pausing cron).
- [ ] The downloaded CSV has one row per Scrape Attempt (row count equals the `scrape_attempts` count), the exact column order above, `Z`-suffixed UTC timestamps, empty price/stock on failed rows, and opens correctly in a spreadsheet even with commas or quotes in product names.
- [ ] Requests from an origin other than the frontend are rejected by CORS.
- [ ] Works on a narrow (mobile) viewport without horizontal scrolling of the main layout.

## Blocked by

- `.scratch/price-tracker/issues/03-unattended-scrape-runs-in-production.md`
