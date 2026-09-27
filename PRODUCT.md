# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Assessment reviewers at INE evaluating this take-home: they open the deployed dashboard, check that tracked mock-store variants show real price and stock readings, inspect scrape health, and judge polish and honesty of the data.

## Product Purpose
INE Price Tracker scrapes the hostile INE mock store (`https://demo.inelabteamdev.com`) with Playwright every 2 hours and records price and stock per tracked product variant. The dashboard shows what is tracked, what the latest readings are, and whether the scrape schedule is healthy. Success: a reviewer understands tracking state and scrape health within seconds and can drill into any variant's full history.

## Positioning
Honest history: failed scrapes are recorded and shown as failures (gaps in charts, typed error codes in the log), never smoothed over or drawn as zero.

## Operating Context
- Backend: Express on Render free tier (cold starts of 30–45 s), Docker Playwright, Supabase storage.
- Frontend: React + Vite + Tailwind on Vercel, polling every 45 s.
- Schedule: cron-job.org triggers a run every 2 hours (UTC); a run is overdue after 150 minutes.
- Run triggers: `cron`, `manual`, `on_track`.

## Capabilities and Constraints
- Search the mock store catalogue, pick a variant option, track it; duplicate active variants are refused.
- Untrack a variant; its history stays saved.
- Per variant: price/stock chart, scrape log (outcome, tries, duration, manifest revision, error code), data table.
- CSV export of all price history.
- Outcomes: `success`, `retried`, `failed`. Stock: `in_stock`, `low_stock`, `out_of_stock`.
- Terminology: see `docs/glossary.md`.

## Brand Commitments
- Name: INE Price Tracker.
- Colour theme chosen by the user: monochrome black, white and light gray (black sidebar and primary buttons, gray tiles on a full-bleed white page, from their "F." learning dashboard reference). Layout keeps the overlapping icon medallions and hero panel from the earlier "dosage" reference.

## Evidence on Hand
Only live data from the backend API. No testimonials, users, or metrics beyond what the API returns; never invent them.

## Product Principles
1. Failures are first-class data; show them plainly.
2. Scrape health is visible before anything else.
3. Every number on screen comes from the API.
4. One click from overview to a variant's full history.
