# Environment Variables Configuration

## Backend Configuration

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP port for the Express backend | `3001` (local) / `10000` (Render) |
| `STORE_BASE_URL` | Base URL of the mock store | `https://demo.inelabteamdev.com` |
| `CRON_SECRET` | Shared secret header required for `/api/cron/scrape` | `your-secret-key-here` |
| `SUPABASE_URL` | Supabase project URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret key (backend only) | `eyJhbGciOi...` |
| `CORS_ORIGIN` | Allowed origin for frontend requests | `https://your-frontend.vercel.app` (or `*` in local dev) |
| `HEADLESS` | Run Playwright in headless mode | `true` (prod/CLI) or `false` (headed mode) |
| `SLOW_MO_MS` | Slow-motion delay in ms for visible browser runs | `0` (prod) / `250` (headed debug/recording) |
| `SCRAPE_MAX_TRIES` | Max tries per tracked product per scrape run | `3` |
| `SCRAPE_TRY_TIMEOUT_MS` | Timeout per try before timeout error | `45000` |

---

## Frontend Configuration

| Variable | Description | Default / Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL pointing to deployed Render Express API | `https://price-tracker-backend.onrender.com` (leave empty for local dev proxy) |
