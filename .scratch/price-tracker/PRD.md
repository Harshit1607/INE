Status: ready-for-agent

# PRD: INE Product Price Tracker

## Problem Statement

I need to track the price and stock of specific products on INE's hosted mock store (https://demo.inelabteamdev.com) over time. Each product has several **Options** (storage size, tone, kit, pack size…), and each Option has its own price, so "the price of a product" is meaningless unless the Option is fixed.

The store is deliberately hostile to scraping:

- The storefront is a client-rendered SPA: the HTML response is an empty `#root` shell, so plain HTML fetching finds nothing.
- Catalogue data (names, brands, categories, specs, reviews, Options) comes from a JSON API, but **price and stock do not**. They are only revealed after a human-like interaction on the product page: hovering over the price area with enough pointer movement, dwelling, then clicking. That triggers a challenge → pass-token → encoded price response which the page decodes client-side.
- Styling class names rotate: a UI manifest endpoint publishes the current class names, a revision, an expiry (`validUntil`), a field order and a "split" price carrier. Hard-coded selectors will silently break.
- Prices change often, some content arrives asynchronously after a delay, and responses are sometimes slow, rate-limited (429), rejected (401/403) or failing (5xx).

Checking by hand every two hours isn't realistic, and a naive scraper would eventually either stop without anyone noticing or record wrong data (stale price from the previous Option, a placeholder, an empty value, a price with invisible characters). I need a tracker whose history I can trust. When it fails, I want to see that it failed, not a made-up number.

The deliverable is also a graded internship assignment with a hard deadline (27 Sep 2026, 11:59 PM IST). The live dashboard must show real unattended runs of at least 2–3 Tracked Products at submission time.

## Solution

A small full-stack web app:

- **Search & track**: I type part or all of a product name, see matching store products, open one, pick an Option, and track it. Tracking a product + Option pair creates a **Tracked Product**.
- **Scheduled scraping**: every 2 hours an external cron service (cron-job.org) calls the backend. The backend starts a **Scrape Run** that visits each active Tracked Product in a real (headless) browser, performs the interaction the store requires, reads the price and stock, validates them, retries on transient failure, and records exactly one **Scrape Attempt** per Tracked Product with an honest **Outcome**: `success`, `retried` or `failed`.
- **Dashboard**: per Tracked Product, a price/stock history chart and table, a Scrape Log of every Scrape Attempt (including failures and their reasons), product details (brand, category, specs, rating), and a run-health indicator that shows when the schedule is overdue.
- **Export**: one button downloads the complete scrape history as CSV. There is one row per Scrape Attempt, and failures are included with empty price and stock.
- **Headed mode**: a local command runs the same scraper in a visible, slowed-down browser against the real store so its behaviour, including retries on slow or failing responses, can be watched and screen-recorded.

The scraper is split on purpose. Search and product metadata use **lightweight HTTP + JSON**. Only the price/stock read, which genuinely needs a real browser because of the interaction gate and client-side decoding, uses **Playwright**.

Deployment: React frontend on Vercel, Express backend on Render (free tier, Docker image with Playwright's Chromium), Supabase Postgres for data, cron-job.org for scheduling.

## User Stories

### Search & selection
1. As a user, I want to search the store by a partial product name, so that I can find a product without knowing its exact title.
2. As a user, I want to search by the full product name, so that I can jump straight to a product I already know.
3. As a user, I want search to be case-insensitive, so that "veloria" and "Veloria" return the same results.
4. As a user, I want each search result to show name, brand, category and store product ID, so that I can tell similar products apart.
5. As a user, I want a clear "no products match" message, so that I know an empty result is real rather than a broken search.
6. As a user, I want search to keep working when the backend has just woken from sleep, so that the first search after idle doesn't fail or return a partial catalogue.
7. As a user, I want to open a search result and see its available Options with the Option axis name (e.g. "Tone: Warm white / Neutral white / …"), so that I can choose which variant to track.
8. As a user, I want to see product details (description, specs, rating/reviews summary) before tracking, so that I'm sure I picked the right product.
9. As a user, I want to track a specific product + Option pair, so that price history refers to exactly one sellable variant.
10. As a user, I want to track several Options of the same product as separate Tracked Products, so that I can compare variants.
11. As a user, I want to be prevented from tracking the same product + Option twice, so that history isn't duplicated.
12. As a user, I want an immediate first scrape when I start tracking, so that I see a data point without waiting up to 2 hours.
13. As a user, I want to stop tracking a product, so that it's no longer scraped, while its past history remains visible and exportable.

### Scheduled scraping
14. As the operator, I want scrapes triggered every 2 hours by an external cron service, so that scraping continues while the free-tier backend is asleep between runs.
15. As the operator, I want the cron endpoint protected by a shared secret, so that strangers can't trigger scrape runs or exhaust resources.
16. As the operator, I want the cron endpoint to acknowledge immediately and do the work in the background, so that the cron service's short request timeout never kills or falsely fails a run.
17. As the operator, I want overlapping triggers to be ignored while a Scrape Run is in progress, so that two runs never scrape and write concurrently.
18. As the operator, I want a Scrape Run that crashed mid-way to be detected as stale and not block future runs forever, so that the schedule recovers without manual intervention.
19. As the operator, I want each Tracked Product scraped independently, so that one product failing never prevents the others from being scraped.
20. As the operator, I want every active Tracked Product to get exactly one Scrape Attempt record per Scrape Run, whatever happens, so that no scrape attempt ever goes unrecorded.
21. As the operator, I want transient failures (timeouts, slow loads, 429, 5xx, missing element, stale manifest) retried with exponential backoff and jitter, so that temporary problems don't turn into failed data points.
22. As the operator, I want a bounded number of retries and a per-attempt time budget, so that one stuck product can't consume the whole run or the instance's memory.
23. As the operator, I want each retry to use a fresh page/context, so that state from a failed try (half-loaded DOM, stale token, stuck hover) can't contaminate the next try.
24. As the operator, I want the scraper to read the current UI manifest and derive selectors from it on every Scrape Attempt, so that rotating class names never break extraction.
25. As the operator, I want the scraper to confirm the selected Option is actually active on the page before reading, so that it never records the previous Option's price.
26. As the operator, I want the scraper to wait for a real value (not a loader, placeholder, or "Hover over the price area…" / "Hold on — checking availability…" message) rather than sleep a fixed time, so that late-loading content is read correctly and fast.
27. As the operator, I want the scraper to perform the required hover, pointer-movement, dwell and click interaction, so that the store releases the price.
28. As the operator, I want price text normalised (invisible zero-width characters stripped, split fragments joined, currency symbol and separators handled), so that the stored number is the price a human sees.
29. As the operator, I want a reading validated before it's stored (product ID matches, Option label matches, price is a finite positive number, stock parses to a known form), so that wrong or empty data is never recorded as a success.
30. As the operator, I want invalid readings treated as failures (and retried), so that a bad reading is never stored as a real one.
31. As the operator, I want the error of every failed try recorded with a short machine-readable reason (e.g. `timeout`, `http_429`, `http_5xx`, `auth_rejected`, `option_mismatch`, `invalid_price`, `structure_changed`), so that failures can be diagnosed from the Scrape Log.
32. As the operator, I want a "structure changed" failure flagged distinctly when the manifest is valid but the expected elements can't be found, so that a genuine page redesign is distinguishable from a flaky response.
33. As the operator, I want the browser launched once per Scrape Run, with images, fonts and media blocked, and closed afterwards, so that the run fits inside the free tier's memory.
34. As the operator, I want Tracked Products scraped one after another rather than in parallel, so that the store isn't hammered and the instance doesn't run out of memory.

### Price history & Scrape Log
35. As a user, I want a chart of price over time per Tracked Product, so that I can see trends at a glance.
36. As a user, I want stock shown alongside price over time, so that I can see when a variant sold out or came back.
37. As a user, I want a table view of the same history with exact timestamps, so that I can read precise values.
38. As a user, I want failed Scrape Attempts shown as gaps rather than drawn as zero or carried-forward prices, so that the chart never implies data we didn't get.
39. As a user, I want a per-product Scrape Log listing every Scrape Attempt with timestamp, Outcome, number of tries, duration and error reason, so that I can see exactly what happened on every run.
40. As a user, I want Outcomes visually distinguished (success / retried / failed), so that reliability problems stand out.
41. As a user, I want timestamps shown in my local time, stored in UTC, so that the display is readable and the data is unambiguous.
42. As a user, I want to see the latest price, stock, and last successful scrape time on each Tracked Product card, so that the dashboard answers "what's it cost now?" instantly.
43. As a user, I want a run-health indicator showing when the last Scrape Run happened and warning when it's overdue (no run for noticeably longer than 2 hours), so that a silently stopped scheduler is visible.
44. As a user, I want a dashboard overview of all Tracked Products together, so that I can scan them in one place.
45. As a user, I want to see each Tracked Product's success rate over its history, so that I can judge how reliable its data is.

### Export
46. As a user, I want an Export button that downloads the full scrape history as a CSV file, so that I can analyse it elsewhere.
47. As a user, I want one CSV row per Scrape Attempt with the store's product ID (as shown in the product page URL), product name, selected Option, ISO 8601 UTC timestamp, price, stock and Outcome, so that the file matches the required format.
48. As a user, I want failed Scrape Attempts included in the CSV with empty price and stock, so that the export is as honest as the dashboard.
49. As a user, I want the CSV properly escaped (commas, quotes in names), so that it opens correctly in spreadsheet tools.

### Headed mode
50. As a reviewer, I want to run the scraper locally in headed mode against the real store, so that I can watch it navigate, pick the Option, hover, click and read the price.
51. As a reviewer, I want headed mode slowed down and logging each step, retry and reason to the console, so that a screen recording clearly shows how slow and failing responses are handled.
52. As a reviewer, I want headed mode to target a single store product ID + Option on demand, so that a recording can focus on one case.
53. As a reviewer, I want headed mode to use exactly the same scraping code path as the scheduled runs, so that what I watch is what runs in production.
54. As a reviewer, I want headed runs to be able to run in a dry-run mode that doesn't write to the production database, so that demo runs don't pollute the real history.

### Operations & deployment
55. As the operator, I want the frontend on Vercel, the backend on Render and data in Supabase, all reachable from one public link, so that the deployment meets the assignment's hosting requirements.
56. As the operator, I want all secrets and endpoints configured through environment variables, documented in the README, so that the app can be set up from scratch.
57. As the operator, I want a health endpoint, so that the cron service (or I) can wake the instance and check it's alive.
58. As the operator, I want the backend to accept requests only from the deployed frontend origin (CORS), so that the API isn't openly usable from other sites.
59. As a reviewer, I want a README with setup steps, the scraping schedule and the required environment variables, so that I can run and evaluate the project.
60. As a reviewer, I want a design note explaining the reliability approach, trade-offs, and what the AI tools got wrong first and how it was corrected, so that I can assess judgment and honesty.

## Implementation Decisions

### Glossary (use these terms everywhere)
- **Store product**: a product in the mock store, identified by its numeric store product ID (e.g. `2692`).
- **Option**: one purchasable variant of a Store product, identified by an Option ID (e.g. `o2`) with a label (e.g. "Neutral white") on a named Option axis (e.g. "Tone").
- **Tracked Product**: a (Store product, Option) pair the user chose to track. It's the unit of scraping, history and logging.
- **Scrape Run**: one scheduled or manual execution over all active Tracked Products.
- **Scrape Attempt**: the single recorded result for one Tracked Product within one Scrape Run. It can contain several internal **tries**.
- **Outcome**: `success` (valid reading on the first try), `retried` (valid reading after ≥1 failed try), `failed` (no valid reading after all tries). Both `success` and `retried` carry a price and stock. `failed` carries none.
- **Price Reading**: the validated result of reading one Tracked Product's page: price, currency, stock, and the product/Option identity observed on the page.

### Store facts (observed while planning)
- `GET /api/v2/listings?page=N&limit=M` → paginated `{page, perPage, totalPages, count, results[]}` with `{id, slug, name, brand, category, sku, description}`. 960 products at time of writing.
- `GET /api/v2/items/{id}` → product detail with `specs`, `reviews`, `optionAxis`, `options[{id,label}]`. **No price or stock.**
- `GET /api/v2/ui/manifest` → `{revision, variant, validUntil, classes{priceWrap, priceValue, mrp, sale, badge, rating, seller, delivery, stock}, order[], priceTag, priceCarrier, …}`; class names rotate.
- The price flow in the page bundle: pointer tracking (minimum moves, minimum dwell), click (trusted event), challenge POST → `pass` token, price fetch authorised by that token, client-side decode. Returns 429 / 401 / 403 on throttling or rejection. Pages include zero-width characters.
- The exact product-page URL pattern (and therefore the "store product ID as shown in the URL") must be confirmed from the live site during the Price Reader work. The assumption is that it's the numeric `id`.

### Modules
- **Catalog client** (plain HTTP, no browser): lists and fetches Store products and their Options from the JSON API with timeouts and retry. Used by search, product detail and tracking.
- **Catalog snapshot**: the full listing is paged into a Supabase table and refreshed when older than 24 hours (or on demand), so search is an indexed case-insensitive substring query that survives cold starts. Detail/Options are fetched live on product open and on track.
- **Price Reader** (port): `read(storeProductId, optionId) → Price Reading`, which throws a typed, classified error on failure. The Playwright implementation owns browser/page lifecycle, the manifest → selectors mapping, Option selection and confirmation, the hover/move/dwell/click interaction, waiting for a real value, text normalisation, and extraction. One browser per Scrape Run; a fresh context per try; heavy resources blocked. Headless by default; headed and slow-motion controlled by configuration.
- **Reading validator**: pure rules applied to every Price Reading before it can count as valid. Identity must match, price must be finite and > 0, and stock must parse. A failed rule becomes a classified error.
- **Scrape-run service** (the core; the main test seam): `runScrape(trackedProducts, { priceReader, attemptStore, clock, retryPolicy }) → run summary`. It owns the retry loop (bounded tries, exponential backoff with jitter, per-try timeout, retryable vs non-retryable classification), isolates failures per Tracked Product, derives the Outcome, and writes exactly one Scrape Attempt per Tracked Product. It never writes price or stock on `failed`.
- **Run coordinator**: acquires the run lock (a `scrape_runs` row in `running` state; a lock older than a stale threshold, e.g. 20 minutes, is marked `abandoned` and ignored), starts the Scrape Run in the background, and closes the run with a summary.
- **Attempt store** (port) with a Supabase implementation: persists Tracked Products, Scrape Runs, Scrape Attempts; serves history, Scrape Log, run health and CSV rows.
- **HTTP API** (Express).
- **Headed runner**: a local command-line entry point that builds the same Playwright Price Reader in headed + slow-motion mode and calls the same scrape-run service for one product/Option. It logs every step and retry to the console, and can run dry (in-memory attempt store) or against the database.
- **Frontend** (React on Vercel): search, product detail with Option picker, dashboard overview, per-product history chart (price line with gaps for failures, stock series) and table, Scrape Log, run-health banner, Export button.

### Schema (Supabase Postgres)
- `catalog_products`: store product ID (PK), slug, name, brand, category, sku, refreshed_at. Index for case-insensitive name search.
- `tracked_products`: id, store product ID, slug, product name, brand, category, Option ID, Option axis, Option label, active flag, created_at. Unique on (store product ID, Option ID).
- `scrape_runs`: id, trigger (`cron` | `manual` | `on_track`), status (`running` | `completed` | `abandoned`), started_at, finished_at, counts per Outcome.
- `scrape_attempts`: id, run id, tracked product id, started_at, finished_at (UTC), Outcome, tries count, price (numeric, null unless success/retried), currency, stock_status (e.g. `in_stock` / `low_stock` / `out_of_stock`, null on failure), stock_qty (nullable int), error_code, error_detail (last try's reason; per-try reasons summarised), duration_ms, manifest revision observed.
- A DB check constraint enforces the honesty rule: `failed` ⇒ price and stock null; `success`/`retried` ⇒ price not null.
- Price history is derived from `scrape_attempts` (no separate table), so the chart, the Scrape Log and the CSV come from one source.

### API contract
- `GET /api/search?q=` → matching Store products (name, brand, category, store product ID).
- `GET /api/store-products/:id` → detail + Options (live from the store).
- `POST /api/tracked` `{storeProductId, optionId}` → creates the Tracked Product (validated against the live Options), 409 on duplicate, then triggers an `on_track` scrape of just that product in the background.
- `DELETE /api/tracked/:id` → deactivates (history kept).
- `GET /api/tracked` → dashboard overview: latest reading, last success, success rate.
- `GET /api/tracked/:id/attempts` → full history/Scrape Log for one Tracked Product.
- `GET /api/runs/health` → last run time, status, overdue flag.
- `GET /api/export.csv` → full history CSV. Columns in order: `store_product_id, product_name, option, timestamp, price, stock, outcome`. Timestamp is ISO 8601 UTC with `Z`. Failed rows have empty price/stock. RFC 4180 quoting.
- `POST /api/cron/scrape` with a secret header → `202 {runId}` when started, `409` when a run is already in progress, `401` on a bad secret.
- `GET /api/health` → liveness (used to wake the instance).

### Scheduling & deployment
- cron-job.org hits `POST /api/cron/scrape` at `0 */2 * * *` (UTC), plus a `/api/health` warm-up ping one minute earlier to absorb Render's cold start.
- Render runs the backend from a Docker image based on the official Playwright image. A single browser and sequential scraping keep memory within the 512 MB free tier.
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend only), `CRON_SECRET`, `STORE_BASE_URL`, `CORS_ORIGIN`, `HEADLESS`, `SLOW_MO_MS`, `SCRAPE_MAX_TRIES`, `SCRAPE_TRY_TIMEOUT_MS`; frontend `VITE_API_BASE_URL`.
- The frontend never talks to Supabase directly; everything goes through the backend API.

### Delivery order (deadline-driven)
1. Schema → Playwright Price Reader working headed against one product → scrape-run service → cron endpoint → deploy to Render → cron-job.org → track 3 products. Real unattended runs start accumulating from here.
2. Catalog snapshot + search + detail + track/untrack.
3. Frontend dashboard, history, Scrape Log, run health, CSV export; deploy to Vercel.
4. Hardening, headed recording, README, design note.

## Testing Decisions

- **Good tests assert externally observable behaviour at a seam**: what gets recorded and returned, not how. No asserting on internal calls, private helpers, selector strings or log wording. Tests must be deterministic: fake clock/backoff, no network, no real browser.
- **Seam 1: the scrape-run service** (automated, primary). It's driven with a scripted fake Price Reader and an in-memory attempt store. Behaviours to cover:
  - first-try valid reading → one `success` Scrape Attempt with price/stock, tries = 1;
  - transient failures then a valid reading → `retried` with the correct tries count and the reading stored;
  - all tries fail → `failed`, price/stock null, error code of the last try recorded;
  - non-retryable error (e.g. `structure_changed`, `option_mismatch` after confirmation) → handled per the retry policy, never stored as a success;
  - an invalid reading (non-positive price, NaN, wrong Option, wrong product) → rejected by validation, treated as a failed try, never stored as a success;
  - one Tracked Product throwing an unexpected exception → the others still get their Scrape Attempts;
  - exactly one Scrape Attempt per active Tracked Product per Scrape Run; inactive Tracked Products are skipped;
  - retries respect the maximum tries and the per-try timeout (a hanging reader becomes a timeout failure, not a hung run).
- **Seam 2: manual headed runs** against the live store via the headed runner. This is the verification for the Playwright Price Reader (interaction gate, manifest-driven selectors, Option confirmation, late content, text normalisation). It's recorded for the deliverable video. It's deliberately not automated: the live store is non-deterministic and reproducing its challenge flow in a fake would cost more than the deadline allows.
- The run lock, CSV formatting and API routes are thin and verified by smoke runs against the deployed stack (trigger the cron endpoint twice in a row, download the CSV and open it) rather than by permanent tests.
- Test runner: Vitest (or Jest) in the backend package. **Prior art:** none; this is a greenfield repo, and these tests establish the convention.

## Out of Scope

- Price-drop / back-in-stock alerts (in-app or SendGrid email).
- Configurable scrape frequency per Tracked Product (the schedule is a fixed 2 hours for all).
- Scraping multiple Options of one product in a single page visit (each Tracked Product is read independently, even when two share a Store product).
- CI/CD with GitHub Actions.
- Reverse-engineering the store's challenge/token/decode protocol to fetch prices without a browser.
- User accounts, authentication, multi-tenant data (single shared dashboard).
- Scraping anything other than INE's mock store.
- An automated fake store or automated tests of the Playwright Price Reader.

## Further Notes

- **Main risk:** the Price Reader is covered only by manual headed runs. Normalisation bugs (zero-width characters, split price carrier, decoy elements) will only surface against the live store. Mitigations: strict validation so bad readings become `failed` instead of wrong data, error codes and the observed manifest revision stored on each Scrape Attempt, and early deployment so unattended runs reveal problems before the deadline.
- **Interpretation recorded for the design note:** a "scrape attempt" in the CSV and Scrape Log is one Scrape Attempt per Tracked Product per Scrape Run. Internal tries are summarised in it (tries count, last error). `retried` means "succeeded after retrying", not "an individual failed try".
- Free-tier constraints: Render sleeps after inactivity and cold-starts slowly; cron-job.org has a short request timeout. Hence the warm-up ping, immediate `202`, background execution and stale-lock recovery.
- AI-usage disclosure is a required deliverable. Keep a running log during implementation of what AI tools got wrong first (e.g. proposing HTML parsing of the empty SPA shell, hard-coding rotating class names, fixed sleeps instead of value waits, reading before the Option switch settled, storing 0/null as success) and how each was corrected.
- Bonus features may be picked up only after every base feature and deliverable is done and submitted-ready.
