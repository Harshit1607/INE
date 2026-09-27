Status: ready-for-agent

# 01 — Headed scrape of one Tracked Product records a Scrape Attempt

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

The narrowest end-to-end scraping path: given one Tracked Product (a Store product ID + Option ID that exists in Supabase), a local command runs the real Playwright Price Reader against the live mock store (https://demo.inelabteamdev.com), in headed + slow-motion mode or headless. It performs the interaction the store requires and validates the Price Reading. It records exactly one Scrape Attempt in Supabase: `success` with price, currency and stock, or `failed` with price/stock empty and an error code. This slice uses one try only; retries come in 02.

Includes:
- The Supabase schema from the PRD: `tracked_products`, `scrape_runs`, `scrape_attempts`, with the honesty check constraint (`failed` ⇒ price and stock null; `success`/`retried` ⇒ price not null) and the unique (Store product ID, Option ID) constraint. `catalog_products` can wait for 05.
- **Price Reader** port and its Playwright implementation. It fetches the UI manifest and derives selectors from its `classes` (no hard-coded class names). It opens the product page, selects the Option and confirms it's the active one. It performs the hover / pointer-movement / dwell / click gate (the page shows "Hover over the price area to load the current price." and "Hold on — checking availability…" until satisfied), then waits for a real value (not a loader or placeholder) instead of sleeping a fixed time. It normalises price text: strip zero-width characters, join split fragments, handle currency symbol and separators. It extracts stock into `stock_status` (+ `stock_qty` when shown). It launches one browser per Scrape Run, blocks images/fonts/media, and cleans up.
- **Reading validator**: product identity matches, Option label matches, price finite and > 0, stock parses. On failure it raises a classified error.
- **Scrape-run service** (minimal form): `runScrape(trackedProducts, { priceReader, attemptStore, clock })`. It opens a Scrape Run, writes exactly one Scrape Attempt per active Tracked Product, and closes the run with Outcome counts.
- **Headed runner** CLI: targets one Store product ID + Option ID. Supports headed/slow-mo via configuration (`HEADLESS`, `SLOW_MO_MS`), logs each step to the console, and has a dry-run mode using an in-memory attempt store. It uses the same service and reader code path production will use.
- Confirm the product-page URL pattern on the live store, and record which ID appears in it. The PRD assumes it's the numeric `id`; the CSV in 04 depends on this.

## Acceptance criteria

- [ ] Schema applied to Supabase. Inserting a `failed` attempt with a price, or a `success` attempt without one, is rejected by the database.
- [ ] Running the headed runner for a real product (e.g. Store product 2692, Option `o2`) opens a visible browser, visibly hovers/clicks, and prints the price, stock, Option label and Outcome.
- [ ] The same run without dry-run writes one `scrape_runs` row and one `scrape_attempts` row with UTC timestamps, duration, observed manifest revision, and price/stock matching what the page shows for that Option.
- [ ] Running for two different Options of the same product records different prices, each matching its Option on the page (proves no stale previous-Option reading).
- [ ] A forced failure (unreachable store URL, or a non-existent Option) records a `failed` attempt with null price/stock and a classified `error_code`. Nothing crashes.
- [ ] Stored price contains no zero-width or formatting characters: it's a plain number.
- [ ] No hard-coded store class names anywhere; selectors come from the manifest.
- [ ] Running headless (default) produces the same result as headed.

## Blocked by

None - can start immediately
