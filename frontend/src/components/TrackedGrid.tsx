import React from 'react';
import { ArrowUpRight, ExternalLink, Plus } from 'lucide-react';
import { storeProductUrl } from '../api.js';
import { TrackedProductOverview } from '../types.js';
import { categoryIcon } from '../categoryIcon.js';
import { formatAgo, formatCurrency } from '../format.js';
import { OutcomePill, StockPill } from './StatusPill.js';
import { panel, panelTitle, primaryButton } from '../ui.js';

interface TrackedGridProps {
  products: TrackedProductOverview[];
  loading: boolean;
  onSelect: (product: TrackedProductOverview) => void;
  onTrack: () => void;
}

const grid = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]';

export const TrackedGrid: React.FC<TrackedGridProps> = ({ products, loading, onSelect, onTrack }) => {
  // Untracked variants keep their history (chart, log, CSV) but are not shown as tracked cards.
  const tracked = products.filter((p) => p.active);

  return (
    <section aria-labelledby="tracked-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="tracked-heading" className={panelTitle}>
            Tracked variants
          </h2>
          <p className="text-xs font-medium text-ink-3">Open a card for its price chart and full scrape log</p>
        </div>
        <button type="button" onClick={onTrack} className={primaryButton}>
          <Plus className="h-4 w-4" />
          Track a variant
        </button>
      </div>

      {loading ? (
        <div className={grid} aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${panel} h-64 animate-pulse bg-tile`} />
          ))}
        </div>
      ) : tracked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center">
          <h3 className="text-base font-bold text-ink">Nothing tracked yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Search the mock store catalogue and pick a variant. Its first reading starts right away.
          </p>
        </div>
      ) : (
        <div className={grid}>
          {tracked.map((p) => {
            const Icon = categoryIcon(p.category);
            const r = p.latestReading;
            const failed = r?.outcome === 'failed';
            const bar = p.successRate >= 90 ? 'bg-ink' : p.successRate >= 60 ? 'bg-warn-dot' : 'bg-bad-dot';
            return (
              <div
                key={p.id}
                className={`${panel} group flex flex-col transition-colors hover:border-ink`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex flex-1 flex-col rounded-t-2xl p-4 text-left"
                >
                  <span className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tile text-ink">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{p.productName}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[p.brand, p.category].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
                  </span>

                  <span className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-tile px-2.5 py-1 text-xs font-semibold text-ink">
                      {p.optionAxis} · {p.optionLabel}
                    </span>
                  </span>

                  <span className="mt-4 flex items-end justify-between gap-3">
                    <span className="tnum text-2xl font-bold leading-none tracking-[-0.02em] text-ink">
                      {failed ? (
                        <span className="text-base font-semibold text-ink-3">No reading</span>
                      ) : (
                        formatCurrency(r?.price, r?.currency ?? 'INR')
                      )}
                    </span>
                    {r ? <OutcomePill outcome={r.outcome} /> : null}
                  </span>

                  <span className="mt-4 block">
                    <span className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-ink-3">Success rate</span>
                      <span className="tnum font-bold text-ink">{p.successRate}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/10">
                      <span className={`anim-grow block h-full rounded-full ${bar}`} style={{ width: `${p.successRate}%` }} />
                    </span>
                  </span>

                  <span className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-200 pt-3">
                    <span className="tnum text-xs text-ink-3">
                      {p.totalAttempts} scrapes · read {formatAgo(p.lastSuccessfulScrape)}
                    </span>
                    <StockPill status={failed ? null : r?.stockStatus ?? null} qty={r?.stockQty ?? null} />
                  </span>
                </button>
                <a
                  href={storeProductUrl(p.storeProductId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-neutral-200 px-4 py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-tile hover:text-ink"
                >
                  View on mock store
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
