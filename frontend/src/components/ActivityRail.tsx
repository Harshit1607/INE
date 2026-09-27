import React, { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { TrackedProductOverview } from '../types.js';
import { api } from '../api.js';
import { categoryIcon } from '../categoryIcon.js';
import { formatAgo, formatCurrency } from '../format.js';

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
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
        filter === value ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside className="flex flex-col gap-6 rounded-panel bg-tile p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
      <div>
        <h2 className="text-lg font-bold text-ink">Latest readings</h2>
        <div role="tablist" aria-label="Filter readings" className="mt-4 flex gap-1 rounded-2xl bg-white p-1">
          {tab('all', 'All')}
          {tab('issues', 'Retried & failed')}
        </div>

        {loading ? (
          <ul className="mt-4 space-y-3" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-12 animate-pulse rounded-2xl bg-tile-2" />
            ))}
          </ul>
        ) : readings.length === 0 ? (
          <p className="mt-6 text-sm text-ink-2">
            {filter === 'issues' ? 'Every latest reading succeeded on the first try.' : 'No readings recorded yet.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {readings.map((p) => {
              const r = p.latestReading!;
              const Icon = categoryIcon(p.category);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-white"
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                      <Icon className="h-[18px] w-[18px]" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-tile ${OUTCOME_DOT[r.outcome]}`}
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

      <div className="mt-auto border-t border-line pt-5">
        <h2 className="text-sm font-bold text-ink">How readings are taken</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          Playwright opens each variant in a real browser, performs the interaction the store requires, and
          records one attempt per run. Failures stay in the history as failures.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink">
          <a
            href={api.getExportUrl()}
            download="price-history.csv"
            className="inline-flex items-center gap-1.5 underline decoration-neutral-300 underline-offset-4 hover:decoration-ink"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <a
            href="https://demo.inelabteamdev.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 underline decoration-neutral-300 underline-offset-4 hover:decoration-ink"
          >
            <ExternalLink className="h-4 w-4" /> Mock store
          </a>
        </div>
      </div>
    </aside>
  );
};
