export type Outcome = 'success' | 'retried' | 'failed';

export interface LatestReading {
  outcome: Outcome;
  price: number | null;
  currency: string | null;
  stockStatus: string | null;
  stockQty: number | null;
  finishedAt: string;
  errorCode: string | null;
  manifestRevision: number | null;
}

export interface TrackedProductOverview {
  id: string;
  storeProductId: number;
  slug?: string;
  productName: string;
  brand?: string;
  category?: string;
  optionId: string;
  optionAxis: string;
  optionLabel: string;
  active: boolean;
  createdAt: string;
  totalAttempts: number;
  successRate: number;
  lastSuccessfulScrape: string | null;
  latestReading: LatestReading | null;
}

export interface ScrapeAttempt {
  id: string;
  runId?: string;
  trackedProductId: string;
  startedAt: string;
  finishedAt: string;
  outcome: Outcome;
  triesCount: number;
  price: number | null;
  currency: string | null;
  stockStatus: string | null;
  stockQty: number | null;
  errorCode: string | null;
  errorDetail: string | null;
  durationMs: number;
  manifestRevision: number | null;
}

export interface ProductOption {
  id: string;
  label: string;
}

export interface StoreProduct {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  sku?: string;
  description?: string;
}

export interface StoreProductDetail extends StoreProduct {
  specs: Record<string, unknown>;
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verifiedPurchase: boolean;
    helpfulVotes: number;
  }>;
  optionAxis: string;
  options: ProductOption[];
}

export interface RunHealth {
  latestRun: {
    id: string;
    trigger: 'cron' | 'manual' | 'on_track';
    status: 'running' | 'completed' | 'abandoned';
    startedAt: string;
    finishedAt?: string;
    totalProducts: number;
    successCount: number;
    retriedCount: number;
    failedCount: number;
  } | null;
  /** Start of the latest cron run; the countdown and overdue flag are based on this. */
  lastScheduledRunAt: string | null;
  isOverdue: boolean;
  /** Minutes since the latest cron run (manual and on-track runs do not reset it). */
  timeSinceLastRunMinutes: number | null;
  checkedAt: string;
}
