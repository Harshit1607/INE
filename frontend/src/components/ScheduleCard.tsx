import React from 'react';
import { Loader2, Play } from 'lucide-react';
import { RunHealth } from '../types.js';
import { formatLocalTime, formatMinutes } from '../format.js';
import { panel, panelHeader, panelTitle, primaryButton } from '../ui.js';

interface ScheduleCardProps {
  runHealth: RunHealth | null;
  isWaking: boolean;
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
  <div className="relative pb-8 pt-11">
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
          className={`absolute left-0 top-0 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lift ${
            overdue ? 'bg-bad-dot' : 'bg-ink'
          } ${running ? 'animate-pulse' : ''}`}
        />
        <span
          className={`absolute bottom-4 left-0 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-white ${
            minutes < 40 ? '-translate-x-3' : minutes > 140 ? '-translate-x-[calc(100%-0.75rem)]' : '-translate-x-1/2'
          }`}
        >
          <span className="tnum">{minutes > TRACK_MINUTES ? '3h+' : formatMinutes(minutes)}</span> since last run
        </span>
      </div>
      <div className="tnum absolute inset-x-0 top-full mt-2.5 text-xs font-medium text-ink-3">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(DUE_MINUTES) }}>
          2h
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(OVERDUE_MINUTES) }}>
          2.5h
        </span>
        <span className="absolute right-0">3h</span>
      </div>
    </div>
  </div>
);

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  runHealth,
  isWaking,
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

  const counts = latestRun
    ? [
        { label: 'First try', value: latestRun.successCount, tone: 'bg-ok-dot' },
        { label: 'After retry', value: latestRun.retriedCount, tone: 'bg-warn-dot' },
        { label: 'Failed', value: latestRun.failedCount, tone: 'bg-bad-dot' }
      ]
    : [];
  const countTotal = counts.reduce((sum, c) => sum + c.value, 0);
  const durationSec =
    latestRun?.finishedAt && latestRun.startedAt
      ? Math.round((new Date(latestRun.finishedAt).getTime() - new Date(latestRun.startedAt).getTime()) / 1000)
      : null;
  const runDetail = latestRun
    ? [
        latestRun.finishedAt ? `Finished ${formatLocalTime(latestRun.finishedAt)}` : 'Still running',
        durationSec !== null
          ? `took ${durationSec >= 60 ? `${Math.floor(durationSec / 60)}m${durationSec % 60 ? ` ${durationSec % 60}s` : ''}` : `${durationSec}s`}`
          : null,
        latestRun.trigger.replace('_', ' ')
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No run recorded yet';

  return (
    <section aria-labelledby="schedule-heading" className={`${panel} flex flex-col`}>
      <div className={panelHeader}>
        <h2 id="schedule-heading" className={panelTitle}>
          Scrape schedule
        </h2>
        <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-ink-2">
          Every 2h · UTC
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className={`text-2xl font-bold leading-tight tracking-[-0.02em] ${overdue ? 'text-bad' : 'text-ink'}`}>
          {isWaking && <Loader2 className="mr-2 inline h-5 w-5 animate-spin align-[-2px]" />}
          {headline}
        </p>
        {detail && <p className="mt-1 text-xs font-medium text-ink-3">{detail}</p>}

        {minutes !== null && !isWaking ? (
          <CadenceTrack minutes={minutes} overdue={overdue} running={running} />
        ) : (
          <div className="py-8" aria-hidden="true">
            <div className="h-2 rounded-full bg-black/10" />
          </div>
        )}

        <div className="border-t border-neutral-200 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-bold text-ink">Last run</h3>
            <span className="tnum truncate text-xs text-ink-3">{runDetail}</span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/10" aria-hidden="true">
            {countTotal > 0 &&
              counts.map((c) => (
                <span key={c.label} className={c.tone} style={{ width: `${(c.value / countTotal) * 100}%` }} />
              ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {counts.map((c) => (
              <div key={c.label}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                  <span className={`h-2 w-2 rounded-full ${c.tone}`} aria-hidden="true" />
                  {c.label}
                </dt>
                <dd className="tnum mt-0.5 text-lg font-bold text-ink">{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5">
          <button
            type="button"
            onClick={onRunNow}
            disabled={runNowPending || running || isWaking || !runHealth}
            className={primaryButton}
          >
            {runNowPending || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? 'Scraping…' : runNowPending ? 'Starting…' : 'Run scrape now'}
          </button>
          <p className={`text-xs font-medium ${runNowError ? 'text-bad' : 'text-ink-3'}`} aria-live="polite">
            {runNowError ?? 'Max one run every 10 minutes.'}
          </p>
        </div>
      </div>
    </section>
  );
};
