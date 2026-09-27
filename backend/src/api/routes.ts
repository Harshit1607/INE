import { Request, Response, Router } from 'express';
import { CatalogClient } from '../catalog/catalog-client.js';
import { CatalogSnapshotService } from '../catalog/catalog-snapshot.js';
import { SupabaseAttemptStore } from '../service/supabase-attempt-store.js';
import { RunCoordinator } from '../service/run-coordinator.js';
import { CSVExporter } from './csv-exporter.js';
import { TrackedProduct } from '../domain/types.js';

export interface RouteDependencies {
  attemptStore: SupabaseAttemptStore;
  catalogClient: CatalogClient;
  catalogSnapshot: CatalogSnapshotService;
  runCoordinator: RunCoordinator;
  cronSecret: string;
}

export function createRouter(deps: RouteDependencies): Router {
  const router = Router();
  const { attemptStore, catalogClient, catalogSnapshot, runCoordinator, cronSecret } = deps;

  // 1. Health check & warm-up endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      service: 'ine-price-tracker-backend'
    });
  });

  // 2. Cron Scrape endpoint
  router.post('/cron/scrape', async (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'] || '';
    const secretHeader = (req.headers['x-cron-secret'] as string) || '';
    const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    const providedSecret = secretHeader || bearerSecret;

    if (!cronSecret || providedSecret !== cronSecret) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' });
      return;
    }

    try {
      const { run, executePromise } = await runCoordinator.startRun('cron');

      // Do not await executePromise so cron endpoint returns immediately within timeout
      executePromise.catch((err) => {
        console.error(`[Router] Background cron run ${run.id} failed:`, err);
      });

      res.status(202).json({
        runId: run.id,
        status: 'running',
        message: 'Scrape run started in background',
        startedAt: run.startedAt
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already in progress')) {
        res.status(409).json({ error: msg });
        return;
      }
      res.status(500).json({ error: `Failed to initiate scrape run: ${msg}` });
    }
  });

  // 3. Catalog Search
  router.get('/search', async (req: Request, res: Response) => {
    const query = String(req.query.q || '');
    if (!query.trim()) {
      res.json({ results: [] });
      return;
    }

    try {
      const results = await catalogSnapshot.searchProducts(query);
      res.json({ results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Search failed: ${msg}` });
    }
  });

  // 4. Store Product Detail & Options (Live)
  router.get('/store-products/:id', async (req: Request, res: Response) => {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    try {
      const detail = await catalogClient.fetchItem(productId);
      res.json(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to fetch store product details: ${msg}` });
    }
  });

  // 5. Tracked Products List & Dashboard Overview
  router.get('/tracked', async (_req: Request, res: Response) => {
    try {
      const trackedProducts = await attemptStore.getAllTrackedProducts();

      // For each product, calculate latest reading, last success, success rate
      const overview = await Promise.all(
        trackedProducts.map(async (tp) => {
          const attempts = await attemptStore.getProductAttempts(tp.id);
          const totalAttempts = attempts.length;
          const successfulAttempts = attempts.filter((a) => a.outcome === 'success' || a.outcome === 'retried');
          const lastSuccess = successfulAttempts.length > 0 ? successfulAttempts[0] : null;
          const latestAttempt = attempts.length > 0 ? attempts[0] : null;

          const successRate = totalAttempts > 0
            ? Math.round((successfulAttempts.length / totalAttempts) * 100)
            : 0;

          return {
            ...tp,
            totalAttempts,
            successRate,
            lastSuccessfulScrape: lastSuccess ? lastSuccess.finishedAt : null,
            latestReading: latestAttempt
              ? {
                  outcome: latestAttempt.outcome,
                  price: latestAttempt.price,
                  currency: latestAttempt.currency,
                  stockStatus: latestAttempt.stockStatus,
                  stockQty: latestAttempt.stockQty,
                  finishedAt: latestAttempt.finishedAt,
                  errorCode: latestAttempt.errorCode,
                  manifestRevision: latestAttempt.manifestRevision
                }
              : null
          };
        })
      );

      res.json({ trackedProducts: overview });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to fetch tracked products: ${msg}` });
    }
  });

  // 6. Create Tracked Product with immediate on_track scrape
  router.post('/tracked', async (req: Request, res: Response) => {
    const { storeProductId, optionId } = req.body;
    if (!storeProductId || !optionId) {
      res.status(400).json({ error: 'Missing storeProductId or optionId' });
      return;
    }

    try {
      // 1. Verify item and option exist live
      const itemDetail = await catalogClient.fetchItem(Number(storeProductId));
      const chosenOption = itemDetail.options.find((o) => o.id === optionId);
      if (!chosenOption) {
        res.status(400).json({ error: `Option '${optionId}' not found for product ${storeProductId}` });
        return;
      }

      // 2. Insert into Supabase
      const client = attemptStore.getClient();
      const { data, error } = await client
        .from('tracked_products')
        .insert({
          store_product_id: itemDetail.id,
          slug: itemDetail.slug,
          product_name: itemDetail.name,
          brand: itemDetail.brand,
          category: itemDetail.category,
          option_id: chosenOption.id,
          option_axis: itemDetail.optionAxis || 'Option',
          option_label: chosenOption.label,
          active: true
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique')) {
          res.status(409).json({ error: 'This product and option pair is already being tracked' });
          return;
        }
        res.status(500).json({ error: `Failed to create tracked product: ${error.message}` });
        return;
      }

      const newTrackedProduct: TrackedProduct = {
        id: data.id,
        storeProductId: data.store_product_id,
        slug: data.slug,
        productName: data.product_name,
        brand: data.brand,
        category: data.category,
        optionId: data.option_id,
        optionAxis: data.option_axis,
        optionLabel: data.option_label,
        active: data.active,
        createdAt: data.created_at
      };

      // 3. Trigger immediate on_track scrape in background (respecting lock)
      runCoordinator.startRun('on_track', newTrackedProduct).then(({ executePromise }) => {
        executePromise.catch((e) => console.error('[Router] On-track scrape failed:', e));
      }).catch((e) => {
        console.warn('[Router] Could not start immediate on_track scrape (run might be active):', e.message);
      });

      res.status(201).json({ trackedProduct: newTrackedProduct });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to create tracked product: ${msg}` });
    }
  });

  // 7. Deactivate / Untrack Product
  router.delete('/tracked/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const client = attemptStore.getClient();
      const { error } = await client
        .from('tracked_products')
        .update({ active: false })
        .eq('id', id);

      if (error) {
        res.status(500).json({ error: `Failed to deactivate product: ${error.message}` });
        return;
      }

      res.json({ success: true, message: 'Tracked product deactivated' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to deactivate tracked product: ${msg}` });
    }
  });

  // 8. Tracked Product History & Scrape Log
  router.get('/tracked/:id/attempts', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const product = await attemptStore.getTrackedProductById(id);
      if (!product) {
        res.status(404).json({ error: 'Tracked product not found' });
        return;
      }

      const attempts = await attemptStore.getProductAttempts(id);
      res.json({ product, attempts });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to fetch product attempts: ${msg}` });
    }
  });

  // 9. Run Health Endpoint
  router.get('/runs/health', async (_req: Request, res: Response) => {
    try {
      const latestRun = await attemptStore.getLatestRun();
      let isOverdue = false;
      let timeSinceLastRunMinutes: number | null = null;

      if (!latestRun) {
        isOverdue = true;
      } else {
        const lastRunTime = new Date(latestRun.startedAt).getTime();
        timeSinceLastRunMinutes = Math.round((Date.now() - lastRunTime) / (60 * 1000));
        // Overdue if no run for > 150 minutes (2.5 hours)
        isOverdue = timeSinceLastRunMinutes > 150;
      }

      res.json({
        latestRun,
        isOverdue,
        timeSinceLastRunMinutes,
        checkedAt: new Date().toISOString()
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to check run health: ${msg}` });
    }
  });

  // 10. CSV Full History Export
  router.get('/export.csv', async (_req: Request, res: Response) => {
    try {
      const rows = await attemptStore.getAllAttemptsForExport();
      const csvContent = CSVExporter.generateCSV(rows);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="price-history.csv"');
      res.status(200).send(csvContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to export CSV: ${msg}` });
    }
  });

  return router;
}
