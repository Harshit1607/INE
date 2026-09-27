# Technical & UX Design Document

## 1. Scraping Engine Technical Design

### A. Hostile Store Analysis
The INE Mock Store at `https://demo.inelabteamdev.com` implements several client-side defenses:
1. **Empty DOM Shell:** The initial HTML response from `GET /item/:id` contains only `<div id="root"></div>`. Product information is loaded asynchronously via client JavaScript.
2. **Interactive Gating Mechanism:** The price and stock elements are masked by an offer panel until a human-like mouse interaction satisfies client-side thresholds:
   - Pointer movement tracking: $\ge 8$ move events across the bounding box.
   - Dwell duration: $\ge 600\text{ms}$ continuous hover.
   - Action trigger: trusted click event on `.ctl-main` (`Check today’s price`).
3. **Rotating Class Names & Structural Encodings:**
   - The store rotates class names periodically via `/api/v2/ui/manifest`.
   - Examples of dynamic class maps:
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
   - When `priceCarrier` is `"split"`, the rendered price contains nested `<span>` elements separated by zero-width spaces (`\u200B`), non-breaking spaces (`\u00A0`), or full-width Unicode numerals (`\uFF10-\uFF19`).

---

### B. Extraction Flow

```
1. Fetch Manifest
   └─► GET /api/v2/ui/manifest (Obtain dynamic classes & revision)
2. Block Heavy Media Assets
   └─► page.route() aborts images, fonts, audio, video
3. Navigate to Product Page
   └─► page.goto("/item/:id", { waitUntil: "domcontentloaded" })
4. Dismiss Cookie Consent Scrim
   └─► Proactively detects and clicks ".consent-scrim button"
5. Select & Confirm Variant
   └─► Clicks option chip matching target optionId
   └─► Waits for aria-pressed="true" / .opt-chip-on confirmation
6. Perform Human-Like Pointer Movement
   └─► Obtains bounding box of .priceWrap
   └─► Moves pointer across 12 coordinate steps with micro-delays
   └─► Dwells inside element for 750ms
7. Click Price Request Action
   └─► Waits for button to become enabled, then clicks .ctl-main
8. Await Numeric Value Resolution
   └─► page.waitForFunction() checks target selector for numeric content
9. Normalise & Validate
   └─► Strips zero-width chars, parses currency & stock
   └─► ReadingValidator verifies identity, price > 0, stock format
```

---

## 2. Text Normalisation & Anti-Obfuscation

`PriceNormalizer` cleans and structures raw extracted text:

### Zero-Width & Hidden Character Removal
```typescript
cleanInvisibleChars(str: string): string {
  return str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim();
}
```

### Stock Status & Quantity Mapping
- `"34 units available"` $\to$ `status: "in_stock"`, `qty: 34`
- `"Last few: 3"` $\to$ `status: "low_stock"`, `qty: 3` (qty $\le 5$)
- `"Sold out"` / `"Out of stock"` $\to$ `status: "out_of_stock"`, `qty: 0`
- Unspecified stock text $\to$ `status: "in_stock"`, `qty: null`

---

## 3. Resiliency & Bounded Retry Policy

### Error Classification
Errors thrown during extraction are classified into typed codes:

| Error Code | Retryable? | Description |
|---|:---:|---|
| `timeout` | **Yes** | Navigation or price value resolution exceeded time budget. |
| `http_429` | **Yes** | Mock store rate-limiting detected. |
| `http_5xx` | **Yes** | Server error on manifest or challenge endpoint. |
| `auth_rejected` | **Yes** | 401/403 returned during challenge pass token handshake. |
| `navigation_failed`| **Yes** | Network socket dropped or page failed to load. |
| `invalid_price` | **Yes** | Parsed price was non-positive or NaN. |
| `invalid_stock` | **Yes** | Stock status was empty or unparseable. |
| `structure_changed`| **No** | Expected manifest elements missing from page (redesign). |
| `option_mismatch` | **No** | Requested variant option does not exist on product. |

### Exponential Backoff with Jitter
For retryable errors:
$$\text{Delay} = \min(8000\text{ms}, 1000\text{ms} \times 2^{\text{attempt}-1}) \times \left(1 + (2r - 1) \times 0.2\right)$$
where $r \in [0, 1)$ provides $\pm 20\%$ randomized jitter to avoid thundering herd conditions.

---

## 4. Frontend UI/UX Design System

Monochrome: pale gray canvas, white rounded app frame, black sidebar and primary buttons, light gray tiles; colour appears only for scrape outcomes. Urbanist Variable type. Tokens live in `frontend/tailwind.config.js`.

```
┌──────┬──────────────────────────────────────────────┬───────────────────┐
│ [≡]  │ INE Price Tracker        [Search catalogue…] [● Online] │ Latest readings   │
│ [+]  │ ┌ Scrape schedule ────────────┐ ┌ Latest run ─┐ │ [All|Retried&fail]│
│ [↻]  │ │ Next run in 1h 22m          │ │ Healthy     │ │ Saffrix Panel ₹16k│
│ [↓]  │ │ ●────────|──|~~~ (0–3h)     │ ├ Read in run ┤ │ Pinecrest  timeout│
│ [↗]  │ │ 4 of 5 │ 92% │ 90 attempts  │ │ 3 / 4       │ │ …                 │
│      │ └─────────────────────────────┘ └─────────────┘ │ How readings are  │
│      │ Tracked variants                  [+ Track]    │ taken · CSV · Store│
│  ●   │ [card] [card] [card]                           │                   │
└──────┴──────────────────────────────────────────────┴───────────────────┘
```

### Key UI Features
1. **Scrape schedule panel (`OverviewPanel`):**
   - Cadence track from 0 to 3 h with ticks at due (2 h) and overdue (2.5 h, the backend's $150\text{ min}$ rule); a marker sits at time since the last run.
   - Headline reads "Next run in …", "Next run due now", "Overdue by …", or "Run in progress"; the overdue zone and marker turn red.
   - Cold-start state ("Waking the backend") while Render free tier spins up.
   - Latest-run status card and a per-outcome breakdown of the last run.
2. **Variant cards and Latest readings rail:** outcome pill, latest price, success-rate bar, stock pill; the rail filters to retried and failed readings.
3. **Price History Chart:**
   - Built with Recharts.
   - Configured with `connectNulls={false}` so failed attempts appear as honest gaps, each marked with a red dashed reference line.
4. **Scrape Log Table:**
   - Displays all historical attempts with local time, outcome badge (`success`, `retried`, `failed`), try count, duration in seconds, manifest revision, and machine error code.
5. **Live Search & Option Picker Modal:**
   - Debounced substring search against the indexed catalog.
   - Live variant selector with duplicate detection to prevent tracking the same variant twice.
