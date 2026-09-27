# Technical and UX Design

How the scraper reads a price, how readings are cleaned and classified, and how the dashboard presents them. The visual design system (tokens, components, rules) lives in [`DESIGN.md`](../DESIGN.md); product intent in [`PRODUCT.md`](../PRODUCT.md).

## 1. The target store

The INE mock store at `https://demo.inelabteamdev.com` defends itself in several ways:

1. **Empty HTML shell:** `GET /item/:id` returns only `<div id="root"></div>`; the page is rendered by client JavaScript.
2. **Interaction gate:** price and stock stay hidden in an offer panel until:
   - at least 8 pointer moves over the panel, sampled at least 40 ms apart,
   - at least 600 ms of dwell,
   - a trusted click on the panel's "Check today’s price" button (`.ctl-main`). Untrusted (`element.click()`) clicks are rejected.
3. **Unreliable click handling:** the store silently drops about 17.5% of trusted clicks and delays another 17.5% by 900 ms.
4. **Stale and failed quotes:** roughly one quote in four comes back stale (old price, dimmed, next to "Refreshing prices", never refreshed by the page); others come back as an error panel (`challenge_failed`) with a **Retry** button.
5. **Cookie consent scrim:** on about 75% of loads a consent banner mounts 1.5–5 s after app start, swallows pointer events, and needs 1–3 dismissals.
6. **Rotating class names and price encodings:** `/api/v2/ui/manifest` publishes the current class names; for example:
   ```json
   {
     "revision": 633004,
     "classes": {
       "priceWrap": "ofw-h8",
       "priceValue": "amt-h8",
       "mrp": "lst-h8",
       "stock": "inv-h8"
     },
     "priceCarrier": "split"
   }
   ```
   With `priceCarrier: "split"`, the price is spread over nested `<span>`s separated by zero-width spaces (`\u200B`) or non-breaking spaces (`\u00A0`), and may use full-width digits (`\uFF10`–`\uFF19`).
7. **Hostile responses:** injected `429`, `5xx`, `401`/`403`.

---

## 2. Extraction flow (`PlaywrightPriceReader.read`)

```
1. Fetch manifest
   └─► GET /api/v2/ui/manifest over HTTP (CatalogClient); derive priceWrap / priceValue / stock selectors
2. Block heavy assets
   └─► page.route() aborts images, media and fonts
3. Navigate
   └─► page.goto("/item/:id", { waitUntil: "domcontentloaded" }); map 429 / 401 / 403 / 5xx to error codes
4. Register consent handler
   └─► page.addLocatorHandler(".consent-scrim") clicks "Reject cookies" (up to 5 times) before any locator action
5. Select and confirm the option
   └─► Look up the option label via /api/v2/items/:id; click the matching ".opt-picker" button
   └─► Wait for aria-pressed="true" or .opt-chip-on on that button
6. Pass the interaction gate
   └─► Wait out the consent banner's arrival window (5.5 s from first render); raw mouse moves bypass locator handlers
   └─► 12 pointer moves across the price panel, 60 ms apart, then a 750 ms dwell
   └─► If the button is still disabled, repeat the gesture once
7. Request a quote (up to 4 per try)
   └─► Trusted click on the button inside the price panel (the consent "Allow" button also uses .ctl-main)
   └─► If the panel does not change within 3 s, click again (up to 4 clicks)
   └─► Wait up to 20 s for ".offer-panel.offer-ready" or ".offer-panel.offer-failed"
   └─► Failed panel → press "Retry"; stale quote (opacity < 1 or "Refreshing prices") → press "Check again"
8. Extract
   └─► Price text from the manifest's priceValue class; stock text from the stock class or ".avail-pill"
9. Normalise and validate
   └─► PriceNormalizer → ReadingValidator (identity, price > 0, stock present)
```

If all 4 quotes are stale the try fails with `stale_price`; if the last problem was an error panel it fails with `timeout`. A stale price is never returned.

---

## 3. Normalisation (`PriceNormalizer`)

### Invisible and full-width characters
```typescript
cleanInvisibleChars(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim();
}
```

### Price
- Currency: `€`/`EUR` → `EUR`, `$`/`USD` → `USD`, `£`/`GBP` → `GBP`, otherwise `INR` (`₹`, `Rs.`, `INR`).
- `1.234,56` style (comma decimal) is converted; otherwise commas are thousands separators.
- The first number found is the price; none → `NaN`, which the validator rejects as `invalid_price`.

### Stock
- `"Sold out"`, `"Out of stock"`, `"Unavailable"` → `out_of_stock`, qty `0`
- A number ≤ 5 (e.g. `"Last few: 3"`) → `low_stock`, qty `3`
- A number > 5 (e.g. `"34 units available"`) → `in_stock`, qty `34`
- No number → `in_stock`, qty `null` (also used when the page shows no stock element)

---

## 4. Retry policy

### Error codes

| Error code | Retried? | Raised when |
|---|:---:|---|
| `timeout` | Yes | Navigation, a click, or price resolution exceeded its budget; the try exceeded `SCRAPE_TRY_TIMEOUT_MS`; or every quote came back as an error panel. |
| `http_429` | Yes | The product page returned HTTP 429. |
| `http_5xx` | Yes | The product page returned 5xx, or the manifest could not be fetched. |
| `auth_rejected` | Yes | The product page returned 401 or 403. |
| `navigation_failed` | Yes | The page failed to load for a non-timeout reason. |
| `invalid_price` | Yes | Parsed price was `NaN`, non-finite, or ≤ 0. |
| `invalid_stock` | Yes | Stock status was empty. |
| `stale_price` | Yes | Every quote in the try was stale; the stale price is never stored. |
| `unknown` | Yes | Any other exception. |
| `structure_changed` | **No** | Option picker or price panel missing, or the reading's product ID did not match. |
| `option_mismatch` | **No** | The option does not exist for the product, or its button is not on the page. |

A non-retryable error ends the Scrape Attempt immediately as `failed`.

### Backoff with jitter
Between tries (defaults: 3 tries, 1 s initial, 8 s cap, ±20% jitter):

$$\text{Delay} = \max\left(100\text{ms},\ \text{base} \times \left(1 + (2r - 1) \times 0.2\right)\right),\quad \text{base} = \min(8000\text{ms},\ 1000\text{ms} \times 2^{\text{try}-1})$$

where $r \in [0, 1)$. With 3 tries the waits are about 1 s and 2 s.

---

## 5. Dashboard

Monochrome: full-bleed white page, black sidebar and primary buttons, light gray tiles; colour appears only for scrape outcomes. Urbanist Variable type. Tokens live in `frontend/tailwind.config.js`; the full system is in [`DESIGN.md`](../DESIGN.md).

```
┌──────┬──────────────────────────────────────────────────┬──────────────────┐
│ [≡]  │ Dashboard                     [Search… | + Track] │ Latest readings  │
│ [+]  │ [Tracked 5] [Success 86%] [Attempts 102] [Run 4/5]│ [All|Retried&f.] │
│ [↻]  │ ┌ Success rate by variant ─┐ ┌ Scrape schedule ─┐ │ Saffrix  ₹16,044 │
│ [↓]  │ │ ████████░░ bars           │ │ Next run in 1h22m│ │ Pinecrest timeout│
│      │ └───────────────────────────┘ └ ●───|──|~ · Run ─┘ │ …                │
│      │ Tracked variants  [card] [card] [card]    [+Track] │                  │
│      │ └ Store catalogue (table) ─────────── Show more ──┘ │                  │
└──────┴──────────────────────────────────────────────────┴──────────────────┘
```

1. **KPI strip (`KpiStrip`):** tracked variants, average success rate, total Scrape Attempts, and the last run's read count with failures.
2. **Success rate by variant (`SuccessChart`):** horizontal bars, lowest first; black ≥ 90%, amber 60–89%, red < 60%.
3. **Scrape schedule (`ScheduleCard`):**
   - Cadence track from 0 to 3 h with ticks at due (2 h) and overdue (2.5 h, the backend's 150-minute rule); a marker sits at the time since the last cron run.
   - Headline: "Next run in …", "Next run due now", "Overdue by …", "No scheduled run yet", or "Run in progress"; overdue turns red.
   - "Waking the backend" state while Render's free tier cold-starts.
   - Last-run outcome bar (first try / after retry / failed) and a **Run scrape now** button.
4. **Tracked variants (`TrackedGrid`) and Latest readings rail (`ActivityRail`):** price, stock, last outcome, success rate, last read; the rail can filter to retried and failed readings.
5. **Store catalogue (`CatalogSection`):** paged table of the catalogue snapshot.
6. **Variant detail (`ProductDetailModal`):**
   - Price history chart (Recharts, `connectNulls={false}`): failed attempts are gaps, each marked with a red dashed line.
   - Stock history chart, with the same gaps.
   - Scrape Log: finish time (local), outcome, tries, duration, price, stock, manifest revision, and detail (error code for failures).
7. **Search and track (`SearchTrackModal`):** debounced search of the catalogue snapshot, live option picker, and duplicate detection so the same variant cannot be tracked twice.
