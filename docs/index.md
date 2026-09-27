# INE Product Price Tracker: Documentation

Setup, running, API, schedule and deployment are in the root [`README.md`](../README.md). This folder holds the deeper references.

| Document | Contents |
|---|---|
| [Architecture](architecture.md) | Topology, infrastructure, backend modules, run lock and recovery, memory limits, honesty guarantee, schedule health. |
| [Technical and UX design](design.md) | The store's defences, the Price Reader's extraction flow, normalisation, error codes and retry policy, dashboard layout. |
| [Glossary](glossary.md) | Domain terms (Tracked Product, Scrape Run, Scrape Attempt, Try, Outcome, …) and error codes. |
| [Environment variables](env-config.md) | Every variable the backend and frontend read, with defaults and examples. |
| [Design note](../DESIGN_NOTE.md) | Reliability strategy, trade-offs, and the AI corrections log. |
| [Design system](../DESIGN.md) | Visual tokens, components and rules for the dashboard. |
| [Product brief](../PRODUCT.md) | Users, purpose and product principles. |
| [PRD](../.scratch/price-tracker/PRD.md) | Problem statement, user stories and implementation decisions. |
| [Agent docs](agents/) | Conventions for coding agents: issue tracker, triage labels, domain docs. |

## System at a glance

```
                      ┌────────────────────────────┐
                      │    cron-job.org (2 hrs)    │
                      └─────────────┬──────────────┘
                                    │ POST /api/cron/scrape
                                    ▼
 ┌──────────────────────┐     ┌────────────────────────────┐     ┌──────────────────────┐
 │      React SPA       │◄───►│       Express API          │◄───►│   INE mock store     │
 │       (Vercel)       │     │     (Render, Docker)       │     │ (demo.inelabteamdev) │
 └──────────────────────┘     └─────────────┬──────────────┘     └──────────────────────┘
                                            │
                                            ▼
                              ┌────────────────────────────┐
                              │    Supabase Postgres       │
                              └────────────────────────────┘
```

- **Catalogue over HTTP:** a snapshot of the store's ~960 products, synced from its JSON API, backs search and browsing.
- **Price over Playwright:** headless Chromium passes the store's pointer, dwell and trusted-click gate, rejects stale quotes, and reads price and stock using class names from `/api/v2/ui/manifest`.
- **Honest data:** a failed Scrape Attempt stores no price or stock (enforced by a database check constraint); charts show failures as gaps.
- **Unattended schedule:** cron-job.org triggers a run every 2 hours after a warm-up ping; crashed runs are recovered automatically.
