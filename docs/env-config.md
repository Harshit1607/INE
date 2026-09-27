# Environment Variables

Every variable the code reads. The backend loads `backend/.env` via `dotenv`; the frontend reads Vite variables at build time.

## Backend

| Variable | Read by | Default | Example / notes |
|---|---|---|---|
| `SUPABASE_URL` | API server, headed runner, catalogue sync | none | `https://xyzcompany.supabase.co`. Required for the API. When unset, the headed runner switches to dry-run and the catalogue sync keeps the snapshot in memory only. |
| `SUPABASE_SERVICE_ROLE_KEY` | API server, headed runner, catalogue sync | none | `eyJhbGciOi...`. Backend only; never expose it to the frontend. |
| `CRON_SECRET` | API server | `dev-secret-123` | Any long random string. `POST /api/cron/scrape` accepts it as `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`. Always set it in production. |
| `PORT` | API server | `3001` | The Docker image sets `10000`. |
| `CORS_ORIGIN` | API server | `*` | `https://ine-taupe.vercel.app`. A comma-separated list is allowed. |
| `STORE_BASE_URL` | Catalogue client, Price Reader | `https://demo.inelabteamdev.com` | Trailing slash is stripped. |
| `HEADLESS` | API server, headed runner | `true` | API server: `false` opens a visible browser. Headed runner: headed by default; `true` forces headless (same as `--headless`). |
| `SLOW_MO_MS` | API server | `0` | Delay in ms between browser actions. The headed runner ignores it and uses 250 ms when headed. |
| `SCRAPE_MAX_TRIES` | API server | `3` | Max tries per Tracked Product per Scrape Run. The headed runner always uses 3. |
| `SCRAPE_TRY_TIMEOUT_MS` | API server, Price Reader | `45000` | Per-try timeout and Playwright page timeout, in ms. The headed runner's try timeout is fixed at 45 000 ms. |

## Frontend

| Variable | Default | Example / notes |
|---|---|---|
| `VITE_API_BASE_URL` | empty | `https://ine-613p.onrender.com`. Leave empty locally: requests go to `/api`, which the Vite dev server proxies to `http://localhost:3001`. Set it in Vercel for production. |
