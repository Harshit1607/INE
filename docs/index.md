# INE Product Price Tracker — Documentation

Welcome to the central documentation hub for the **INE Product Price Tracker**. This system is an honest, production-ready full-stack monitoring and scraping platform engineered specifically for INE's hostile mock e-commerce store ([demo.inelabteamdev.com](https://demo.inelabteamdev.com)).

---

## 📚 Documentation Sections

| Document | Purpose & Contents |
|---|---|
| **[Architecture](architecture.md)** | End-to-end system topology, module boundaries, data pipelines, concurrency mutexes, and deployment infrastructure. |
| **[Design & Reliability](design.md)** | Scraping engine mechanisms, dynamic manifest resolution, human interaction simulation, text normalization, error classification, and UI/UX design. |
| **[Glossary](glossary.md)** | Ubiquitous domain language, system entities, status definitions, and outcome classifications. |
| **[Environment Configuration](env-config.md)** | Reference of all environment variables for backend and frontend deployments. |
| **[Product Requirements Document (PRD)](../.scratch/price-tracker/PRD.md)** | Product vision, user stories, functional criteria, and acceptance requirements. |
| **[Design Note & AI Corrections](../DESIGN_NOTE.md)** | Architectural trade-offs, engineering rationale, and the AI tool corrections log. |

---

## ⚡ Quick System Overview

```
                      ┌────────────────────────────┐
                      │    cron-job.org (2 hrs)    │
                      └─────────────┬──────────────┘
                                    │ POST /api/cron/scrape
                                    ▼
 ┌──────────────────────┐     ┌────────────────────────────┐     ┌──────────────────────┐
 │      React SPA       │◄───►│       Express API          │◄───►│   Mock Store SPA     │
 │       (Vercel)       │     │     (Render Docker)        │     │ (demo.inelabteamdev) │
 └──────────────────────┘     └─────────────┬──────────────┘     └──────────────────────┘
                                            │
                                            ▼
                              ┌────────────────────────────┐
                              │    Supabase Postgres DB    │
                              └────────────────────────────┘
```

### Core Capabilities
1. **Lightweight Catalogue Sync:** Instant search across 960+ products via cached HTTP+JSON snapshots.
2. **Interactive Playwright Scraper:** Headless Chromium automation executing human-like pointer movement, dwell, trusted click, and client-side challenge token resolution.
3. **Rotating Selector Derivation:** Dynamically reads `/api/v2/ui/manifest` before each scrape to adapt to randomized class names.
4. **Data Honesty Guarantee:** Database-level check constraints ensure that failed attempts never record synthetic zeros or stale prices. Line charts render truthful gaps.
5. **Production Scheduling:** Triggered every 2 hours via cron-job.org with a warm-up ping and stale run recovery.

---

## 🚀 Getting Started

### Local Development
```bash
# 1. Start Backend API & Scraper
cd backend
npm install
npx playwright install chromium
npm run dev

# 2. Start Frontend Dashboard
cd ../frontend
npm install
npm run dev
```

### Running the Headed Scraper CLI
```bash
# Watch the scraper interact with the live store in real time:
cd backend
npm run scrape:headed:dry
```

For complete setup instructions, refer to the [Root README](../README.md).
