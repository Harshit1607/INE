import { StoreProduct, StoreProductDetail, UIManifest } from '../domain/types.js';

export interface CatalogClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/** Upper bound on listing requests per sync (~130 are needed to see all 960 products). */
const LISTING_MAX_REQUESTS = 400;
/** Stop once this many consecutive pages add nothing new (catalogue shrank or count is stale). */
const LISTING_STALL_PAGES = 40;
/** Give up after this many consecutive failed pages (each already retried internally). */
const LISTING_MAX_CONSECUTIVE_FAILURES = 8;

export class CatalogClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: CatalogClientOptions = {}) {
    this.baseUrl = (options.baseUrl || process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs || 10000;
    this.maxRetries = options.maxRetries || 3;
  }

  private async fetchWithRetry<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'INE-Price-Tracker/1.0'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
        }

        const data: unknown = await response.json();
        return data as T;
      } catch (err: unknown) {
        clearTimeout(timeout);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = 300 * Math.pow(2, attempt - 1);
          const { promise, resolve } = Promise.withResolvers<void>();
          setTimeout(resolve, delay);
          await promise;
        }
      }
    }

    throw new Error(`CatalogClient failed to fetch ${url} after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  public async fetchManifest(): Promise<UIManifest> {
    return this.fetchWithRetry<UIManifest>('/api/v2/ui/manifest');
  }

  public async fetchListings(page: number = 1, limit: number = 50): Promise<{
    page: number;
    perPage: number;
    totalPages: number;
    count: number;
    results: StoreProduct[];
  }> {
    return this.fetchWithRetry(`/api/v2/listings?page=${page}&limit=${limit}`);
  }

  /**
   * The store's listings API returns a fresh random sample for every page request (pages overlap,
   * `limit` is capped at 60), so walking pages 1..N sees only ~2/3 of the catalogue. Keep sampling
   * until the unique set reaches the advertised `count`, or until pages stop yielding new products.
   */
  public async fetchAllListings(
    logger: (msg: string) => void = () => {}
  ): Promise<StoreProduct[]> {
    const firstPage = await this.fetchListings(1, 60);
    const expected = firstPage.count;
    const totalPages = Math.max(1, firstPage.totalPages);
    const byId = new Map<number, StoreProduct>();
    for (const p of firstPage.results) byId.set(p.id, p);

    let requests = 1;
    let pagesWithoutNew = 0;
    let consecutiveFailures = 0;
    while (
      byId.size < expected &&
      requests < LISTING_MAX_REQUESTS &&
      pagesWithoutNew < LISTING_STALL_PAGES &&
      consecutiveFailures < LISTING_MAX_CONSECUTIVE_FAILURES
    ) {
      const page = (requests % totalPages) + 1;
      requests++;
      try {
        const pageData = await this.fetchListings(page, 60);
        consecutiveFailures = 0;
        const before = byId.size;
        for (const p of pageData.results) byId.set(p.id, p);
        pagesWithoutNew = byId.size > before ? 0 : pagesWithoutNew + 1;
      } catch (err: unknown) {
        consecutiveFailures++;
        logger(`[CatalogClient] Listing page ${page} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger(`[CatalogClient] Collected ${byId.size}/${expected} unique products in ${requests} page requests.`);
    return [...byId.values()];
  }

  public async fetchItem(id: number): Promise<StoreProductDetail> {
    return this.fetchWithRetry<StoreProductDetail>(`/api/v2/items/${id}`);
  }
}
