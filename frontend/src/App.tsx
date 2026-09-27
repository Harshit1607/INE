import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { KpiStrip } from './components/KpiStrip.js';
import { ScheduleCard } from './components/ScheduleCard.js';
import { SuccessChart } from './components/SuccessChart.js';
import { TrackedGrid } from './components/TrackedGrid.js';
import { ActivityRail } from './components/ActivityRail.js';
import { ProductDetailModal } from './components/ProductDetailModal.js';
import { SearchTrackModal } from './components/SearchTrackModal.js';
import { CatalogSection } from './components/CatalogSection.js';
import { RunHealth, StoreProduct, TrackedProductOverview } from './types.js';
import { api } from './api.js';
import { primaryButton } from './ui.js';
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
  const offline = Boolean(error) && !runHealth && trackedProducts.length === 0;

  return (
    <div className="min-h-screen bg-frame">
      <div className="flex min-h-screen w-full flex-col gap-5 p-3 sm:p-5 lg:flex-row lg:gap-6 lg:p-6">
        <Sidebar
          onOpenSearch={() => setIsSearchOpen(true)}
          onRefresh={() => fetchData(false)}
          isRefreshing={isRefreshing}
        />

        <main className="grid min-w-0 flex-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <header className="flex flex-col gap-3 border-b border-neutral-200 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold leading-tight tracking-[-0.02em] text-ink">Dashboard</h1>
                <p className="mt-0.5 text-sm font-medium text-ink-3">
                  INE Price Tracker · price and stock from the INE mock store, read every 2 hours
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="group flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-neutral-300 bg-white pl-3.5 pr-1.5 text-left text-sm font-medium text-ink-2 transition-colors hover:border-ink md:w-80 md:flex-none"
                >
                  <Search className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.4} />
                  <span className="min-w-0 flex-1 truncate">Search the catalogue to track…</span>
                  <span className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-ink px-2.5 text-xs font-semibold text-white transition-colors group-hover:bg-neutral-800">
                    <Plus className="h-3.5 w-3.5" />
                    Track
                  </span>
                </button>
                <span
                  className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-neutral-200 px-3.5 text-sm font-semibold text-ink-2 lg:hidden"
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
              <p className="flex items-center gap-2 rounded-xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Couldn&apos;t refresh ({error}). Showing the last loaded data.
              </p>
            )}

            {offline ? (
              <div className="rounded-2xl border border-neutral-200 px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-bad-50 text-bad">
                  <AlertCircle className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-lg font-bold text-ink">The backend isn&apos;t answering</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{error}</p>
                <button type="button" onClick={() => fetchData(true)} className={`${primaryButton} mt-5`}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                <KpiStrip
                  runHealth={runHealth}
                  activeCount={activeProducts.length}
                  totalCount={trackedProducts.length}
                  successRate={avgSuccessRate}
                  attemptCount={totalAttempts}
                  loading={loading}
                />

                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <SuccessChart products={trackedProducts} loading={loading} />
                  <ScheduleCard
                    runHealth={runHealth}
                    isWaking={isWaking}
                    onRunNow={handleRunNow}
                    runNowPending={runNowPending}
                    runNowError={runNowError}
                  />
                </div>

                <TrackedGrid
                  products={trackedProducts}
                  loading={loading}
                  onSelect={setSelectedProduct}
                  onTrack={() => setIsSearchOpen(true)}
                />

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
