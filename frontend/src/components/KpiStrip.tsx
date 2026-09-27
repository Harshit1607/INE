import React from 'react';
import { Activity, Clock, Database, Package } from 'lucide-react';
import { RunHealth } from '../types.js';
import { formatAgo } from '../format.js';
import { panel } from '../ui.js';

interface KpiStripProps {
  runHealth: RunHealth | null;
  activeCount: number;
  totalCount: number;
  successRate: number | null;
  attemptCount: number;
  loading: boolean;
}

const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  icon: React.ReactNode;
  loading: boolean;
}> = ({ label, value, sub, icon, loading }) => (
  <div className={`${panel} flex flex-col gap-3 p-5`}>
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tile text-ink" aria-hidden="true">
        {icon}
      </span>
    </div>
    {loading ? (
      <span className="h-9 w-24 animate-pulse rounded-lg bg-tile" aria-hidden="true" />
    ) : (
      <span className="tnum text-3xl font-bold leading-none tracking-[-0.02em] text-ink">{value}</span>
    )}
    <span className="tnum truncate text-xs font-medium text-ink-3">{sub}</span>
  </div>
);

export const KpiStrip: React.FC<KpiStripProps> = ({
  runHealth,
  activeCount,
  totalCount,
  successRate,
  attemptCount,
  loading
}) => {
  const latestRun = runHealth?.latestRun ?? null;
  const read = latestRun ? latestRun.successCount + latestRun.retriedCount : null;
  const runState = !latestRun
    ? 'No run recorded yet'
    : latestRun.status === 'running'
    ? 'Running now'
    : latestRun.failedCount > 0
    ? `${latestRun.failedCount} failed · ${formatAgo(latestRun.startedAt)}`
    : `All read · ${formatAgo(latestRun.startedAt)}`;

  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Kpi
        label="Tracked variants"
        value={activeCount}
        sub={`${totalCount - activeCount} untracked · ${totalCount} total`}
        icon={<Package className="h-[18px] w-[18px]" />}
        loading={loading}
      />
      <Kpi
        label="Avg success rate"
        value={successRate === null ? '—' : `${successRate}%`}
        sub="Attempts that returned a price"
        icon={<Activity className="h-[18px] w-[18px]" />}
        loading={loading}
      />
      <Kpi
        label="Scrape attempts"
        value={attemptCount.toLocaleString('en-IN')}
        sub="All time, failures included"
        icon={<Database className="h-[18px] w-[18px]" />}
        loading={loading}
      />
      <Kpi
        label="Last run"
        value={
          latestRun ? (
            <>
              {read}
              <span className="text-lg font-semibold text-ink-3"> / {latestRun.totalProducts}</span>
            </>
          ) : (
            '—'
          )
        }
        sub={
          <span className={latestRun && latestRun.failedCount > 0 ? 'text-bad' : undefined}>{runState}</span>
        }
        icon={<Clock className="h-[18px] w-[18px]" />}
        loading={loading}
      />
    </section>
  );
};
