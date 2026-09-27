Status: ready-for-agent

# 03 — Unattended Scrape Runs in production

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

Get real unattended Scrape Runs happening every 2 hours as early as possible. The assignment requires the live history to reflect real unattended runs, so every hour before this is live is lost data.

- Express backend with:
  - `POST /api/cron/scrape`, protected by the `CRON_SECRET` header. It returns `401` on a bad secret, `409` when a Scrape Run is already `running`, and otherwise `202 {runId}` immediately while the run continues in the background.
  - A run lock via `scrape_runs`: a `running` row older than the stale threshold (e.g. 20 min) is marked `abandoned` and doesn't block new runs.
  - `GET /api/health` for liveness and warm-up.
- Backend deployed on Render's free tier from a Docker image based on the official Playwright image, configured through environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `STORE_BASE_URL`, `HEADLESS`, `SCRAPE_MAX_TRIES`, `SCRAPE_TRY_TIMEOUT_MS`). One browser and sequential scraping keep it within 512 MB.
- cron-job.org jobs: `POST /api/cron/scrape` at `0 */2 * * *` UTC with the secret header, plus a `GET /api/health` warm-up one minute earlier.
- At least 3 Tracked Products (different Store products, each with a chosen Option) seeded directly in Supabase, so runs have work before the search/track UI exists (05).

## Acceptance criteria

- [ ] `GET /api/health` on the Render URL responds after a cold start.
- [ ] `POST /api/cron/scrape` without or with a wrong secret → `401`. With the secret → `202` within the cron service's timeout. A second call while the first run is in progress → `409`.
- [ ] After a triggered run, Supabase shows one completed `scrape_runs` row and one `scrape_attempts` row per seeded Tracked Product.
- [ ] A `running` row older than the stale threshold is marked `abandoned`, and a new run starts.
- [ ] cron-job.org shows both jobs configured, and at least one scheduled (not manual) run has produced Scrape Attempts in Supabase.
- [ ] The Render instance doesn't crash on memory during a run of 3+ Tracked Products (check the Render logs).
- [ ] No secrets committed to the repo.

## Blocked by

- `.scratch/price-tracker/issues/01-headed-scrape-records-attempt.md`
