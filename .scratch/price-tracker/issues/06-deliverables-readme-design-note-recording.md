Status: ready-for-human

# 06 — Deliverables: README, design note, headed screen recording

## Parent

`.scratch/price-tracker/PRD.md`

## What to build

The non-code deliverables required for submission (deadline 27 Sep 2026, 11:59 PM IST, via https://forms.gle/6LGyJV9yi6W1gna18). This issue is `ready-for-human` because the recording and the AI-usage disclosure have to come from the candidate.

- **README**:
  - Project overview and architecture.
  - Local setup (backend, frontend, Supabase schema, Playwright install).
  - How to run the headed runner.
  - The scraping schedule (`0 */2 * * *` UTC via cron-job.org, with the warm-up ping).
  - Every environment variable, split by backend and frontend.
  - Deployed URLs.
- **Design note**, covering:
  - How scraping was made reliable: HTTP+JSON for catalogue, Playwright only for the gated price, manifest-driven selectors, Option confirmation, value waits, normalisation, validation, retries/backoff, per-product isolation, run lock, honesty constraint.
  - Trade-offs: browser vs reverse-engineering the token flow, free-tier memory, sequential scraping, 202 + background execution, the manual-only Price Reader verification.
  - The interpretation of "scrape attempt" and `retried`.
  - What the AI tools got wrong on the first attempt and how it was corrected. Use the running log kept during 01–05.
- **Screen recording** (2–4 minutes): the headed runner against the live mock store, clearly showing at least one slow or failing response being retried and the final Outcome.
- **Submission**: public GitHub repo containing all source, live Vercel link with at least 2–3 Tracked Products showing real unattended runs, PDF resume.

## Acceptance criteria

- [ ] Someone following only the README can set up and run the project locally, including a headed run.
- [ ] README lists the schedule and every environment variable actually read by the code.
- [ ] Design note covers reliability approach, trade-offs, and concrete AI mistakes with their corrections.
- [ ] Recording is 2–4 minutes and shows a slow/failing response handled by a retry.
- [ ] GitHub repo is public and contains no secrets. Live link works. The dashboard shows ≥ 2–3 Tracked Products with multiple unattended Scrape Runs.
- [ ] Submission form sent before the deadline.

## Blocked by

- `.scratch/price-tracker/issues/02-retries-and-honest-outcomes.md`
- `.scratch/price-tracker/issues/03-unattended-scrape-runs-in-production.md`
- `.scratch/price-tracker/issues/04-dashboard-history-log-export-health.md`
- `.scratch/price-tracker/issues/05-search-and-track-from-ui.md`
