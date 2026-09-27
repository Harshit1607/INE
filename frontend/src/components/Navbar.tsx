import React from 'react';
import { Activity, Download, Plus, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onOpenSearch: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  backendOnline: boolean;
  isWaking: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onRefresh,
  isRefreshing,
  backendOnline,
  isWaking
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                INE Price Tracker
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Mock Store
              </span>
            </div>
            <p className="text-xs text-slate-400">Honest price & stock history via Playwright</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isWaking
                  ? 'bg-amber-400 animate-ping'
                  : backendOnline
                  ? 'bg-emerald-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">
              {isWaking ? 'Backend waking...' : backendOnline ? 'Backend Online' : 'Connecting...'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export CSV Button */}
          <a
            href="/api/export.csv"
            download="price-history.csv"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </a>

          {/* Track Product Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Track Product</span>
          </button>
        </div>
      </div>
    </header>
  );
};
