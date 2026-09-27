import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import { RunHealth } from '../types.js';

interface RunHealthBannerProps {
  runHealth: RunHealth | null;
  isWaking: boolean;
}

export const RunHealthBanner: React.FC<RunHealthBannerProps> = ({ runHealth, isWaking }) => {
  if (isWaking) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-center space-x-3 text-sm animate-pulse">
        <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold">Backend is waking up from idle (Render Free Tier):</span> Initial request may take 30-45 seconds. Scraping jobs and data will load momentarily.
        </div>
      </div>
    );
  }

  if (!runHealth) {
    return null;
  }

  const { latestRun, isOverdue, timeSinceLastRunMinutes } = runHealth;

  const formatLocalTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getRelativeTimeText = () => {
    if (timeSinceLastRunMinutes === null) return 'No runs recorded yet';
    if (timeSinceLastRunMinutes < 1) return 'Just now';
    if (timeSinceLastRunMinutes < 60) return `${timeSinceLastRunMinutes}m ago`;
    const hours = Math.floor(timeSinceLastRunMinutes / 60);
    const mins = timeSinceLastRunMinutes % 60;
    return `${hours}h ${mins}m ago`;
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Overdue Alert Banner if overdue */}
      {isOverdue && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-100">Scraper Schedule Overdue Warning</div>
            <p className="text-xs text-rose-300 mt-0.5">
              The automated scrape run is scheduled every 2 hours (cron-job.org). The last run was {getRelativeTimeText()}, which exceeds the expected 2-hour interval.
            </p>
          </div>
        </div>
      )}

      {/* Main Status Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {latestRun?.status === 'running' ? (
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 animate-pulse" />
            </div>
          ) : isOverdue ? (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-200">
                {latestRun?.status === 'running'
                  ? 'Scrape Run In Progress'
                  : isOverdue
                  ? 'Schedule Status: Overdue'
                  : 'Scraper Schedule: Healthy'}
              </span>
              <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                Every 2 Hours (UTC)
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
              <span>Last Run: {formatLocalTime(latestRun?.startedAt)} ({getRelativeTimeText()})</span>
              {latestRun?.trigger && (
                <>
                  <span>•</span>
                  <span className="capitalize">Trigger: {latestRun.trigger}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {latestRun && (
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{latestRun.successCount} Success</span>
            </div>
            {latestRun.retriedCount > 0 && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800/80 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>{latestRun.retriedCount} Retried</span>
              </div>
            )}
            {latestRun.failedCount > 0 && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800/80 text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>{latestRun.failedCount} Failed</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
