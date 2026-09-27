import { AttemptStore, ScrapeAttempt, ScrapeRun, TrackedProduct } from '../domain/types.js';

export class InMemoryAttemptStore implements AttemptStore {
  private trackedProducts: TrackedProduct[] = [];
  private runs: ScrapeRun[] = [];
  private attempts: ScrapeAttempt[] = [];

  constructor(initialTrackedProducts: TrackedProduct[] = []) {
    this.trackedProducts = [...initialTrackedProducts];
  }

  public async getActiveTrackedProducts(): Promise<TrackedProduct[]> {
    return this.trackedProducts.filter((p) => p.active);
  }

  public async getTrackedProductById(id: string): Promise<TrackedProduct | null> {
    return this.trackedProducts.find((p) => p.id === id) || null;
  }

  public async createRun(trigger: 'cron' | 'manual' | 'on_track'): Promise<ScrapeRun> {
    const run: ScrapeRun = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trigger,
      status: 'running',
      startedAt: new Date().toISOString(),
      totalProducts: 0,
      successCount: 0,
      retriedCount: 0,
      failedCount: 0
    };
    this.runs.push(run);
    return { ...run };
  }

  public async updateRun(runId: string, updates: Partial<ScrapeRun>): Promise<void> {
    const run = this.runs.find((r) => r.id === runId);
    if (run) {
      Object.assign(run, updates);
    }
  }

  public async findActiveRun(): Promise<ScrapeRun | null> {
    return this.runs.find((r) => r.status === 'running') || null;
  }

  public async markStaleRunsAbandoned(staleThresholdMinutes: number): Promise<number> {
    const cutoff = Date.now() - staleThresholdMinutes * 60 * 1000;
    let count = 0;
    for (const run of this.runs) {
      if (run.status === 'running' && new Date(run.startedAt).getTime() < cutoff) {
        run.status = 'abandoned';
        run.finishedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  public async recordAttempt(attempt: Omit<ScrapeAttempt, 'id'>): Promise<ScrapeAttempt> {
    const fullAttempt: ScrapeAttempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...attempt
    };
    this.attempts.push(fullAttempt);
    return { ...fullAttempt };
  }

  public getAttempts(): ScrapeAttempt[] {
    return [...this.attempts];
  }

  public getRuns(): ScrapeRun[] {
    return [...this.runs];
  }

  public addTrackedProduct(product: TrackedProduct): void {
    this.trackedProducts.push(product);
  }
}
