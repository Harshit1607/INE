import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AttemptStore, ErrorCode, Outcome, ScrapeAttempt, ScrapeRun, TrackedProduct } from '../domain/types.js';

export interface SupabaseAttemptStoreOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  client?: SupabaseClient;
}

export class SupabaseAttemptStore implements AttemptStore {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseAttemptStoreOptions = {}) {
    if (options.client) {
      this.client = options.client;
    } else {
      const url = options.supabaseUrl || process.env.SUPABASE_URL;
      const key = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('SupabaseAttemptStore requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      }
      this.client = createClient(url, key, {
        auth: { persistSession: false }
      });
    }
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public async getActiveTrackedProducts(): Promise<TrackedProduct[]> {
    const { data, error } = await this.client
      .from('tracked_products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active tracked products: ${error.message}`);
    }

    return (data || []).map((p) => this.mapDbTrackedProduct(p));
  }

  public async getAllTrackedProducts(): Promise<TrackedProduct[]> {
    const { data, error } = await this.client
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch all tracked products: ${error.message}`);
    }

    return (data || []).map((p) => this.mapDbTrackedProduct(p));
  }

  public async getTrackedProductById(id: string): Promise<TrackedProduct | null> {
    const { data, error } = await this.client
      .from('tracked_products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch tracked product ${id}: ${error.message}`);
    }

    return data ? this.mapDbTrackedProduct(data) : null;
  }

  public async createRun(trigger: 'cron' | 'manual' | 'on_track'): Promise<ScrapeRun> {
    const { data, error } = await this.client
      .from('scrape_runs')
      .insert({
        trigger,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create scrape run: ${error.message}`);
    }

    return this.mapDbRun(data);
  }

  public async updateRun(runId: string, updates: Partial<ScrapeRun>): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.finishedAt !== undefined) dbUpdates.finished_at = updates.finishedAt;
    if (updates.totalProducts !== undefined) dbUpdates.total_products = updates.totalProducts;
    if (updates.successCount !== undefined) dbUpdates.success_count = updates.successCount;
    if (updates.retriedCount !== undefined) dbUpdates.retried_count = updates.retriedCount;
    if (updates.failedCount !== undefined) dbUpdates.failed_count = updates.failedCount;

    const { error } = await this.client
      .from('scrape_runs')
      .update(dbUpdates)
      .eq('id', runId);

    if (error) {
      throw new Error(`Failed to update scrape run ${runId}: ${error.message}`);
    }
  }

  public async findActiveRun(): Promise<ScrapeRun | null> {
    const { data, error } = await this.client
      .from('scrape_runs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check for active scrape run: ${error.message}`);
    }

    return data ? this.mapDbRun(data) : null;
  }

  public async markStaleRunsAbandoned(staleThresholdMinutes: number = 20): Promise<number> {
    const cutoff = new Date(Date.now() - staleThresholdMinutes * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .from('scrape_runs')
      .update({
        status: 'abandoned',
        finished_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', cutoff)
      .select('id');

    if (error) {
      throw new Error(`Failed to mark stale runs abandoned: ${error.message}`);
    }

    return data?.length || 0;
  }

  public async recordAttempt(attempt: Omit<ScrapeAttempt, 'id'>): Promise<ScrapeAttempt> {
    // Enforce honesty in application layer before database check constraint
    const isSuccessOrRetried = attempt.outcome === 'success' || attempt.outcome === 'retried';
    const finalPrice = isSuccessOrRetried ? attempt.price : null;
    const finalStockStatus = isSuccessOrRetried ? attempt.stockStatus : null;
    const finalStockQty = isSuccessOrRetried ? attempt.stockQty : null;

    const { data, error } = await this.client
      .from('scrape_attempts')
      .insert({
        run_id: attempt.runId || null,
        tracked_product_id: attempt.trackedProductId,
        started_at: attempt.startedAt,
        finished_at: attempt.finishedAt,
        outcome: attempt.outcome,
        tries_count: attempt.triesCount,
        price: finalPrice,
        currency: attempt.currency,
        stock_status: finalStockStatus,
        stock_qty: finalStockQty,
        error_code: attempt.errorCode,
        error_detail: attempt.errorDetail,
        duration_ms: attempt.durationMs,
        manifest_revision: attempt.manifestRevision
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record scrape attempt: ${error.message}`);
    }

    return this.mapDbAttempt(data);
  }

  public async getProductAttempts(trackedProductId: string): Promise<ScrapeAttempt[]> {
    const { data, error } = await this.client
      .from('scrape_attempts')
      .select('*')
      .eq('tracked_product_id', trackedProductId)
      .order('finished_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch attempts for tracked product ${trackedProductId}: ${error.message}`);
    }

    return (data || []).map((a) => this.mapDbAttempt(a));
  }

  public async getLatestRun(trigger?: ScrapeRun['trigger']): Promise<ScrapeRun | null> {
    let query = this.client.from('scrape_runs').select('*');
    if (trigger) query = query.eq('trigger', trigger);
    const { data, error } = await query
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch latest scrape run: ${error.message}`);
    }

    return data ? this.mapDbRun(data) : null;
  }

  public async getAllAttemptsForExport(): Promise<Array<{
    storeProductId: number;
    productName: string;
    optionLabel: string;
    timestamp: string;
    price: number | null;
    stock: string | null;
    outcome: Outcome;
  }>> {
    const { data, error } = await this.client
      .from('scrape_attempts')
      .select(`
        id,
        finished_at,
        outcome,
        price,
        stock_status,
        stock_qty,
        tracked_products (
          store_product_id,
          product_name,
          option_label
        )
      `)
      .order('finished_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch attempts for export: ${error.message}`);
    }

    return (data || []).map((row: unknown) => {
      const r = row as {
        finished_at: string;
        outcome: Outcome;
        price: number | null;
        stock_status: string | null;
        stock_qty: number | null;
        tracked_products: {
          store_product_id: number;
          product_name: string;
          option_label: string;
        } | null;
      };

      const stockFormatted = r.stock_qty !== null
        ? `${r.stock_status} (${r.stock_qty})`
        : r.stock_status;

      return {
        storeProductId: r.tracked_products?.store_product_id || 0,
        productName: r.tracked_products?.product_name || '',
        optionLabel: r.tracked_products?.option_label || '',
        timestamp: new Date(r.finished_at).toISOString(),
        price: r.outcome === 'failed' ? null : r.price,
        stock: r.outcome === 'failed' ? null : stockFormatted,
        outcome: r.outcome
      };
    });
  }

  private mapDbTrackedProduct(raw: unknown): TrackedProduct {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      storeProductId: Number(r.store_product_id),
      slug: r.slug ? String(r.slug) : undefined,
      productName: String(r.product_name),
      brand: r.brand ? String(r.brand) : undefined,
      category: r.category ? String(r.category) : undefined,
      optionId: String(r.option_id),
      optionAxis: String(r.option_axis),
      optionLabel: String(r.option_label),
      active: Boolean(r.active),
      createdAt: String(r.created_at)
    };
  }

  private mapDbRun(raw: unknown): ScrapeRun {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      trigger: r.trigger as 'cron' | 'manual' | 'on_track',
      status: r.status as 'running' | 'completed' | 'abandoned',
      startedAt: String(r.started_at),
      finishedAt: r.finished_at ? String(r.finished_at) : undefined,
      totalProducts: Number(r.total_products || 0),
      successCount: Number(r.success_count || 0),
      retriedCount: Number(r.retried_count || 0),
      failedCount: Number(r.failed_count || 0)
    };
  }

  private mapDbAttempt(raw: unknown): ScrapeAttempt {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      runId: r.run_id ? String(r.run_id) : undefined,
      trackedProductId: String(r.tracked_product_id),
      startedAt: String(r.started_at),
      finishedAt: String(r.finished_at),
      outcome: r.outcome as Outcome,
      triesCount: Number(r.tries_count || 1),
      price: r.price !== null && r.price !== undefined ? Number(r.price) : null,
      currency: r.currency ? String(r.currency) : null,
      stockStatus: r.stock_status ? String(r.stock_status) : null,
      stockQty: r.stock_qty !== null && r.stock_qty !== undefined ? Number(r.stock_qty) : null,
      errorCode: (r.error_code as ErrorCode) || null,
      errorDetail: r.error_detail ? String(r.error_detail) : null,
      durationMs: Number(r.duration_ms || 0),
      manifestRevision: r.manifest_revision ? Number(r.manifest_revision) : null
    };
  }
}
