import dotenv from 'dotenv';
dotenv.config();

import { CatalogClient } from '../catalog/catalog-client.js';
import { PlaywrightPriceReader } from '../reader/playwright-price-reader.js';
import { InMemoryAttemptStore } from '../service/in-memory-attempt-store.js';
import { SupabaseAttemptStore } from '../service/supabase-attempt-store.js';
import { ScrapeRunService } from '../service/scrape-run-service.js';
import { AttemptStore, TrackedProduct } from '../domain/types.js';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !process.env.SUPABASE_URL;
  const isHeadless = args.includes('--headless') || process.env.HEADLESS === 'true';

  let productId = 2692;
  const productIdx = args.indexOf('--productId');
  if (productIdx !== -1 && args[productIdx + 1]) {
    productId = parseInt(args[productIdx + 1], 10);
  }

  let optionId = 'o2';
  const optionIdx = args.indexOf('--optionId');
  if (optionIdx !== -1 && args[optionIdx + 1]) {
    optionId = args[optionIdx + 1];
  }

  const slowMo = isHeadless ? 0 : 250;

  console.log('====================================================');
  console.log('       INE PRICE TRACKER — HEADED RUNNER CLI         ');
  console.log('====================================================');
  console.log(`Target Product ID : ${productId}`);
  console.log(`Target Option ID  : ${optionId}`);
  console.log(`Headless Mode     : ${isHeadless}`);
  console.log(`Slow Motion (ms)  : ${slowMo}`);
  console.log(`Dry Run Mode      : ${isDryRun}`);
  console.log('----------------------------------------------------');

  const catalogClient = new CatalogClient();
  let productDetail;
  try {
    productDetail = await catalogClient.fetchItem(productId);
  } catch (err: unknown) {
    console.error(`[HeadedRunner] Could not fetch catalog metadata for product ${productId}:`, err);
    process.exit(1);
  }

  const option = productDetail.options.find((o) => o.id === optionId) || {
    id: optionId,
    label: `Option ${optionId}`
  };

  const trackedProduct: TrackedProduct = {
    id: `local-prod-${productId}-${optionId}`,
    storeProductId: productId,
    slug: productDetail.slug,
    productName: productDetail.name,
    brand: productDetail.brand,
    category: productDetail.category,
    optionId: option.id,
    optionAxis: productDetail.optionAxis || 'Option',
    optionLabel: option.label,
    active: true,
    createdAt: new Date().toISOString()
  };

  let store: AttemptStore;
  if (isDryRun) {
    console.log('[HeadedRunner] Using IN-MEMORY Attempt Store (Dry Run)');
    store = new InMemoryAttemptStore([trackedProduct]);
  } else {
    console.log('[HeadedRunner] Using SUPABASE Attempt Store');
    store = new SupabaseAttemptStore();
  }

  const logger = (msg: string) => {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}] ${msg}`);
  };

  const reader = new PlaywrightPriceReader({
    headless: isHeadless,
    slowMo,
    catalogClient,
    logger
  });

  const service = new ScrapeRunService(
    {
      priceReader: reader,
      attemptStore: store,
      logger
    },
    {
      maxTries: 3,
      tryTimeoutMs: 30000,
      initialBackoffMs: 1000
    }
  );

  try {
    const summary = await service.runScrape([trackedProduct]);
    console.log('\n====================================================');
    console.log('                  RUN SUMMARY                       ');
    console.log('====================================================');
    console.log(`Total Products  : ${summary.total}`);
    console.log(`Success (1 try) : ${summary.success}`);
    console.log(`Retried (>=2)   : ${summary.retried}`);
    console.log(`Failed          : ${summary.failed}`);
    console.log('----------------------------------------------------');
    console.log('Recorded Attempt Details:');
    console.log(JSON.stringify(summary.attempts, null, 2));
    console.log('====================================================');
  } catch (err: unknown) {
    console.error('[HeadedRunner] Fatal error during scrape execution:', err);
  } finally {
    await reader.close();
  }
}

main().catch(console.error);
