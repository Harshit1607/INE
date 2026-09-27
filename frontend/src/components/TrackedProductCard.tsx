import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { TrackedProductOverview } from '../types.js';
import { categoryIcon } from '../categoryIcon.js';
import { formatAgo, formatCurrency } from '../format.js';
import { OutcomePill, StockPill } from './StatusPill.js';

interface TrackedProductCardProps {
  product: TrackedProductOverview;
  onSelect: (product: TrackedProductOverview) => void;
}

export const TrackedProductCard: React.FC<TrackedProductCardProps> = ({ product, onSelect }) => {
  const { latestReading } = product;
  const Icon = categoryIcon(product.category);
  const failed = latestReading?.outcome === 'failed';
  const barTone =
    product.successRate >= 90 ? 'bg-ink' : product.successRate >= 60 ? 'bg-warn-dot' : 'bg-bad-dot';

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="group relative mt-7 flex flex-col rounded-panel bg-tile p-5 pt-12 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-lift"
    >
      <span
        className={`absolute -top-7 left-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-card ${
          product.active ? 'bg-white text-ink' : 'bg-white text-ink-3'
        }`}
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" strokeWidth={2} />
      </span>

      <span className="absolute right-4 top-3 flex items-center gap-2">
        {!product.active && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-2">Untracked</span>
        )}
        {latestReading && <OutcomePill outcome={latestReading.outcome} />}
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-2 transition-colors group-hover:bg-ink group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </span>

      <span className="line-clamp-1 text-lg font-bold tracking-[-0.01em] text-ink">{product.productName}</span>
      <p className="mt-0.5 truncate text-sm font-medium text-ink-3">
        {[product.brand, product.category].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-2 truncate text-sm text-ink-2">
        {product.optionAxis} <span className="font-semibold text-ink">{product.optionLabel}</span>
      </p>

      <p className="tnum mt-4 text-3xl font-bold leading-none tracking-[-0.02em] text-ink">
        {failed ? <span className="text-xl font-semibold text-ink-3">No reading last run</span> : formatCurrency(latestReading?.price, latestReading?.currency ?? 'INR')}
      </p>

      <p className="mt-2 text-xs font-medium text-ink-3">Last read {formatAgo(product.lastSuccessfulScrape)}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink-2">Success rate</span>
          <span className="tnum font-bold text-ink">{product.successRate}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
          <div className={`anim-grow h-full rounded-full ${barTone}`} style={{ width: `${product.successRate}%` }} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="tnum text-xs font-medium text-ink-3">
          {product.totalAttempts} scrapes
        </span>
        <StockPill status={failed ? null : latestReading?.stockStatus ?? null} qty={latestReading?.stockQty ?? null} />
      </div>
    </button>
  );
};
