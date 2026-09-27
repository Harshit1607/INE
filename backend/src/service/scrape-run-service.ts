import {
  AttemptStore,
  ErrorCode,
  Outcome,
  PriceReader,
  PriceReading,
  RetryPolicy,
  RunSummary,
  ScrapeAttempt,
  ScrapeError,
  TrackedProduct
} from '../domain/types.js';

export interface ScrapeRunDependencies {
  priceReader: PriceReader;
  attemptStore: AttemptStore;
  clock?: () => number;
  backoffFn?: (delayMs: number) => Promise<void>;
  logger?: (msg: string) => void;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxTries: 3,
  tryTimeoutMs: 45000,
  initialBackoffMs: 1000,
  maxBackoffMs: 8000,
  jitterRatio: 0.2
};

export class ScrapeRunService {
  private readonly deps: ScrapeRunDependencies;
  private readonly policy: RetryPolicy;

  constructor(deps: ScrapeRunDependencies, policy: Partial<RetryPolicy> = {}) {
    this.deps = deps;
    this.policy = { ...DEFAULT_RETRY_POLICY, ...policy };
  }

  private getTime(): number {
    return this.deps.clock ? this.deps.clock() : Date.now();
  }

  private async sleep(ms: number): Promise<void> {
    if (this.deps.backoffFn) {
      return this.deps.backoffFn(ms);
    }
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  }

  private calculateBackoff(attemptNumber: number): number {
    const base = Math.min(
      this.policy.maxBackoffMs,
      this.policy.initialBackoffMs * Math.pow(2, attemptNumber - 1)
    );
    const jitter = (Math.random() * 2 - 1) * this.policy.jitterRatio * base;
    return Math.max(100, Math.round(base + jitter));
  }

  public async runScrape(
    trackedProducts: TrackedProduct[],
    runId?: string
  ): Promise<RunSummary> {
    const log = this.deps.logger || (() => {});
    const recordedAttempts: ScrapeAttempt[] = [];
    let successCount = 0;
    let retriedCount = 0;
    let failedCount = 0;

    log(`[ScrapeRunService] Starting scrape run for ${trackedProducts.length} tracked products (runId: ${runId || 'none'})`);

    for (const product of trackedProducts) {
      if (!product.active) {
        log(`[ScrapeRunService] Skipping inactive product: ${product.productName} (${product.id})`);
        continue;
      }

      log(`[ScrapeRunService] Scraping Product: ${product.productName} (ID: ${product.storeProductId}, Option: ${product.optionLabel} / ${product.optionId})`);

      const productStartTime = this.getTime();
      const productStartDate = new Date(productStartTime).toISOString();
      let lastErrorCode: ErrorCode = 'unknown';
      let lastErrorMessage = '';
      const tryReasons: string[] = [];
      let successfulReading: PriceReading | null = null;
      let triesExecuted = 0;

      for (let attempt = 1; attempt <= this.policy.maxTries; attempt++) {
        triesExecuted = attempt;
        log(`[ScrapeRunService] -> Try ${attempt}/${this.policy.maxTries} for ${product.productName}...`);

        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
          // Execute reader with try timeout
          const readingPromise = this.deps.priceReader.read(
            product.storeProductId,
            product.optionId
          );

          const { promise: timeoutPromise, resolve: resolveTimeout } = Promise.withResolvers<never>();
          timeoutHandle = setTimeout(() => {
            resolveTimeout(new ScrapeError('timeout', `Try timed out after ${this.policy.tryTimeoutMs}ms`, true) as never);
          }, this.policy.tryTimeoutMs);

          const readingResult = await Promise.race([
            readingPromise,
            timeoutPromise.then((err: unknown) => {
              throw err;
            })
          ]);

          successfulReading = readingResult;
          log(`[ScrapeRunService] -> Try ${attempt} SUCCEEDED. Price: ${readingResult.price} ${readingResult.currency}`);
          break; // Exit retry loop on success
        } catch (err: unknown) {
          let code: ErrorCode = 'unknown';
          let message = '';
          let retryable = true;

          if (err instanceof ScrapeError) {
            code = err.code;
            message = err.message;
            retryable = err.retryable;
          } else if (err instanceof Error) {
            message = err.message;
            if (message.includes('timeout') || message.includes('Timeout')) {
              code = 'timeout';
            } else {
              code = 'unknown';
            }
          } else {
            message = String(err);
          }

          lastErrorCode = code;
          lastErrorMessage = message;
          tryReasons.push(`Try ${attempt}: [${code}] ${message}`);

          log(`[ScrapeRunService] -> Try ${attempt} FAILED: [${code}] ${message} (retryable=${retryable})`);

          // Non-retryable error stops further tries for this product
          if (!retryable) {
            log(`[ScrapeRunService] Non-retryable error encountered, aborting retries for this product.`);
            break;
          }

          if (attempt < this.policy.maxTries) {
            const backoffMs = this.calculateBackoff(attempt);
            log(`[ScrapeRunService] Backing off for ${backoffMs}ms before try ${attempt + 1}...`);
            await this.sleep(backoffMs);
          }
        } finally {
          clearTimeout(timeoutHandle);
        }
      }

      const productEndTime = this.getTime();
      const productEndDate = new Date(productEndTime).toISOString();
      const durationMs = Math.max(0, productEndTime - productStartTime);

      let outcome: Outcome;
      if (successfulReading) {
        outcome = triesExecuted === 1 ? 'success' : 'retried';
        if (outcome === 'success') successCount++;
        else retriedCount++;
      } else {
        outcome = 'failed';
        failedCount++;
      }

      const readingForAttempt = successfulReading as PriceReading | null;
      const attemptToRecord: Omit<ScrapeAttempt, 'id'> = {
        runId,
        trackedProductId: product.id,
        startedAt: productStartDate,
        finishedAt: productEndDate,
        outcome,
        triesCount: triesExecuted,
        price: readingForAttempt ? readingForAttempt.price : null,
        currency: readingForAttempt ? readingForAttempt.currency : null,
        stockStatus: readingForAttempt ? readingForAttempt.stockStatus : null,
        stockQty: readingForAttempt ? readingForAttempt.stockQty : null,
        errorCode: outcome === 'failed' ? lastErrorCode : null,
        errorDetail: outcome === 'failed' ? (tryReasons.join('; ') || lastErrorMessage) : null,
        durationMs,
        manifestRevision: readingForAttempt ? readingForAttempt.manifestRevision : null
      };

      try {
        const recorded = await this.deps.attemptStore.recordAttempt(attemptToRecord);
        recordedAttempts.push(recorded);
        log(`[ScrapeRunService] Recorded attempt for ${product.productName}: Outcome=${outcome}, Duration=${durationMs}ms`);
      } catch (err: unknown) {
        log(`[ScrapeRunService] CRITICAL: Failed to persist attempt for ${product.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      runId: runId || 'none',
      total: recordedAttempts.length,
      success: successCount,
      retried: retriedCount,
      failed: failedCount,
      attempts: recordedAttempts
    };
  }
}
