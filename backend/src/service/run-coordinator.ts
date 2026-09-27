import { AttemptStore, RunSummary, ScrapeRun, TrackedProduct } from '../domain/types.js';
import { ScrapeRunService } from './scrape-run-service.js';

export interface RunCoordinatorOptions {
  staleThresholdMinutes?: number;
  logger?: (msg: string) => void;
}

export class RunCoordinator {
  private readonly attemptStore: AttemptStore;
  private readonly scrapeRunService: ScrapeRunService;
  private readonly staleThresholdMinutes: number;
  private readonly logger: (msg: string) => void;

  constructor(
    attemptStore: AttemptStore,
    scrapeRunService: ScrapeRunService,
    options: RunCoordinatorOptions = {}
  ) {
    this.attemptStore = attemptStore;
    this.scrapeRunService = scrapeRunService;
    this.staleThresholdMinutes = options.staleThresholdMinutes || 20;
    this.logger = options.logger || (() => {});
  }

  public async startRun(
    trigger: 'cron' | 'manual' | 'on_track',
    targetProduct?: TrackedProduct
  ): Promise<{ run: ScrapeRun; executePromise: Promise<RunSummary> }> {
    // 1. Mark stale runs abandoned
    const staleCount = await this.attemptStore.markStaleRunsAbandoned(this.staleThresholdMinutes);
    if (staleCount > 0) {
      this.logger(`[RunCoordinator] Recovered ${staleCount} stale run(s) and marked as abandoned.`);
    }

    // 2. Check if another run is actively running
    const activeRun = await this.attemptStore.findActiveRun();
    if (activeRun) {
      throw new Error(`Scrape run ${activeRun.id} is already in progress (started at ${activeRun.startedAt})`);
    }

    // 3. Create run record
    const run = await this.attemptStore.createRun(trigger);
    this.logger(`[RunCoordinator] Acquired lock for run ${run.id} (trigger: ${trigger})`);

    // 4. Determine target products
    let productsToScrape: TrackedProduct[];
    if (targetProduct) {
      productsToScrape = [targetProduct];
    } else {
      productsToScrape = await this.attemptStore.getActiveTrackedProducts();
    }

    // 5. Execute in background promise
    const executePromise = (async () => {
      try {
        const summary = await this.scrapeRunService.runScrape(productsToScrape, run.id);
        await this.attemptStore.updateRun(run.id, {
          status: 'completed',
          finishedAt: new Date().toISOString(),
          totalProducts: summary.total,
          successCount: summary.success,
          retriedCount: summary.retried,
          failedCount: summary.failed
        });
        this.logger(`[RunCoordinator] Completed run ${run.id}: ${summary.success} success, ${summary.retried} retried, ${summary.failed} failed`);
        return summary;
      } catch (err: unknown) {
        this.logger(`[RunCoordinator] Run ${run.id} failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`);
        await this.attemptStore.updateRun(run.id, {
          status: 'abandoned',
          finishedAt: new Date().toISOString()
        });
        throw err;
      }
    })();

    return { run, executePromise };
  }
}
