import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { OverviewPanel } from './components/OverviewPanel.js';
import { ActivityRail } from './components/ActivityRail.js';
import { TrackedProductCard } from './components/TrackedProductCard.js';
import { ProductDetailModal } from './components/ProductDetailModal.js';
import { SearchTrackModal } from './components/SearchTrackModal.js';
import { CatalogSection } from './components/CatalogSection.js';
import { RunHealth, StoreProduct, TrackedProductOverview } from './types.js';
import { api } from './api.js';
import { AlertCircle, Plus, Search } from 'lucide-react';

export const App: React.FC = () => {
  const [trackedProducts, setTrackedProducts] = useState<TrackedProductOverview[]>([]);
  const [runHealth, setRunHealth] = useState<RunHealth | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<TrackedProductOverview | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [trackTarget, setTrackTarget] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setIsRefreshing(true);

      // 1. Health check to detect cold start waking
      const healthPromise = api.getHealth();
      const runHealthPromise = api.getRunHealth();
      const productsPromise = api.getTrackedProducts();

      // If initial, monitor if it takes > 2.5s to show waking notice
      let wakeTimeout: number | undefined;
      if (isInitial) {
        wakeTimeout = window.setTimeout(() => {
          setIsWaking(true);
        }, 2500);
      }

      const [, healthData, productsData] = await Promise.all([
        healthPromise,
        runHealthPromise,
        productsPromise
      ]);

      window.clearTimeout(wakeTimeout);
      setIsWaking(false);
      setBackendOnline(true);
      setRunHealth(healthData);
      setTrackedProducts(productsData);
      setError(null);
    } catch (err: unknown) {
      setBackendOnline(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    // Periodic background refresh every 45s
    const interval = setInterval(() => {
      fetchData(false);
    }, 45000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const [runNowPending, setRunNowPending] = useState(false);
  const [runNowError, setRunNowError] = useState<string | null>(null);
  const runInProgress = runHealth?.latestRun?.status === 'running';

  // While a run is active, refresh every 5s so readings land as each variant finishes.
  useEffect(() => {
    if (!runInProgress) return;
    const interval = setInterval(() => fetchData(false), 5000);
    return () => clearInterval(interval);
  }, [runInProgress, fetchData]);

  const handleRunNow = async () => {
    setRunNowPending(true);
    setRunNowError(null);
    try {
      await api.startManualRun();
      await fetchData(false);
    } catch (err: unknown) {
      setRunNowError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunNowPending(false);
    }
  };

  const activeProducts = trackedProducts.filter((p) => p.active);
  const totalAttempts = trackedProducts.reduce((sum, p) => sum + p.totalAttempts, 0);
  const avgSuccessRate =
    trackedProducts.length > 0
      ? Math.round(trackedProducts.reduce((sum, p) => sum + p.successRate, 0) / trackedProducts.length)
      : null;
  const orderedProducts = [...trackedProducts].sort((a, b) => Number(b.active) - Number(a.active));
  const offline = Boolean(error) && !runHealth && trackedProducts.length === 0;

  return (
    <div className="min-h-screen bg-canvas lg:p-6">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col gap-5 bg-frame p-3 sm:p-5 lg:min-h-[calc(100vh-3rem)] lg:flex-row lg:gap-6 lg:rounded-[32px] lg:p-6 lg:shadow-frame">
        <Sidebar
          onOpenSearch={() => setIsSearchOpen(true)}
          onRefresh={() => fetchData(false)}
          isRefreshing={isRefreshing}
          backendOnline={backendOnline}
          isWaking={isWaking}
        />

        <main className="grid min-w-0 flex-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <header className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-[clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-tight tracking-[-0.025em] text-ink">
                  INE Price Tracker
                </h1>
                <p className="mt-1 text-sm font-medium text-ink-2">
                  Price and stock for {activeProducts.length} tracked{' '}
                  {activeProducts.length === 1 ? 'variant' : 'variants'} on the INE mock store, read every 2 hours.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="group flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border-2 border-neutral-300 bg-white pl-4 pr-1.5 text-left text-sm font-medium text-ink-2 transition-colors hover:border-ink md:w-80 md:flex-none"
                >
                  <Search className="h-[18px] w-[18px] shrink-0 text-ink" strokeWidth={2.4} />
                  <span className="min-w-0 flex-1 truncate">Search the catalogue to track…</span>
                  <span className="flex h-8 shrink-0 items-center gap-1 rounded-xl bg-ink px-3 text-xs font-semibold text-white transition-colors group-hover:bg-neutral-800">
                    <Plus className="h-3.5 w-3.5" />
                    Track
                  </span>
                </button>
                <span
                  className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-tile px-3.5 lg:hidden text-sm font-semibold text-ink-2"
                  role="status"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isWaking ? 'animate-pulse bg-warn-dot' : backendOnline ? 'bg-ok-dot' : 'bg-bad-dot'
                    }`}
                  />
                  {isWaking ? 'Waking' : backendOnline ? 'Online' : loading ? 'Connecting' : 'Offline'}
                </span>
              </div>
            </header>

            {error && !offline && (
              <p className="flex items-center gap-2 rounded-2xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Couldn&apos;t refresh ({error}). Showing the last loaded data.
              </p>
            )}

            {offline ? (
              <div className="rounded-panel bg-tile px-6 py-14 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bad-50 text-bad">
                  <AlertCircle className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-xl font-bold text-ink">The backend isn&apos;t answering</h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-2">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchData(true)}
                  className="mt-6 rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <OverviewPanel
                  runHealth={runHealth}
                  isWaking={isWaking}
                  activeCount={activeProducts.length}
                  totalCount={trackedProducts.length}
                  successRate={avgSuccessRate}
                  attemptCount={totalAttempts}
                  onRunNow={handleRunNow}
                  runNowPending={runNowPending}
                  runNowError={runNowError}
                />

                <section aria-labelledby="tracked-heading">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 id="tracked-heading" className="text-xl font-bold tracking-[-0.01em] text-ink">
                        Tracked variants
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-2">Open a variant for its price chart and full scrape log.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(true)}
                      className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Track a variant</span>
                    </button>
                  </div>

                  {loading ? (
                    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-5 gap-y-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="mt-7 h-72 animate-pulse rounded-panel bg-tile" />
                      ))}
                    </div>
                  ) : trackedProducts.length === 0 ? (
                    <div className="mt-5 rounded-panel border-2 border-dashed border-neutral-300 px-6 py-14 text-center">
                      <h3 className="text-lg font-bold text-ink">Nothing tracked yet</h3>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
                        Search the mock store catalogue and pick a variant. Its first reading starts right away.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsSearchOpen(true)}
                        className="mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                      >
                        <Plus className="h-4 w-4" /> Track your first variant
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-5 gap-y-6">
                      {orderedProducts.map((product) => (
                        <TrackedProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
                      ))}
                    </div>
                  )}
                </section>

                <CatalogSection
                  trackedProducts={trackedProducts}
                  onTrack={(product) => {
                    setTrackTarget(product);
                    setIsSearchOpen(true);
                  }}
                />
              </>
            )}

          </div>

          <ActivityRail products={trackedProducts} loading={loading} onSelect={setSelectedProduct} />

          <footer className="pb-1 text-xs text-ink-3 xl:col-span-2">
            React on Vercel · Express + Playwright on Render · Supabase
          </footer>
        </main>
      </div>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onProductUpdated={() => fetchData(false)}
        />
      )}

      {isSearchOpen && (
        <SearchTrackModal
          existingTracked={trackedProducts}
          initialProduct={trackTarget}
          onClose={() => {
            setIsSearchOpen(false);
            setTrackTarget(null);
          }}
          onTrackedSuccess={() => fetchData(false)}
        />
      )}
    </div>
  );
};

export default App;
