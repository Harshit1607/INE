import { StoreProduct, StoreProductDetail, UIManifest } from '../domain/types.js';

export interface CatalogClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

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

  public async fetchAllListings(): Promise<StoreProduct[]> {
    const firstPage = await this.fetchListings(1, 100);
    const allResults = [...firstPage.results];
    const totalPages = firstPage.totalPages;

    for (let page = 2; page <= totalPages; page++) {
      const pageData = await this.fetchListings(page, 100);
      allResults.push(...pageData.results);
    }

    return allResults;
  }

  public async fetchItem(id: number): Promise<StoreProductDetail> {
    return this.fetchWithRetry<StoreProductDetail>(`/api/v2/items/${id}`);
  }
}
