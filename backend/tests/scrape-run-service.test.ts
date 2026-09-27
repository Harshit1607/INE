import { describe, expect, it } from 'vitest';
import {
  ErrorCode,
  PriceReader,
  PriceReading,
  ScrapeError,
  TrackedProduct
} from '../src/domain/types.js';
import { InMemoryAttemptStore } from '../src/service/in-memory-attempt-store.js';
import { ScrapeRunService } from '../src/service/scrape-run-service.js';
import { ReadingValidator } from '../src/domain/validator.js';
import { PriceNormalizer } from '../src/reader/price-normalizer.js';
import { RunCoordinator } from '../src/service/run-coordinator.js';
import { CSVExporter } from '../src/api/csv-exporter.js';

describe('PriceNormalizer & ReadingValidator', () => {
  it('normalizes price strings with zero-width characters, non-breaking spaces and currency symbols', () => {
    const raw = '₹\u200B1\u00A06\u200B,\u200B0\u200B4\u200B4';
    const result = PriceNormalizer.normalizePrice(raw);
    expect(result.price).toBe(16044);
    expect(result.currency).toBe('INR');
  });

  it('normalizes EUR and USD formatted prices', () => {
    const eur = PriceNormalizer.normalizePrice('€ 1.250,50');
    expect(eur.price).toBe(1250.5);
    expect(eur.currency).toBe('EUR');

    const usd = PriceNormalizer.normalizePrice('$ 299.99');
    expect(usd.price).toBe(299.99);
    expect(usd.currency).toBe('USD');
  });

  it('parses the store\'s comma-decimal format when the rupee amount uses lakh grouping', () => {
    // The store's `euro` format swaps en-IN separators: ₹1,84,683 renders as ₹1.84.683,00.
    expect(PriceNormalizer.normalizePrice('₹1.84.683,00').price).toBe(184683);
    expect(PriceNormalizer.normalizePrice('₹\u200B1\u200B1\u200B.\u200B1\u200B0\u200B.\u200B4\u200B5\u200B6\u200B,\u200B0\u200B0').price).toBe(1110456);
    expect(PriceNormalizer.normalizePrice('₹57.437,00').price).toBe(57437);
  });

  it('normalizes stock status and quantity', () => {
    expect(PriceNormalizer.normalizeStock('34 units available')).toEqual({
      status: 'in_stock',
      qty: 34,
      rawText: '34 units available'
    });

    expect(PriceNormalizer.normalizeStock('Last few: 3')).toEqual({
      status: 'low_stock',
      qty: 3,
      rawText: 'Last few: 3'
    });

    expect(PriceNormalizer.normalizeStock('Sold out')).toEqual({
      status: 'out_of_stock',
      qty: 0,
      rawText: 'Sold out'
    });
  });

  it('validates correct reading without throwing', () => {
    const validReading: PriceReading = {
      storeProductId: 2692,
      optionId: 'o2',
      price: 15000,
      currency: 'INR',
      stockStatus: 'in_stock',
      stockQty: 10,
      manifestRevision: 100,
      readAt: new Date().toISOString()
    };

    expect(() => ReadingValidator.validate(validReading, { storeProductId: 2692, optionId: 'o2' })).not.toThrow();
  });

  it('rejects invalid reading with non-positive or NaN price', () => {
    const invalidReading: PriceReading = {
      storeProductId: 2692,
      optionId: 'o2',
      price: -50,
      currency: 'INR',
      stockStatus: 'in_stock',
      stockQty: 10,
      manifestRevision: 100,
      readAt: new Date().toISOString()
    };

    expect(() => ReadingValidator.validate(invalidReading, { storeProductId: 2692, optionId: 'o2' }))
      .toThrowError(ScrapeError);
  });

  it('rejects reading when optionId or storeProductId mismatch', () => {
    const mismatchedReading: PriceReading = {
      storeProductId: 2692,
      optionId: 'o1',
      price: 15000,
      currency: 'INR',
      stockStatus: 'in_stock',
      stockQty: 10,
      manifestRevision: 100,
      readAt: new Date().toISOString()
    };

    expect(() => ReadingValidator.validate(mismatchedReading, { storeProductId: 2692, optionId: 'o2' }))
      .toThrowError(ScrapeError);
  });
});

describe('CSVExporter Tests', () => {
  it('generates properly formatted RFC 4180 CSV with empty price/stock on failed rows', () => {
    const rows = [
      {
        storeProductId: 2692,
        productName: 'Smart Panel, "Pro" Model',
        optionLabel: 'Warm white',
        timestamp: '2026-09-26T12:00:00.000Z',
        price: 16000,
        stock: 'in_stock (10)',
        outcome: 'success' as const
      },
      {
        storeProductId: 2818,
        productName: 'Console Zen',
        optionLabel: 'Standard',
        timestamp: '2026-09-26T12:02:00.000Z',
        price: null,
        stock: null,
        outcome: 'failed' as const
      }
    ];

    const csv = CSVExporter.generateCSV(rows);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('store_product_id,product_name,option,timestamp,price,stock,outcome');
    expect(lines[1]).toBe('2692,"Smart Panel, ""Pro"" Model",Warm white,2026-09-26T12:00:00.000Z,16000,in_stock (10),success');
    expect(lines[2]).toBe('2818,Console Zen,Standard,2026-09-26T12:02:00.000Z,,,failed');
  });
});

describe('ScrapeRunService Seam Tests', () => {
  const mockProduct1: TrackedProduct = {
    id: 'tp-1',
    storeProductId: 101,
    productName: 'Product Alpha',
    optionId: 'o1',
    optionAxis: 'Size',
    optionLabel: 'Small',
    active: true,
    createdAt: new Date().toISOString()
  };

  const mockProduct2: TrackedProduct = {
    id: 'tp-2',
    storeProductId: 102,
    productName: 'Product Beta',
    optionId: 'o2',
    optionAxis: 'Tone',
    optionLabel: 'Warm',
    active: true,
    createdAt: new Date().toISOString()
  };

  it('records Outcome=success when first try succeeds', async () => {
    const store = new InMemoryAttemptStore([mockProduct1]);
    const fakeReader: PriceReader = {
      read: async (id, opt) => ({
        storeProductId: id,
        optionId: opt,
        price: 500,
        currency: 'INR',
        stockStatus: 'in_stock',
        stockQty: 12,
        manifestRevision: 1,
        readAt: new Date().toISOString()
      })
    };

    const service = new ScrapeRunService({
      priceReader: fakeReader,
      attemptStore: store,
      backoffFn: async () => {}
    });

    const summary = await service.runScrape([mockProduct1], 'run-1');
    expect(summary.total).toBe(1);
    expect(summary.success).toBe(1);
    expect(summary.retried).toBe(0);
    expect(summary.failed).toBe(0);

    const attempts = store.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe('success');
    expect(attempts[0].triesCount).toBe(1);
    expect(attempts[0].price).toBe(500);
    expect(attempts[0].stockStatus).toBe('in_stock');
    expect(attempts[0].errorCode).toBeNull();
  });

  it('records Outcome=retried when first try fails and second succeeds', async () => {
    const store = new InMemoryAttemptStore([mockProduct1]);
    let callCount = 0;
    const fakeReader: PriceReader = {
      read: async (id, opt) => {
        callCount++;
        if (callCount === 1) {
          throw new ScrapeError('http_429', 'Rate limited', true);
        }
        return {
          storeProductId: id,
          optionId: opt,
          price: 750,
          currency: 'INR',
          stockStatus: 'in_stock',
          stockQty: 5,
          manifestRevision: 1,
          readAt: new Date().toISOString()
        };
      }
    };

    const service = new ScrapeRunService({
      priceReader: fakeReader,
      attemptStore: store,
      backoffFn: async () => {}
    });

    const summary = await service.runScrape([mockProduct1], 'run-2');
    expect(summary.total).toBe(1);
    expect(summary.success).toBe(0);
    expect(summary.retried).toBe(1);
    expect(summary.failed).toBe(0);

    const attempts = store.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe('retried');
    expect(attempts[0].triesCount).toBe(2);
    expect(attempts[0].price).toBe(750);
    expect(attempts[0].errorCode).toBeNull();
  });

  it('records Outcome=failed with null price/stock when all tries fail', async () => {
    const store = new InMemoryAttemptStore([mockProduct1]);
    const fakeReader: PriceReader = {
      read: async () => {
        throw new ScrapeError('http_5xx', 'Internal server error', true);
      }
    };

    const service = new ScrapeRunService(
      {
        priceReader: fakeReader,
        attemptStore: store,
        backoffFn: async () => {}
      },
      { maxTries: 3 }
    );

    const summary = await service.runScrape([mockProduct1], 'run-3');
    expect(summary.total).toBe(1);
    expect(summary.success).toBe(0);
    expect(summary.retried).toBe(0);
    expect(summary.failed).toBe(1);

    const attempts = store.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe('failed');
    expect(attempts[0].triesCount).toBe(3);
    expect(attempts[0].price).toBeNull();
    expect(attempts[0].stockStatus).toBeNull();
    expect(attempts[0].errorCode).toBe('http_5xx');
    expect(attempts[0].errorDetail).toContain('Internal server error');
  });

  it('stops immediately and records failed on non-retryable error (e.g. structure_changed)', async () => {
    const store = new InMemoryAttemptStore([mockProduct1]);
    let callCount = 0;
    const fakeReader: PriceReader = {
      read: async () => {
        callCount++;
        throw new ScrapeError('structure_changed', 'Price panel class missing', false);
      }
    };

    const service = new ScrapeRunService(
      {
        priceReader: fakeReader,
        attemptStore: store,
        backoffFn: async () => {}
      },
      { maxTries: 3 }
    );

    const summary = await service.runScrape([mockProduct1], 'run-4');
    expect(summary.failed).toBe(1);
    expect(callCount).toBe(1); // Only tried once because non-retryable!

    const attempts = store.getAttempts();
    expect(attempts[0].outcome).toBe('failed');
    expect(attempts[0].triesCount).toBe(1);
    expect(attempts[0].errorCode).toBe('structure_changed');
    expect(attempts[0].price).toBeNull();
  });

  it('handles hanging reader with try timeout', async () => {
    const store = new InMemoryAttemptStore([mockProduct1]);
    const fakeReader: PriceReader = {
      read: async () => {
        // Hang forever
        const { promise } = Promise.withResolvers<PriceReading>();
        return promise;
      }
    };

    const service = new ScrapeRunService(
      {
        priceReader: fakeReader,
        attemptStore: store,
        backoffFn: async () => {}
      },
      { maxTries: 2, tryTimeoutMs: 50 }
    );

    const summary = await service.runScrape([mockProduct1], 'run-5');
    expect(summary.failed).toBe(1);

    const attempts = store.getAttempts();
    expect(attempts[0].outcome).toBe('failed');
    expect(attempts[0].errorCode).toBe('timeout');
    expect(attempts[0].triesCount).toBe(2);
  });

  it('isolates failures so one failing product does not affect others', async () => {
    const store = new InMemoryAttemptStore([mockProduct1, mockProduct2]);
    const fakeReader: PriceReader = {
      read: async (id, opt) => {
        if (id === 101) {
          throw new Error('Unexpected crash on product 101');
        }
        return {
          storeProductId: id,
          optionId: opt,
          price: 1200,
          currency: 'INR',
          stockStatus: 'in_stock',
          stockQty: 8,
          manifestRevision: 1,
          readAt: new Date().toISOString()
        };
      }
    };

    const service = new ScrapeRunService(
      {
        priceReader: fakeReader,
        attemptStore: store,
        backoffFn: async () => {}
      },
      { maxTries: 2 }
    );

    const summary = await service.runScrape([mockProduct1, mockProduct2], 'run-6');
    expect(summary.total).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.success).toBe(1);

    const attempts = store.getAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts.find((a) => a.trackedProductId === 'tp-1')?.outcome).toBe('failed');
    expect(attempts.find((a) => a.trackedProductId === 'tp-2')?.outcome).toBe('success');
  });

  it('skips inactive products', async () => {
    const inactiveProduct: TrackedProduct = {
      ...mockProduct1,
      id: 'tp-inactive',
      active: false
    };

    const store = new InMemoryAttemptStore([inactiveProduct, mockProduct2]);
    const fakeReader: PriceReader = {
      read: async (id, opt) => ({
        storeProductId: id,
        optionId: opt,
        price: 900,
        currency: 'INR',
        stockStatus: 'in_stock',
        stockQty: 3,
        manifestRevision: 1,
        readAt: new Date().toISOString()
      })
    };

    const service = new ScrapeRunService({
      priceReader: fakeReader,
      attemptStore: store
    });

    const summary = await service.runScrape([inactiveProduct, mockProduct2], 'run-7');
    expect(summary.total).toBe(1);
    expect(summary.success).toBe(1);

    const attempts = store.getAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].trackedProductId).toBe('tp-2');
  });
});

describe('RunCoordinator Tests', () => {
  it('acquires lock, creates run and completes successfully', async () => {
    const product: TrackedProduct = {
      id: 'tp-c1',
      storeProductId: 200,
      productName: 'Coordinator Product',
      optionId: 'o1',
      optionAxis: 'Color',
      optionLabel: 'Red',
      active: true,
      createdAt: new Date().toISOString()
    };

    const store = new InMemoryAttemptStore([product]);
    const fakeReader: PriceReader = {
      read: async (id, opt) => ({
        storeProductId: id,
        optionId: opt,
        price: 350,
        currency: 'INR',
        stockStatus: 'in_stock',
        stockQty: 15,
        manifestRevision: 1,
        readAt: new Date().toISOString()
      })
    };

    const service = new ScrapeRunService({
      priceReader: fakeReader,
      attemptStore: store
    });

    const coordinator = new RunCoordinator(store, service);
    const { run, executePromise } = await coordinator.startRun('cron');
    expect(run.status).toBe('running');

    const summary = await executePromise;
    expect(summary.success).toBe(1);

    const runs = store.getRuns();
    expect(runs[0].status).toBe('completed');
    expect(runs[0].successCount).toBe(1);
  });

  it('rejects concurrent runs with conflict error', async () => {
    const store = new InMemoryAttemptStore([]);
    await store.createRun('cron'); // create active running run

    const fakeReader: PriceReader = { read: async () => ({} as PriceReading) };
    const service = new ScrapeRunService({ priceReader: fakeReader, attemptStore: store });
    const coordinator = new RunCoordinator(store, service);

    await expect(coordinator.startRun('manual')).rejects.toThrow('Scrape run');
  });

  it('recovers stale runs older than threshold and starts a new run', async () => {
    const store = new InMemoryAttemptStore([]);
    const staleRun = await store.createRun('cron');
    await store.updateRun(staleRun.id, {
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    });

    const fakeReader: PriceReader = {
      read: async (id, opt) => ({
        storeProductId: id,
        optionId: opt,
        price: 100,
        currency: 'INR',
        stockStatus: 'in_stock',
        stockQty: 1,
        manifestRevision: 1,
        readAt: new Date().toISOString()
      })
    };
    const service = new ScrapeRunService({ priceReader: fakeReader, attemptStore: store });
    const coordinator = new RunCoordinator(store, service, { staleThresholdMinutes: 20 });

    const { run } = await coordinator.startRun('cron');
    expect(run.id).not.toBe(staleRun.id);
    const runs = store.getRuns();
    const updatedStaleRun = runs.find((r) => r.id === staleRun.id);
    expect(updatedStaleRun?.status).toBe('abandoned');
  });
});
