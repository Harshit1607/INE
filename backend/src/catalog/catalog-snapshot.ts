import { SupabaseClient } from '@supabase/supabase-js';
import { CatalogClient } from './catalog-client.js';
import { StoreProduct } from '../domain/types.js';

export class CatalogSnapshotService {
  private readonly client: SupabaseClient | null;
  private readonly catalogClient: CatalogClient;
  private inMemoryCache: StoreProduct[] = [];
  private lastRefreshedAt: number = 0;

  constructor(client: SupabaseClient | null, catalogClient?: CatalogClient) {
    this.client = client;
    this.catalogClient = catalogClient || new CatalogClient();
  }

  public async isSnapshotFresh(maxAgeHours: number = 24): Promise<boolean> {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    if (!this.client) {
      return (
        this.inMemoryCache.length > 0 &&
        Date.now() - this.lastRefreshedAt < maxAgeMs
      );
    }

    try {
      const { data, error } = await this.client
        .from('catalog_products')
        .select('refreshed_at')
        .order('refreshed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return false;

      const latestRefreshTime = new Date(data.refreshed_at).getTime();
      return Date.now() - latestRefreshTime < maxAgeMs;
    } catch {
      return false;
    }
  }

  public async syncSnapshot(
    logger: (msg: string) => void = () => {}
  ): Promise<{ totalSynced: number; durationMs: number }> {
    const startTime = Date.now();
    logger('[CatalogSnapshot] Starting full catalog synchronization...');

    const products = await this.catalogClient.fetchAllListings(logger);
    logger(`[CatalogSnapshot] Fetched ${products.length} products from store API.`);

    this.inMemoryCache = [...products].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    this.lastRefreshedAt = Date.now();

    if (this.client) {
      const now = new Date().toISOString();
      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          category: p.category,
          sku: p.sku || null,
          description: p.description || null,
          refreshed_at: now
        }));

        const { error } = await this.client
          .from('catalog_products')
          .upsert(batch, { onConflict: 'id' });

        if (error) {
          logger(`[CatalogSnapshot] Warning: Batch upsert error at index ${i}: ${error.message}`);
        }
      }
      logger(`[CatalogSnapshot] Successfully synced ${products.length} products to Supabase.`);
    }

    const durationMs = Date.now() - startTime;
    return { totalSynced: products.length, durationMs };
  }

  /** One page of the catalogue, ordered by name, plus the total product count. */
  public async listProducts(
    offset: number,
    limit: number
  ): Promise<{ products: StoreProduct[]; total: number }> {
    if (this.client) {
      try {
        const { data, error, count } = await this.client
          .from('catalog_products')
          .select('id, slug, name, brand, category, sku, description', { count: 'exact' })
          .order('name', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + limit - 1);

        if (!error && data && count) {
          return { products: data as StoreProduct[], total: count };
        }
        // PostgREST answers an offset past the end with 416; that is an empty page, not a failure.
        if (error?.code === 'PGRST103') {
          const { count: total } = await this.client
            .from('catalog_products')
            .select('id', { count: 'exact', head: true });
          return { products: [], total: total ?? 0 };
        }
      } catch {
        // Fall back to the in-memory snapshot
      }
    }

    if (this.inMemoryCache.length === 0) {
      await this.syncSnapshot();
    }

    return {
      products: this.inMemoryCache.slice(offset, offset + limit),
      total: this.inMemoryCache.length
    };
  }

  public async searchProducts(
    query: string,
    limit: number = 30
  ): Promise<StoreProduct[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return [];
    }

    // Try Supabase first if available
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('catalog_products')
          .select('id, slug, name, brand, category, sku, description')
          .ilike('name', `%${trimmed}%`)
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data as StoreProduct[];
        }
      } catch {
        // Fallback to in-memory or live fetch
      }
    }

    // If in-memory cache is empty, fetch and populate
    if (this.inMemoryCache.length === 0) {
      await this.syncSnapshot();
    }

    return this.inMemoryCache
      .filter((p) => p.name.toLowerCase().includes(trimmed) || p.brand.toLowerCase().includes(trimmed))
      .slice(0, limit);
  }
}
