import React from 'react';
import { Download, ExternalLink, LayoutGrid, Plus, RefreshCw } from 'lucide-react';
import { api } from '../api.js';

interface SidebarProps {
  onOpenSearch: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  backendOnline: boolean;
  isWaking: boolean;
}

const railButton =
  'group relative flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-colors duration-150 hover:bg-white/15 focus-visible:outline-white disabled:opacity-60';

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">
    {children}
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenSearch,
  onRefresh,
  isRefreshing,
  backendOnline,
  isWaking
}) => {
  const status = isWaking ? 'Backend waking up' : backendOnline ? 'Backend online' : 'Backend unreachable';
  const dot = isWaking ? 'bg-warn-dot animate-pulse' : backendOnline ? 'bg-ok-dot' : 'bg-bad-dot';

  return (
    <aside className="z-30 flex shrink-0 items-center justify-between gap-2 rounded-panel bg-ink px-3 py-2.5 shadow-lift lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:max-h-[860px] lg:w-[76px] lg:flex-col lg:justify-start lg:px-0 lg:py-5">
      <div className="flex items-center gap-3 lg:flex-col">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-ink"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16.5l5-5 4 4 7-8" />
          </svg>
        </div>
      </div>

      <nav aria-label="Main" className="flex items-center gap-1 lg:mt-10 lg:flex-col lg:gap-3">
        <span className="relative hidden h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white lg:flex" aria-current="page">
          <LayoutGrid className="h-5 w-5" />
          <span className="sr-only">Dashboard</span>
        </span>
        <button type="button" onClick={onOpenSearch} className={railButton} aria-label="Track a variant">
          <Plus className="h-5 w-5" />
          <Tip>Track a variant</Tip>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={railButton}
          aria-label="Refresh data"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <Tip>{isRefreshing ? 'Refreshing…' : 'Refresh data'}</Tip>
        </button>
        <a href={api.getExportUrl()} download="price-history.csv" className={railButton} aria-label="Export CSV">
          <Download className="h-5 w-5" />
          <Tip>Export price history (CSV)</Tip>
        </a>
        <a
          href="https://demo.inelabteamdev.com"
          target="_blank"
          rel="noreferrer"
          className={`${railButton} hidden sm:flex`}
          aria-label="Open mock store"
        >
          <ExternalLink className="h-5 w-5" />
          <Tip>Open mock store</Tip>
        </a>
      </nav>

      <div className="group relative hidden lg:mt-auto lg:flex" role="status" aria-label={status}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <span className={`h-2.5 w-2.5 rounded-full ring-4 ring-white/15 ${dot}`} />
        </span>
        <Tip>{status}</Tip>
      </div>
    </aside>
  );
};
