import React, { useState } from 'react';
import { TrackedProductOverview } from '../types.js';
import { categoryIcon } from '../categoryIcon.js';
import { formatAgo, formatCurrency } from '../format.js';
import { panel, panelHeader, panelTitle } from '../ui.js';

interface ActivityRailProps {
  products: TrackedProductOverview[];
  loading: boolean;
  onSelect: (product: TrackedProductOverview) => void;
}

const OUTCOME_DOT = { success: 'bg-ok-dot', retried: 'bg-warn-dot', failed: 'bg-bad-dot' } as const;

export const ActivityRail: React.FC<ActivityRailProps> = ({ products, loading, onSelect }) => {
  const [filter, setFilter] = useState<'all' | 'issues'>('all');

  const readings = products
    .filter((p) => p.latestReading && (filter === 'all' || p.latestReading.outcome !== 'success'))
    .sort(
      (a, b) =>
        new Date(b.latestReading!.finishedAt).getTime() - new Date(a.latestReading!.finishedAt).getTime()
    );

  const tab = (value: 'all' | 'issues', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        filter === value ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside
      aria-labelledby="readings-heading"
      className={`${panel} flex flex-col xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto`}
    >
      <div className={panelHeader}>
        <h2 id="readings-heading" className={panelTitle}>
          Latest readings
        </h2>
        <span className="tnum text-xs font-medium text-ink-3">{readings.length}</span>
      </div>
      <div className="px-5 pb-3 pt-4">
        <div role="tablist" aria-label="Filter readings" className="flex gap-1 rounded-xl bg-tile p-1">
          {tab('all', 'All')}
          {tab('issues', 'Retried & failed')}
        </div>

        {loading ? (
          <ul className="mt-4 space-y-3" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-12 animate-pulse rounded-xl bg-tile" />
            ))}
          </ul>
        ) : readings.length === 0 ? (
          <p className="mt-6 text-sm text-ink-2">
            {filter === 'issues' ? 'Every latest reading succeeded on the first try.' : 'No readings recorded yet.'}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200">
            {readings.map((p) => {
              const r = p.latestReading!;
              const Icon = categoryIcon(p.category);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-tile"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-ink">
                      <Icon className="h-[18px] w-[18px]" />
                      <span
                        className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${OUTCOME_DOT[r.outcome]}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{p.productName}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {p.optionLabel} · {formatAgo(r.finishedAt)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-right text-sm font-bold text-ink">
                      {r.outcome === 'failed' ? (
                        <span className="text-bad">{r.errorCode ?? 'failed'}</span>
                      ) : (
                        formatCurrency(r.price, r.currency)
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
