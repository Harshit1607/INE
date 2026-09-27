import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, PlayCircle } from 'lucide-react';
import { RunHealth } from '../types.js';
import { formatLocalTime, formatMinutes } from '../format.js';

interface OverviewPanelProps {
  runHealth: RunHealth | null;
  isWaking: boolean;
  activeCount: number;
  totalCount: number;
  successRate: number | null;
  attemptCount: number;
  onRunNow: () => void;
  runNowPending: boolean;
  runNowError: string | null;
}

// Cadence track spans three hours; the run is due at 2h and flagged overdue at 2.5h (backend rule).
const TRACK_MINUTES = 180;
const DUE_MINUTES = 120;
const OVERDUE_MINUTES = 150;
const pct = (minutes: number) => `${(Math.min(minutes, TRACK_MINUTES) / TRACK_MINUTES) * 100}%`;

const CadenceTrack: React.FC<{ minutes: number; overdue: boolean; running: boolean }> = ({
  minutes,
  overdue,
  running
}) => (
  <div className="relative pb-9 pt-14">
    <div className="relative h-2 rounded-full bg-black/10">
      <div
        className="absolute inset-y-0 rounded-r-full bg-bad-dot/25"
        style={{ left: pct(OVERDUE_MINUTES), right: 0 }}
        aria-hidden="true"
      />
      <div
        className={`anim-grow absolute inset-y-0 left-0 rounded-full ${overdue ? 'bg-bad-dot' : 'bg-ink'}`}
        style={{ width: pct(minutes) }}
      />
      {[0, DUE_MINUTES, OVERDUE_MINUTES].map((m) => (
        <span
          key={m}
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-black/25"
          style={{ left: pct(m) }}
          aria-hidden="true"
        />
      ))}
      <div className="anim-travel absolute top-1/2" style={{ left: pct(minutes) }}>
        <span
          className={`absolute left-0 top-0 block h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lift ${
            overdue ? 'bg-bad-dot' : 'bg-ink'
          } ${running ? 'animate-pulse' : ''}`}
        />
        <span
          className={`absolute bottom-5 left-0 whitespace-nowrap rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white shadow-lift ${
            minutes < 30 ? '-translate-x-4' : minutes > 150 ? '-translate-x-[calc(100%-1rem)]' : '-translate-x-1/2'
          }`}
        >
          <span className="tnum">{minutes > TRACK_MINUTES ? '3h+' : formatMinutes(minutes)}</span>
          <span className="font-medium text-ink-soft"> since last run</span>
        </span>
      </div>
      <div className="absolute inset-x-0 top-full mt-3 text-xs font-medium text-ink-3">
        <span className="absolute left-0">Last run</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(DUE_MINUTES) }}>
          <span className="hidden sm:inline">Due </span>2h
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(OVERDUE_MINUTES) }}>
          <span className="hidden sm:inline">Overdue </span>2.5h
        </span>
        <span className="absolute right-0">3h</span>
      </div>
    </div>
  </div>
);

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  runHealth,
  isWaking,
  activeCount,
  totalCount,
  successRate,
  attemptCount,
  onRunNow,
  runNowPending,
  runNowError
}) => {
  const latestRun = runHealth?.latestRun ?? null;
  const minutes = runHealth?.timeSinceLastRunMinutes ?? null;
  const overdue = Boolean(runHealth?.isOverdue);
  const running = latestRun?.status === 'running';

  let headline = 'Checking schedule…';
  let detail = '';
  if (isWaking) {
    headline = 'Waking the backend';
    detail = 'Render free tier is cold-starting. The first request can take 30–45 seconds.';
  } else if (runHealth && minutes === null) {
    headline = 'No scheduled run yet';
    detail = 'The first cron run will appear here. Manual and on-track runs do not count toward the schedule.';
  } else if (runHealth && minutes !== null) {
    if (overdue) headline = `Overdue by ${formatMinutes(minutes - DUE_MINUTES)}`;
    else if (minutes >= DUE_MINUTES) headline = 'Next run due now';
    else headline = `Next run in ${formatMinutes(DUE_MINUTES - minutes)}`;
    detail = `Last scheduled run ${formatLocalTime(runHealth.lastScheduledRunAt)}`;
  }
  if (running && !isWaking) headline = 'Run in progress';

  const readOk = latestRun ? latestRun.successCount + latestRun.retriedCount : null;

  const failedCount = latestRun?.failedCount ?? 0;
  const RunIcon = running
    ? PlayCircle
    : overdue || failedCount > 0 || latestRun?.status === 'abandoned'
    ? AlertTriangle
    : latestRun
    ? CheckCircle2
    : Clock;
  const runTitle = running
    ? 'Running'
    : overdue
    ? 'Overdue'
    : latestRun?.status === 'abandoned'
    ? 'Abandoned'
    : failedCount > 0
    ? `${failedCount} of ${latestRun!.totalProducts} failed`
    : latestRun
    ? 'Healthy'
    : 'Waiting';
  const durationSec =
    latestRun?.finishedAt && latestRun.startedAt
      ? Math.round((new Date(latestRun.finishedAt).getTime() - new Date(latestRun.startedAt).getTime()) / 1000)
      : null;
  const runDetail = latestRun
    ? [
        latestRun.finishedAt ? `Finished ${formatLocalTime(latestRun.finishedAt)}` : 'Still running',
        durationSec !== null ? `took ${durationSec >= 60 ? `${Math.floor(durationSec / 60)}m${durationSec % 60 ? ` ${durationSec % 60}s` : ''}` : `${durationSec}s`}` : null,
        latestRun.trigger.replace('_', ' ')
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No run recorded yet';

  return (
    <section aria-label="Scrape schedule" className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      {/* Hero: cadence of the 2-hour schedule */}
      <div className="relative overflow-hidden rounded-panel bg-tile text-ink">
        <div className="px-6 pt-6 sm:px-8 sm:pt-7">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Scrape schedule</h2>
            <span className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-ink-2">
              Every 2h<span className="hidden sm:inline"> · cron-job.org</span> · UTC
            </span>
          </div>

          <p className="mt-5 text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-tight tracking-[-0.02em]">
            {isWaking && <Loader2 className="mr-3 inline h-7 w-7 animate-spin align-[-3px]" />}
            {headline}
          </p>
          {detail && <p className="mt-1.5 max-w-[60ch] text-sm font-medium text-ink-2">{detail}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={onRunNow}
              disabled={runNowPending || running || isWaking || !runHealth}
              className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-ink-2"
            >
              {runNowPending || running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? 'Scraping…' : runNowPending ? 'Starting…' : 'Run scrape now'}
            </button>
            <p className="max-w-[46ch] text-xs font-medium text-ink-2" aria-live="polite">
              {runNowError ?? 'Scrapes every tracked variant once. Limited to one run every 10 minutes.'}
            </p>
          </div>

          {minutes !== null && !isWaking ? (
            <CadenceTrack minutes={minutes} overdue={overdue} running={running} />
          ) : (
            <div className="py-10" aria-hidden="true">
              <div className="h-2 rounded-full bg-black/10" />
            </div>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-3 bg-tile-2">
          <div className="px-4 py-5 text-center sm:px-6">
            <dt className="text-xs font-semibold text-ink-3">Tracked variants</dt>
            <dd className="tnum mt-1 text-2xl font-bold sm:text-3xl">
              {activeCount}
              <span className="ml-1 text-sm font-semibold text-ink-3">of {totalCount}</span>
            </dd>
          </div>
          <div className="-mt-3 rounded-t-[20px] bg-ink px-4 text-white pb-5 pt-8 text-center sm:px-6">
            <dt className="text-xs font-semibold text-ink-soft">Avg success rate</dt>
            <dd className="tnum mt-1 text-3xl font-bold sm:text-4xl">
              {successRate === null ? '—' : `${successRate}%`}
            </dd>
          </div>
          <div className="px-4 py-5 text-center sm:px-6">
            <dt className="text-xs font-semibold text-ink-3">
              <span className="sm:hidden">Attempts</span>
              <span className="hidden sm:inline">Scrape attempts</span>
            </dt>
            <dd className="tnum mt-1 text-2xl font-bold sm:text-3xl">{attemptCount}</dd>
          </div>
        </dl>
      </div>

      {/* Latest run */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
        <div className="flex flex-col gap-4 rounded-panel bg-tile p-5 text-ink">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-card">
              <RunIcon className={`h-7 w-7 ${running ? 'animate-pulse' : ''}`} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink-2">Latest run</h2>
              <p className="text-2xl font-bold leading-tight">{runTitle}</p>
            </div>
          </div>
          <p className="tnum text-sm font-medium text-ink-2">{runDetail}</p>
        </div>

        <div className="flex flex-col justify-between rounded-panel bg-ink p-5 text-white">
          <h2 className="text-sm font-semibold">Read in last run</h2>
          <p className="tnum mt-3 text-4xl font-bold leading-none tracking-[-0.02em]">
            {latestRun ? (
              <>
                {readOk}
                <span className="text-xl font-semibold"> / {latestRun.totalProducts}</span>
              </>
            ) : (
              '—'
            )}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <li className="rounded-full bg-white/15 px-2.5 py-1">
              <span className="tnum">{latestRun?.successCount ?? 0}</span> first try
            </li>
            <li className="rounded-full bg-white/15 px-2.5 py-1">
              <span className="tnum">{latestRun?.retriedCount ?? 0}</span> after retry
            </li>
            <li
              className={`rounded-full px-2.5 py-1 ${
                failedCount > 0 ? 'bg-white text-bad' : 'bg-white/15'
              }`}
            >
              <span className="tnum">{failedCount}</span> failed
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};
