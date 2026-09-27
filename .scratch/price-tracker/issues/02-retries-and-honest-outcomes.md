Status: ready-for-agent

# 02 — Retries and honest Outcomes

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

Make the scrape-run service reliable across many unattended runs, and make its Outcomes honest. Each Tracked Product gets a bounded number of tries (`SCRAPE_MAX_TRIES`). Each try has a time budget (`SCRAPE_TRY_TIMEOUT_MS`): a hanging reader becomes a `timeout` failure, not a hung run. Retries use exponential backoff with jitter and a fresh browser context/page per try. Errors are classified as retryable or not (`timeout`, `http_429`, `http_5xx`, `auth_rejected`, `navigation_failed`, `option_mismatch`, `invalid_price`, `invalid_stock`, `structure_changed`, `unknown`). `structure_changed` is flagged when the manifest is valid but the expected elements are absent. An unexpected exception on one Tracked Product never stops the others.

Outcome derivation: valid reading on the first try → `success`; valid after ≥1 failed try → `retried`; no valid reading after all tries → `failed`. The Scrape Attempt records the tries count, the last error code and a short summary of per-try reasons. It never stores price/stock unless the reading passed validation.

The retry behaviour must be visible in the headed runner's console (each try, its reason, the backoff wait), so the deliverable recording can show it.

This slice also establishes the project's automated test convention: Vitest (or Jest) tests at **the scrape-run service seam**, with a scripted fake Price Reader, an in-memory attempt store and a fake clock/backoff. No network, no browser.

## Acceptance criteria

- [ ] Service tests cover and pass for:
  - first-try valid reading → `success`, tries = 1, reading stored;
  - N failed tries then valid → `retried`, correct tries count, reading stored;
  - all tries fail → `failed`, price/stock null, last error code recorded;
  - non-retryable error → no further tries, never stored as success;
  - invalid readings (price ≤ 0, NaN, wrong Option, wrong product) → treated as a failed try, never stored as success;
  - a reader that never resolves → `timeout` failure within the try budget;
  - one Tracked Product throwing an unexpected exception → other Tracked Products still get their Scrape Attempts;
  - exactly one Scrape Attempt per active Tracked Product per Scrape Run; inactive ones skipped.
- [ ] Tests assert only recorded Scrape Attempts / run summaries, not internal calls or log text, and run deterministically without network.
- [ ] The headed runner against the live store shows each try, its classified reason and the backoff when the store responds slowly or with an error, and ends with the correct Outcome.
- [ ] Redeployed to production (after 03) with retries active; subsequent unattended runs show `retried` where tries failed.

## Blocked by

- `.scratch/price-tracker/issues/01-headed-scrape-records-attempt.md`
