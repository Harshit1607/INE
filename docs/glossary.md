# Glossary & Domain Vocabulary

This glossary establishes the ubiquitous domain terminology across the codebase, database schema, API contracts, and user interface.

---

## 1. Domain Entities & Core Concepts

### Store Product
A product listed in INE's mock store, identified by its numeric Store Product ID (e.g. `2692`). Catalogue information (name, brand, category, sku, description, specs, reviews, options) is retrieved via HTTP JSON APIs.

### Option (Variant)
One specific purchasable variant of a Store Product, identified by an Option ID (e.g. `o2`) and an Option Label (e.g. `"Neutral white"`).

### Option Axis
The dimension along which product options vary (e.g. `"Tone"`, `"Edition"`, `"Finish"`, `"Storage"`, `"Pack Size"`).

### Tracked Product
A unique `(Store Product ID, Option ID)` pair chosen by the user for automated monitoring. It is the primary unit of scraping, logging, price history, and alerting.

### Price Reading
The validated result of extracting data from a single product page visit:
- Numeric price (finite and $> 0$)
- ISO currency code (`INR`, `EUR`, `USD`, `GBP`)
- Stock status (`in_stock`, `low_stock`, `out_of_stock`)
- Stock quantity (integer or `null`)
- Observed UI manifest revision number
- UTC ISO timestamp

---

## 2. Scraping & Orchestration Concepts

### Scrape Run
A single scheduled or triggered batch execution that iterates over all active Tracked Products. Tracked in the `scrape_runs` database table.

### Scrape Attempt
The single official recorded result for one Tracked Product within one Scrape Run. Exactly **one** Scrape Attempt is recorded per active Tracked Product per Scrape Run.

### Try (Internal Try)
A single execution attempt within a Scrape Attempt. An attempt may execute up to `SCRAPE_MAX_TRIES` (default: 3) internal tries if transient errors occur.

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

### Run Lock / Mutex
A lock mechanism in `scrape_runs` that rejects concurrent scrape triggers (`409 Conflict`) if an existing run has `status = 'running'`.

### Stale Run
A scrape run marked as `running` that has exceeded the maximum time threshold ($20\text{ minutes}$), indicating an ungraceful container restart or worker crash. Automatically marked as `abandoned`.

### Overdue Schedule
A health state indicating that the latest scrape run started more than $150\text{ minutes}$ ($2.5\text{ hours}$) ago, signaling a paused or failing external cron service.

---

## 4. Machine Error Codes

| Error Code | Meaning |
|---|---|
| `timeout` | Browser navigation, DOM settlement, or price resolution exceeded timeout budget. |
| `http_429` | Mock store rate-limiting responded with HTTP 429. |
| `http_5xx` | Store backend returned an HTTP 500, 502, 503, or 504 server error. |
| `auth_rejected` | Challenge token exchange was rejected with HTTP 401 or 403. |
| `navigation_failed` | Playwright failed to establish connection or load the product page URL. |
| `invalid_price` | Extracted price failed validation (NaN, $\le 0$, or non-numeric). |
| `invalid_stock` | Extracted stock string was empty or unparseable. |
| `structure_changed` | UI manifest was fetched, but expected DOM selectors could not be located on the page. |
| `option_mismatch` | Target Option ID was not found among the product's options on the live page. |
| `unknown` | Unhandled runtime exception occurred during execution. |
