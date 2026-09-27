# Glossary & Domain Vocabulary

Terms used consistently across the code, database schema, API and user interface.

---

## 1. Domain Entities & Core Concepts

### Store Product
A product listed in INE's mock store, identified by its numeric Store Product ID (e.g. `2692`). Catalogue information (name, brand, category, sku, description, specs, reviews, options) is retrieved via HTTP JSON APIs.

### Option (Variant)
One specific purchasable variant of a Store Product, identified by an Option ID (e.g. `o2`) and an Option Label (e.g. `"Neutral white"`).

### Option Axis
The dimension along which product options vary (e.g. `"Tone"`, `"Edition"`, `"Finish"`, `"Storage"`, `"Pack Size"`).

### Tracked Product
A unique `(Store Product ID, Option ID)` pair chosen by the user for automated monitoring. It is the unit of scraping, logging and price history. Untracking sets `active = false`; the history is kept.

### Price Reading
The validated result of extracting data from a single product page visit:
- Numeric price (finite and $> 0$)
- ISO currency code (`INR`, `EUR`, `USD`, `GBP`)
- Stock status (`in_stock`, `low_stock`, `out_of_stock`)
- Stock quantity (integer or `null`)
- Observed UI manifest revision number
- UTC ISO timestamp

A reading is only produced from a fresh quote; stale quotes are rejected (see `stale_price`).

---

## 2. Scraping & Orchestration Concepts

### Scrape Run
One execution of the scraper, recorded in `scrape_runs` with a Trigger and a status (`running`, `completed`, `abandoned`). `cron` and `manual` runs scrape every active Tracked Product; an `on_track` run scrapes only the variant that was just tracked.

### Trigger
What started a Scrape Run:
- **`cron`:** the 2-hourly cron-job.org call to `POST /api/cron/scrape`.
- **`manual`:** the dashboard's **Run scrape now** button (`POST /api/runs/manual`).
- **`on_track`:** the immediate first read after a variant is tracked.

### Scrape Attempt
The single official recorded result for one Tracked Product within one Scrape Run. Exactly **one** Scrape Attempt is recorded per Tracked Product scraped in a Scrape Run, whatever happens.

### Try
One read of the product page within a Scrape Attempt. A Scrape Attempt makes up to `SCRAPE_MAX_TRIES` (default 3) tries while errors are retryable.

### Outcome
The final recorded status of a Scrape Attempt:
- **`success`:** A valid Price Reading was achieved on the very first try (`tries_count = 1`).
- **`retried`:** A valid Price Reading was achieved after at least one transient failure (`tries_count > 1`).
- **`failed`:** No valid Price Reading was achieved after exhausting all tries or encountering a non-retryable error (`price = null`, `stock = null`, `error_code` recorded).

### Honesty Constraint
The inviolable invariant enforced both in code and by PostgreSQL check constraint:
- If `outcome = 'failed'` $\implies$ `price` and `stock_status` **MUST** be `NULL`.
- If `outcome IN ('success', 'retried')` $\implies$ `price` **MUST NOT** be `NULL`.

---

## 3. Store Defense & Anti-Bot Terminology

### UI Manifest
The JSON payload retrieved from `/api/v2/ui/manifest` publishing the current rotating CSS class names, manifest revision number, validity expiration, field display order, and price carrier strategy.

### Price Carrier
The encoding scheme used to render the price string in the DOM:
- **`standard`:** A contiguous text node.
- **`split`:** Price digits split across multiple `<span>` elements separated by zero-width spaces (`\u200B`) or non-breaking spaces (`\u00A0`).

### Interactive Gating
The mock store's requirement that pointer coordinates move across the price container bounding box with $\ge 8$ move events and dwell for $\ge 600\text{ms}$ before enabling the price request action.

### Quote
One price answer from the store after pressing "Check today’s price", "Check again" or "Retry". A try requests up to 4 quotes.

### Stale Quote
A quote the store renders dimmed next to "Refreshing prices": an old price the page never refreshes. Rejected and re-requested; never stored.

### Run Lock
The rule that only one Scrape Run may be `running` at a time, enforced through `scrape_runs`. A cron or manual trigger during a run gets `409 Conflict`.

### Stale Run
A Scrape Run left `running` by a process that died (crash, out-of-memory kill, redeploy). Marked `abandoned` when the server boots, or when a new run starts and the stale run is older than 20 minutes.

### Overdue Schedule
The latest `cron` run started more than 150 minutes (2.5 hours) ago, or no `cron` run exists: the external cron service is paused or failing. Manual and `on_track` runs do not count.

---

## 4. Machine Error Codes

| Error Code | Meaning |
|---|---|
| `timeout` | Navigation, a click, or price resolution exceeded its budget; the try exceeded `SCRAPE_TRY_TIMEOUT_MS`; or every quote came back as an error panel. |
| `http_429` | The product page returned HTTP 429. |
| `http_5xx` | The product page returned HTTP 5xx, or the UI manifest could not be fetched. |
| `auth_rejected` | The product page returned HTTP 401 or 403. |
| `navigation_failed` | Playwright failed to establish connection or load the product page URL. |
| `invalid_price` | Extracted price failed validation (NaN, $\le 0$, or non-numeric). |
| `invalid_stock` | Extracted stock string was empty or unparseable. |
| `stale_price` | The store kept answering with a stale, dimmed quote ("Refreshing prices") after every in-page re-request. |
| `structure_changed` | The option picker or price panel was not found, or the reading's product ID did not match. Not retried. |
| `option_mismatch` | The Option ID does not exist for the product, or its button is not on the page. Not retried. |
| `unknown` | Unhandled runtime exception occurred during execution. |
