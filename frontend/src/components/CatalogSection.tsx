import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { StoreProduct, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';
import { categoryIcon } from '../categoryIcon.js';

const PAGE_SIZE = 10;

interface CatalogSectionProps {
  trackedProducts: TrackedProductOverview[];
  onTrack: (product: StoreProduct) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({ trackedProducts, onTrack }) => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number) => {
    try {
      setLoading(true);
      setError(null);
      const page = await api.listCatalog(offset, PAGE_SIZE);
      setProducts((prev) => (offset === 0 ? page.products : [...prev, ...page.products]));
      setTotal(page.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const trackedIds = new Set(trackedProducts.filter((tp) => tp.active).map((tp) => tp.storeProductId));
  const hasMore = total !== null && products.length < total;

  return (
    <section aria-labelledby="catalog-heading">
      <div>
        <h2 id="catalog-heading" className="text-xl font-bold tracking-[-0.01em] text-ink">
          Store catalogue
        </h2>
        <p className="mt-0.5 text-sm text-ink-2 tabular-nums">
          {total === null
            ? 'Products from the INE mock store. Pick one to start tracking a variant.'
            : `Showing ${products.length} of ${total} products from the INE mock store. Pick one to start tracking a variant.`}
        </p>
      </div>

      {products.length === 0 && loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-tile" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {products.map((product) => {
            const Icon = categoryIcon(product.category);
            const isTracked = trackedIds.has(product.id);
            return (
              <li key={product.id} className="flex items-center gap-3 rounded-2xl bg-tile px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{product.name}</span>
                  <span className="block truncate text-xs text-ink-3 tabular-nums">
                    {product.brand} · {product.category} · #{product.id}
                  </span>
                </span>
                {isTracked && (
                  <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                    Tracked
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onTrack(product)}
                  aria-label={`Track a variant of ${product.name}`}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Track
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Couldn&apos;t load the catalogue ({error}).
        </p>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => loadPage(products.length)}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl bg-tile px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-tile-2 disabled:cursor-wait disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Loading…' : `Show ${Math.min(PAGE_SIZE, (total ?? 0) - products.length)} more`}
          </button>
        </div>
      )}

      {error && products.length === 0 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => loadPage(0)}
            className="rounded-2xl bg-tile px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-tile-2"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
};
