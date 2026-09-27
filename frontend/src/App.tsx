import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { RunHealthBanner } from './components/RunHealthBanner.js';
import { TrackedProductCard } from './components/TrackedProductCard.js';
import { ProductDetailModal } from './components/ProductDetailModal.js';
import { SearchTrackModal } from './components/SearchTrackModal.js';
import { RunHealth, TrackedProductOverview } from './types.js';
import { api } from './api.js';
import { Activity, AlertCircle, Database, Package, Plus, ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [trackedProducts, setTrackedProducts] = useState<TrackedProductOverview[]>([]);
  const [runHealth, setRunHealth] = useState<RunHealth | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<TrackedProductOverview | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  // Summary Metrics
  const activeProducts = trackedProducts.filter((p) => p.active);
  const totalScrapesAllTime = trackedProducts.reduce((sum, p) => sum + p.totalAttempts, 0);
  const avgSuccessRate =
    trackedProducts.length > 0
      ? Math.round(
          trackedProducts.reduce((sum, p) => sum + p.successRate, 0) / trackedProducts.length
        )
      : 100;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Navbar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onRefresh={() => fetchData(false)}
        isRefreshing={isRefreshing}
        backendOnline={backendOnline}
        isWaking={isWaking}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Run Health & Schedule Banner */}
        <RunHealthBanner runHealth={runHealth} isWaking={isWaking} />

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>Tracked Products</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {activeProducts.length}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({trackedProducts.length} total)
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Overall Success Rate</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              {avgSuccessRate}%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
              <Activity className="w-4 h-4 text-violet-400" />
              <span>Total Scrape Attempts</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {totalScrapesAllTime}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
              <Database className="w-4 h-4 text-amber-400" />
              <span>Scrape Schedule</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              2 Hours
              <span className="text-xs font-normal text-slate-400 ml-1.5">cron-job.org</span>
            </div>
          </div>
        </div>

        {/* Tracked Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Active Tracked Variants</h2>
              <p className="text-xs text-slate-400">
                Click any product to inspect price trends, stock history, and the honest Scrape Log.
              </p>
            </div>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 hover:bg-indigo-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Variant</span>
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-56 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="text-base font-semibold text-slate-200">Unable to load dashboard data</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => fetchData(true)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                Retry Connection
              </button>
            </div>
          ) : trackedProducts.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-4">
              <Package className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <h3 className="text-base font-semibold text-white">No products tracked yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Search the mock store catalogue and pick product variants to start tracking their price and stock over time.
                </p>
              </div>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Track First Product</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {trackedProducts.map((product) => (
                <TrackedProductCard
                  key={product.id}
                  product={product}
                  onSelect={(p) => setSelectedProduct(p)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Product Detail & Scrape Log Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onProductUpdated={() => fetchData(false)}
        />
      )}

      {/* Search & Track Modal */}
      {isSearchOpen && (
        <SearchTrackModal
          existingTracked={trackedProducts}
          onClose={() => setIsSearchOpen(false)}
          onTrackedSuccess={() => fetchData(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/50 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            INE Product Price Tracker • React on Vercel + Express on Render (Docker Playwright) + Supabase
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://demo.inelabteamdev.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition"
            >
              Mock Store
            </a>
            <span>•</span>
            <a href={api.getExportUrl()} className="hover:text-slate-200 transition">
              Download CSV
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
