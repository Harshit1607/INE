Status: ready-for-agent

# 05 — Search and track from the UI

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

Let a user find a Store product by partial or full name, inspect it, pick an Option, and start tracking it, all from the dashboard. They should see a first data point without waiting for the next scheduled run.

- **Catalog snapshot** using plain HTTP only (no browser). The full `/api/v2/listings` catalogue is paged into a `catalog_products` table, with timeouts and retries on each page. It refreshes when older than 24 hours, so search works right after a cold start. Search is a case-insensitive substring match on name, backed by an index.
- `GET /api/search?q=` → matching Store products (name, brand, category, Store product ID).
- `GET /api/store-products/:id` → live detail from `/api/v2/items/:id`: description, specs, rating/reviews summary, Option axis and Options.
- `POST /api/tracked {storeProductId, optionId}`: validates the Option against the live Options and stores the product name/brand/category and Option axis/label. Returns `409` on a duplicate (Store product, Option). Then starts an `on_track` Scrape Run for just that Tracked Product in the background, respecting the run lock.
- `DELETE /api/tracked/:id`: deactivates the Tracked Product so it's excluded from future Scrape Runs. History stays visible and exportable.
- **UI**:
  - Search box with results and a clear empty state.
  - Product detail with an Option picker.
  - A Track button with feedback on duplicates.
  - An Untrack action on the dashboard.
  - A newly tracked product appears in the overview and gets its first Scrape Attempt shortly after.

## Acceptance criteria

- [ ] Searching a partial name (e.g. "smart panel"), a full name, and a mixed-case query returns the right Store products. A nonsense query shows "no products match".
- [ ] Search works on the first request after the Render instance has slept (the snapshot is in Supabase, not only in memory).
- [ ] Product detail shows the Option axis and all Options for the chosen Store product, matching the live store.
- [ ] Tracking a new (Store product, Option) creates the Tracked Product, and within a few minutes it shows a first Scrape Attempt on the dashboard (a `success`/`retried` reading or an honest `failed`).
- [ ] Tracking the same pair again shows a duplicate message, and no second Tracked Product is created.
- [ ] Tracking a second Option of the same Store product creates a separate Tracked Product with its own history.
- [ ] Untracking removes it from subsequent Scrape Runs (the next run has no new Scrape Attempt for it), while its history and CSV rows remain.
- [ ] No browser is launched for search or detail (plain HTTP only).

## Blocked by

- `.scratch/price-tracker/issues/04-dashboard-history-log-export-health.md`
