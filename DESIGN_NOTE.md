# Design Note: Reliability, Architecture & AI Corrections

## 1. Problem Context & Core Architectural Principles

The INE mock store (`https://demo.inelabteamdev.com`) is deliberately constructed to simulate a real-world, hostile web scraping target:
1. **Empty SPA Shell:** Raw HTML fetching returns an empty `<div id="root"></div>`.
2. **Interactive Gating Mechanism:** Catalogue metadata (names, brands, categories, reviews, specs) is accessible via JSON APIs, but **price and stock are not**. Price is unlocked only when a user performs continuous pointer movements over the price area, dwells for $\ge 600\text{ms}$, and executes a trusted click event. This triggers a challenge token exchange that unlocks an obfuscated payload decoded client-side.
3. **Rotating CSS Manifest:** The storefront updates class names periodically (`/api/v2/ui/manifest`), rotating elements (`priceWrap`, `priceValue`, `stock`, etc.) and alternating between split character spans, non-breaking spaces, and zero-width characters.
4. **Hostile Network Responses:** The store intentionally injects rate-limiting (`429`), server errors (`5xx`), and auth rejections (`401`/`403`).
5. **Free-Tier Operational Constraints:** The backend runs in a memory-constrained container (512MB on Render Free Tier), where unconstrained parallel browser instances would trigger Out-Of-Memory (`OOMKilled`) termination. Furthermore, cron services enforce strict HTTP response timeouts.

---

## 2. Reliability Strategy

### A. Architectural Split: Lightweight HTTP vs. Browser Automation
- **Search & Catalogue (HTTP + JSON):** `/api/v2/listings` and `/api/v2/items/:id` via plain `fetch` with exponential backoff. No browser instances are spawned for search, product inspection, or snapshot sync. The listings API returns a **fresh random sample on every page request** (pages overlap, `limit` capped at 60), so walking pages 1–16 once collected only ~630 of 960 products, and the first snapshot held just 257. The sync now keeps sampling until the unique set reaches the advertised `count` (about 125 requests for 960) or pages stop adding new products, and logs how many it got.
- **Price & Stock Extraction (Playwright):** A real Chromium browser is used exclusively for the gated price interaction where client-side challenge execution and DOM rendering are strictly mandatory.

### B. Dynamic Selector Resolution
- Before page navigation, the scraper retrieves the latest UI manifest from `/api/v2/ui/manifest`.
- CSS selectors are constructed dynamically from `manifest.classes.priceWrap`, `manifest.classes.priceValue`, and `manifest.classes.stock`.
- Zero hardcoded class names exist in the extraction engine.

### C. Variant Confirmation & State Settlement
- When navigating to a product page, the target variant option button is identified and clicked.
- The scraper explicitly waits for `aria-pressed="true"` / `.opt-chip-on` state confirmation before initiating the hover interaction. This prevents stale prices from previously active variants from leaking into the reading.

### D. Human-Like Pointer Trajectory & Dwell
- The scraper computes the bounding box of the price panel, moves the cursor inside, and emits 12 continuous mouse steps with small delays (the store samples moves $\ge 40\text{ms}$ apart and requires $\ge 8$).
- A deliberate dwell of $750\text{ms}$ is applied (surpassing the store's $600\text{ms}$ threshold). If the button is still disabled afterwards, the gesture is repeated once.
- The action button is located **inside the price panel** (`Check today’s price`); the consent banner's "Allow" button shares the `.ctl-main` class, so a page-wide selector can hit the wrong button.
- The store's click handler silently **drops ~17.5% of trusted clicks** and delays another ~17.5% by 900 ms. The scraper clicks, waits up to 3 s for the panel to leave its idle state, and re-clicks (max 4) rather than waiting out a price that will never load. There is no untrusted `element.click()` fallback: the gate records `isTrusted` and rejects it.

### E. Value-Based Waiting vs. Fixed Sleep
- Rather than using arbitrary `sleep()` calls, the reader waits for the price panel to settle into the store's `offer-ready` or `offer-failed` state (`page.waitForSelector`), so full-width digits or other price encodings cannot make it wait forever.

### E2. Stale-Quote Rejection & In-Page Re-Quotes
- The store answers roughly one quote in four with a **stale** price: rendered at reduced opacity next to "Refreshing prices", and never refreshed by the page itself. It looks like a normal price in the DOM. The reader treats a price drawn with opacity below 1, or a panel containing "Refreshing prices", as stale and presses **Check again**.
- An error panel ("Couldn’t load the price… `challenge_failed`") is handled the same way with **Retry**, instead of waiting out the full timeout.
- Up to 4 quotes are requested per try. If every one is stale, the try fails with `stale_price` and the normal retry policy takes over, so a stale price is never stored.

### F. Text Normalisation & Anti-Obfuscation
- `PriceNormalizer` systematically strips zero-width spaces (`\u200B-\u200D`), byte order marks (`\uFEFF`), directional markers (`\u202A-\u202E`), non-breaking spaces (`\u00A0`), and converts full-width numerals (`\uFF10-\uFF19`) to ASCII digits.
- Handles currency formats (INR `₹`/`Rs.`, EUR `€`, USD `$`) and normalizes decimal/comma separators.
- Parses stock quantities and states (`in_stock`, `low_stock`, `out_of_stock`).

### G. Strict Validation & Honesty Constraint
- Every reading is passed through `ReadingValidator`:
  - Product ID & Option ID must match target
  - Price must be finite and $> 0$
  - Stock status must be valid
- **Database Honesty Constraint (`honesty_check`):**
  ```sql
  CONSTRAINT honesty_check CHECK (
    (outcome = 'failed' AND price IS NULL AND stock_status IS NULL) OR
    (outcome IN ('success', 'retried') AND price IS NOT NULL)
  )
  ```
- A failed scrape attempt **never** stores a synthetic `0` or carries forward a prior price. On charts, failed attempts appear as honest **gaps** in the time series.

### H. Retry Policy & Isolation
- Each tracked product is isolated. If product $A$ encounters a fatal error, product $B$ is still scraped.
- Transient errors (`timeout`, `http_429`, `http_5xx`, `auth_rejected`, `navigation_failed`) trigger retries with exponential backoff and randomized jitter:
  $$\text{Backoff} = \min(\text{MaxBackoff}, \text{InitialBackoff} \times 2^{\text{try}-1}) \times (1 + \text{jitter})$$
- Non-retryable structural errors (`structure_changed`, `option_mismatch`) fail fast without wasting time budgets.

---

## 3. Operational Decisions & Trade-Offs

| Decision | Trade-Off Chosen | Rationale |
|---|---|---|
| **Playwright vs. Token Reverse Engineering** | Playwright Chromium automation | Reverse-engineering client-side WebCrypto challenge keys is fragile across store bundle updates; Playwright provides authentic human execution. |
| **Sequential vs. Parallel Scraping** | Sequential (one product after another) | Render Free Tier limits RAM to 512MB. Parallel tabs risk memory pressure and store rate-limits (`429`). |
| **Asset Blocking** | Aborting images, fonts, media, stylesheets | Cuts network payload by >80% and reduces browser RAM footprint to ~90MB. |
| **Cron Acknowledgment** | Immediate `202 Accepted` + background execution | cron-job.org drops connections after 10–30s. Immediate acknowledgment prevents false timeouts while the scrape run completes in the background. |
| **Run Locking & Stale Recovery** | Mutex in `scrape_runs` table; runs left `running` by a dead process are abandoned at boot, and any run older than 20 min when a new one starts | Prevents overlapping cron triggers. A crash, out-of-memory kill or redeploy mid-run no longer leaves the dashboard showing "running" and blocking manual runs. |

---

## 4. Glossary & Outcome Interpretation

- **Scrape Run:** One batch cycle execution (triggered via cron, manual trigger, or `on_track`).
- **Scrape Attempt:** The single official record for one Tracked Product within a Scrape Run. An attempt may execute up to `SCRAPE_MAX_TRIES` internal tries.
- **Outcomes:**
  - `success`: Valid reading attained on the very first try (`tries_count = 1`).
  - `retried`: Valid reading attained after $\ge 1$ failed tries (`tries_count > 1`).
  - `failed`: No valid reading after exhausting all tries or encountering a fatal non-retryable error (`price = null`, `stock = null`, `error_code` recorded).

---

## 5. AI Usage & Corrections Log

During implementation, LLM assistance was utilized for boilerplate generation and initial drafting. The following critical errors were identified, diagnosed, and corrected:

1. **SPA HTML Scraping Hallucination:**
   - *Initial AI suggestion:* Fetching product HTML via `axios`/`cheerio` and querying CSS selectors.
   - *Correction:* The store is an empty React SPA shell (`#root`). Price is gated by pointer movement and client challenge tokens. Switched to Playwright for the price extraction seam and HTTP JSON APIs for catalog metadata.
2. **Hardcoded Class Names:**
   - *Initial AI suggestion:* Querying `.price`, `.amount`, `.in-stock`.
   - *Correction:* Class names rotate dynamically via `/api/v2/ui/manifest` (e.g. `ofw-h8`, `amt-h8`, `inv-h8`). Built dynamic manifest selector derivation.
3. **Fixed Sleep Timing Regressions:**
   - *Initial AI suggestion:* Inserting `await sleep(3000)` after hover and click.
   - *Correction:* Fixed sleeps cause flakiness under varying network loads. Replaced with `page.waitForFunction()` observing real DOM numeric settlement.
4. **Cookie Consent Scrim Pointer Interception:**
   - *Initial AI suggestion:* Check for `.consent-scrim` once right after navigation and dismiss it.
   - *Observed Issue:* On Render, 2 of 3 products failed with price timeouts that never happened locally. Reading the store bundle showed the banner mounts 1.5–5 s *after* app start (75% of loads) and needs 1–3 dismissals, so the one-shot check never saw it; on a slow CPU it landed mid-gesture and swallowed the click. Reproduced locally with Chrome CPU throttling (8×): 1/6 reads succeeded.
   - *Correction:* A Playwright `addLocatorHandler` dismisses the banner (repeatedly) before any locator action, and the reader waits out the banner's arrival window before the raw-mouse gesture, since raw mouse moves bypass locator handlers. Combined with click re-tries and a 20 s price-resolution window, the throttled harness went to 8/9 on the first rework.
5. **Chart Distortion on Failed Scrapes:**
   - *Initial AI suggestion:* Rendering `0` or interpolated values for failed attempts.
   - *Correction:* Graphing `0` creates false price collapse charts. Configured Recharts `connectNulls={false}` and set failed prices to `null` to render truthful gaps.
6. **Accepting Stale Quotes as Today's Price:**
   - *Initial AI suggestion:* Treat the first price text containing a digit as the reading.
   - *Observed Issue:* Dashboard prices disagreed with the store. Watching the store's own React state during repeated reads showed about a quarter of quotes arrive with `pending` set; the page shows the old price dimmed with "Refreshing prices" (e.g. ₹11,727 while the real price was ₹12,261). Those were being stored as `success`.
   - *Correction:* Detect the stale rendering, re-quote in-page with "Check again", and fail the try with `stale_price` if only stale quotes arrive. In 20 verification reads after the fix, every reading was the fresh price and every stale quote was rejected.
