export type Outcome = 'success' | 'retried' | 'failed';

export type ErrorCode =
  | 'timeout'
  | 'stale_price'
  | 'http_429'
  | 'http_5xx'
  | 'auth_rejected'
  | 'navigation_failed'
  | 'option_mismatch'
  | 'invalid_price'
  | 'invalid_stock'
  | 'structure_changed'
  | 'unknown';

export class ScrapeError extends Error {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly detail?: string;

  constructor(code: ErrorCode, message: string, retryable: boolean = true, detail?: string) {
    super(message);
    this.name = 'ScrapeError';
    this.code = code;
    this.retryable = retryable;
    this.detail = detail;
  }
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

export interface ProductOption {
  id: string;
  label: string;
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

export interface UIManifest {
  revision: number;
  variant: number;
  validUntil: number;
  classes: {
    priceWrap?: string;
    priceValue?: string;
    mrp?: string;
    sale?: string;
    badge?: string;
    rating?: string;
    seller?: string;
    delivery?: string;
    stock?: string;
    [key: string]: string | undefined;
  };
  order?: string[];
  priceTag?: string;
  priceCarrier?: string;
  ratingAria?: boolean;
  sellerTitle?: boolean;
}

export interface TrackedProduct {
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
}

export interface PriceReading {
  storeProductId: number;
  optionId: string;
  optionLabel?: string;
  price: number;
  currency: string;
  stockStatus: string;
  stockQty: number | null;
  manifestRevision: number;
  readAt: string;
}

export interface ScrapeRun {
  id: string;
  trigger: 'cron' | 'manual' | 'on_track';
  status: 'running' | 'completed' | 'abandoned';
  startedAt: string;
  finishedAt?: string;
  totalProducts: number;
  successCount: number;
  retriedCount: number;
  failedCount: number;
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
  errorCode: ErrorCode | null;
  errorDetail: string | null;
  durationMs: number;
  manifestRevision: number | null;
}

export interface PriceReader {
  read(storeProductId: number, optionId: string): Promise<PriceReading>;
  close?(): Promise<void>;
}

export interface RetryPolicy {
  maxTries: number;
  tryTimeoutMs: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
}

export interface AttemptStore {
  getActiveTrackedProducts(): Promise<TrackedProduct[]>;
  getTrackedProductById(id: string): Promise<TrackedProduct | null>;
  createRun(trigger: 'cron' | 'manual' | 'on_track'): Promise<ScrapeRun>;
  updateRun(runId: string, updates: Partial<ScrapeRun>): Promise<void>;
  findActiveRun(): Promise<ScrapeRun | null>;
  markStaleRunsAbandoned(staleThresholdMinutes: number): Promise<number>;
  recordAttempt(attempt: Omit<ScrapeAttempt, 'id'>): Promise<ScrapeAttempt>;
}

export interface RunSummary {
  runId: string;
  total: number;
  success: number;
  retried: number;
  failed: number;
  attempts: ScrapeAttempt[];
}
