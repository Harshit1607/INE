import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import { CatalogClient } from './catalog/catalog-client.js';
import { CatalogSnapshotService } from './catalog/catalog-snapshot.js';
import { PlaywrightPriceReader } from './reader/playwright-price-reader.js';
import { SupabaseAttemptStore } from './service/supabase-attempt-store.js';
import { ScrapeRunService } from './service/scrape-run-service.js';
import { RunCoordinator } from './service/run-coordinator.js';
import { createRouter } from './api/routes.js';

const app: Express = express();
const port = parseInt(process.env.PORT || '3001', 10);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const cronSecret = process.env.CRON_SECRET || 'dev-secret-123';

app.use(express.json());

// Configure CORS
const allowedOrigins = corsOrigin === '*'
  ? '*'
  : corsOrigin.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigin === '*') {
        return callback(null, true);
      }
      if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret']
  })
);

// Instantiate Services
const catalogClient = new CatalogClient();
let attemptStore: SupabaseAttemptStore;

try {
  attemptStore = new SupabaseAttemptStore();
} catch (err) {
  console.warn('[Server] Supabase credentials not found or invalid; falling back to stub/in-memory mode if needed.');
  // We re-instantiate or let error surface on database queries
  attemptStore = new SupabaseAttemptStore({
    supabaseUrl: 'https://placeholder.supabase.co',
    supabaseKey: 'placeholder-key'
  });
}

const catalogSnapshot = new CatalogSnapshotService(
  process.env.SUPABASE_URL ? attemptStore.getClient() : null,
  catalogClient
);

const priceReader = new PlaywrightPriceReader({
  headless: process.env.HEADLESS !== 'false',
  slowMo: process.env.SLOW_MO_MS ? parseInt(process.env.SLOW_MO_MS, 10) : 0,
  catalogClient,
  logger: (msg) => console.log(`[PriceReader] ${msg}`)
});

const scrapeRunService = new ScrapeRunService(
  {
    priceReader,
    attemptStore,
    logger: (msg) => console.log(msg)
  },
  {
    maxTries: process.env.SCRAPE_MAX_TRIES ? parseInt(process.env.SCRAPE_MAX_TRIES, 10) : 3,
    tryTimeoutMs: process.env.SCRAPE_TRY_TIMEOUT_MS ? parseInt(process.env.SCRAPE_TRY_TIMEOUT_MS, 10) : 45000
  }
);

const runCoordinator = new RunCoordinator(attemptStore, scrapeRunService, {
  staleThresholdMinutes: 20,
  logger: (msg) => console.log(msg)
});

// Mount Routes
const apiRouter = createRouter({
  attemptStore,
  catalogClient,
  catalogSnapshot,
  runCoordinator,
  cronSecret
});

app.use('/api', apiRouter);
app.use('/', apiRouter); // Also serve at root for direct /health or /export.csv hits

// Startup server
const bootedAt = Date.now();
const server = app.listen(port, async () => {
  console.log(`[Server] INE Price Tracker Backend listening on port ${port}`);
  console.log(`[Server] Headless: ${process.env.HEADLESS !== 'false'}, CORS Origin: ${corsOrigin}`);

  // Only one instance runs, so a run still 'running' that started before this process booted belonged
  // to a process that died (crash, out-of-memory kill, redeploy); close it instead of leaving it
  // "running" for 20 minutes. The cutoff is boot time (minus clock-skew margin), not now, so a cron
  // run started by the request that woke this instance is left alone.
  if (process.env.SUPABASE_URL) {
    try {
      const minutesSinceBoot = (Date.now() - bootedAt + 2000) / 60000;
      const orphaned = await attemptStore.markStaleRunsAbandoned(minutesSinceBoot);
      if (orphaned > 0) console.log(`[Server] Marked ${orphaned} run(s) left over from a previous process as abandoned.`);
    } catch (err: unknown) {
      console.warn('[Server] Orphaned run recovery warning:', err instanceof Error ? err.message : String(err));
    }
  }

  // Background catalog snapshot check
  try {
    const isFresh = await catalogSnapshot.isSnapshotFresh(24);
    if (!isFresh) {
      console.log('[Server] Catalog snapshot is stale or missing. Synchronizing listings in background...');
      catalogSnapshot.syncSnapshot((msg) => console.log(msg)).catch((e) => {
        console.warn('[Server] Catalog sync warning:', e.message);
      });
    } else {
      console.log('[Server] Catalog snapshot is fresh.');
    }
  } catch (err: unknown) {
    console.warn('[Server] Catalog freshness check warning:', err instanceof Error ? err.message : String(err));
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await priceReader.close();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await priceReader.close();
  server.close(() => {
    process.exit(0);
  });
});
