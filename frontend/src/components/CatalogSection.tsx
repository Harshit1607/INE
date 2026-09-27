import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { StoreProduct, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';
import { categoryIcon } from '../categoryIcon.js';
import { panel, panelHeader, panelTitle } from '../ui.js';

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
    <section aria-labelledby="catalog-heading" className={panel}>
      <div className={panelHeader}>
        <div>
          <h2 id="catalog-heading" className={panelTitle}>
            Store catalogue
          </h2>
          <p className="text-xs font-medium text-ink-3 tabular-nums">
            {total === null
              ? 'Products from the INE mock store'
              : `Showing ${products.length} of ${total} products from the INE mock store`}
          </p>
        </div>
      </div>

      {products.length === 0 && loading ? (
        <div className="space-y-2 p-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-tile" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-tile">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3">Product</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3">Brand</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-ink-3">Category</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-ink-3">Store ID</th>
                <th className="px-4 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="tnum divide-y divide-neutral-200">
              {products.map((product) => {
                const Icon = categoryIcon(product.category);
                const isTracked = trackedIds.has(product.id);
                return (
                  <tr key={product.id} className="transition-colors hover:bg-tile">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-ink">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="max-w-[260px] truncate font-semibold text-ink">{product.name}</span>
                        {isTracked && (
                          <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                            Tracked
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{product.brand}</td>
                    <td className="px-4 py-2.5 text-ink-2">{product.category}</td>
                    <td className="px-4 py-2.5 text-right text-ink-2">#{product.id}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onTrack(product)}
                        aria-label={`Track a variant of ${product.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Track
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="m-4 flex items-center gap-2 rounded-xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Couldn&apos;t load the catalogue ({error}).
        </p>
      )}

      {(hasMore || (error && products.length === 0)) && (
        <div className="flex justify-center border-t border-neutral-200 px-4 py-3">
          {hasMore ? (
            <button
              type="button"
              onClick={() => loadPage(products.length)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-tile disabled:cursor-wait disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Loading…' : `Show ${Math.min(PAGE_SIZE, (total ?? 0) - products.length)} more`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => loadPage(0)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-tile"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
};
