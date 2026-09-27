import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ScrapeAttempt, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';
import { categoryIcon } from '../categoryIcon.js';
import { formatAgo, formatCurrency, formatLocalTime, stockLabel } from '../format.js';
import { OutcomePill } from './StatusPill.js';

interface ProductDetailModalProps {
  product: TrackedProductOverview;
  onClose: () => void;
  onProductUpdated: () => void;
}

interface HistoryPoint {
  t: string;
  price: number | null;
  stock: number | null;
  stockStatus: string | null;
  outcome: ScrapeAttempt['outcome'];
  error: string | null;
}

interface HistoryChartProps {
  data: HistoryPoint[];
  dataKey: 'price' | 'stock';
  /** Recharts y-domain; stock starts at 0 so a sell-out reads as a drop to the axis. */
  yDomain: [number | 'auto', number | 'auto'];
  yTickFormatter: (value: number) => string;
  yWidth: number;
  /** Tooltip text for a successful reading. */
  formatValue: (point: HistoryPoint) => string;
  seriesLabel: string;
  emptyLabel: string;
  legendRead: string;
  legendFailed: string;
}

// Failed attempts carry null, so the line breaks at them (connectNulls=false) and a red dashed
// marker sits at each one; nothing is drawn as zero or carried forward.
const HistoryChart: React.FC<HistoryChartProps> = ({
  data,
  dataKey,
  yDomain,
  yTickFormatter,
  yWidth,
  formatValue,
  seriesLabel,
  emptyLabel,
  legendRead,
  legendFailed
}) => {
  const failedTimes = data.filter((d) => d.outcome === 'failed').map((d) => d.t);
  return (
    <div className="rounded-panel bg-tile p-4 sm:p-6">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#DDDDDD" strokeDasharray="4 6" />
            <XAxis
              dataKey="t"
              tickFormatter={(v: string) =>
                new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              }
              stroke="#6B6B6B"
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#DDDDDD' }}
              minTickGap={36}
            />
            <YAxis
              domain={yDomain}
              allowDecimals={false}
              tickFormatter={(v) => yTickFormatter(Number(v))}
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={yWidth}
            />
            {failedTimes.map((t) => (
              <ReferenceLine key={t} x={t} stroke="#E0485A" strokeDasharray="3 4" strokeWidth={1.5} />
            ))}
            <Tooltip
              cursor={{ stroke: '#A3A3A3', strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: '#0A0A0A',
                border: 'none',
                borderRadius: 12,
                boxShadow: '0 18px 36px -12px rgba(10,10,10,0.35)',
                fontSize: 13,
                color: '#FFFFFF',
                fontFamily: 'inherit'
              }}
              itemStyle={{ color: '#FFFFFF', fontWeight: 600 }}
              labelStyle={{ color: '#A3A3A3' }}
              formatter={(_value: unknown, _name, item) => {
                const point = item?.payload as HistoryPoint | undefined;
                if (!point || point.outcome === 'failed') {
                  return [`Failed${point?.error ? ` · ${point.error}` : ''}`, emptyLabel];
                }
                return [formatValue(point), seriesLabel];
              }}
              labelFormatter={(v: string) => formatLocalTime(v, true)}
            />
            <Line
              type="linear"
              dataKey={dataKey}
              stroke="#0A0A0A"
              strokeWidth={2.5}
              dot={{ fill: '#0A0A0A', stroke: '#F4F4F4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#0A0A0A', stroke: '#FFFFFF', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" /> {legendRead}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-0 border-l-2 border-dashed border-bad-dot" /> {legendFailed}
        </span>
        <span className="text-ink-3">Failures break the line; they are never drawn as zero or carried forward.</span>
      </div>
    </div>
  );
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onProductUpdated
}) => {
  const [attempts, setAttempts] = useState<ScrapeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUntracking, setIsUntracking] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'stock' | 'log'>('chart');

  useEffect(() => {
    let isMounted = true;
    const loadAttempts = async () => {
      try {
        setLoading(true);
        const data = await api.getProductAttempts(product.id);
        if (isMounted) {
          setAttempts(data.attempts);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAttempts();
    return () => {
      isMounted = false;
    };
  }, [product.id]);

  const handleUntrack = async () => {
    if (!window.confirm(`Stop scraping "${product.productName}"? Past history will remain saved.`)) {
      return;
    }
    try {
      setIsUntracking(true);
      await api.untrackProduct(product.id);
      onProductUpdated();
      onClose();
    } catch (err: unknown) {
      alert(`Failed to untrack: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUntracking(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Chronological; failed attempts keep price and stock null so the lines break instead of dropping to zero.
  // Sold out is a real reading of 0 units, so it plots on the axis rather than as a gap.
  const chartData: HistoryPoint[] = [...attempts]
    .sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime())
    .map((att) => {
      const failed = att.outcome === 'failed';
      return {
        t: att.finishedAt,
        price: failed ? null : att.price,
        stock: failed ? null : att.stockQty,
        stockStatus: failed ? null : att.stockStatus,
        outcome: att.outcome,
        error: att.errorCode
      };
    });

  const { latestReading } = product;
  const Icon = categoryIcon(product.category);
  const tabs = [
    { id: 'chart', label: 'Price history' },
    { id: 'stock', label: 'Stock history' },
    { id: 'log', label: `Scrape log · ${attempts.length}` }
  ] as const;

  const th = 'px-4 py-3 font-semibold';
  const td = 'px-4 py-3';

  return (
    <div
      className="anim-scrim fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="anim-sheet relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-frame sm:rounded-[28px]"
      >
        {/* Header band */}
        <div className="bg-ink text-white">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
                <Icon className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h2 id="detail-title" className="text-2xl font-bold leading-tight tracking-[-0.02em]">
                  {product.productName}
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium text-ink-soft">
                  {[product.brand, product.category, `Store #${product.storeProductId}`].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                    {product.optionAxis} · {product.optionLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {product.active && (
                <button
                  type="button"
                  onClick={handleUntrack}
                  disabled={isUntracking}
                  className="hidden items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-white hover:text-bad disabled:opacity-60 sm:flex"
                >
                  <Trash2 className="h-4 w-4" />
                  {isUntracking ? 'Untracking…' : 'Untrack'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 bg-white/10 sm:grid-cols-4">
            <div className="px-5 py-4 sm:px-7">
              <dt className="text-xs font-semibold text-ink-soft">Latest price</dt>
              <dd className="tnum mt-0.5 text-2xl font-bold">
                {latestReading?.outcome === 'failed' ? (
                  <span className="text-lg">No reading</span>
                ) : (
                  formatCurrency(latestReading?.price, latestReading?.currency)
                )}
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-7">
              <dt className="text-xs font-semibold text-ink-soft">Stock</dt>
              <dd className="tnum mt-0.5 text-lg font-bold">
                {latestReading?.outcome === 'failed'
                  ? 'Unknown'
                  : stockLabel(latestReading?.stockStatus ?? null, latestReading?.stockQty ?? null)}
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-7">
              <dt className="text-xs font-semibold text-ink-soft">Success rate</dt>
              <dd className="tnum mt-0.5 text-2xl font-bold">{product.successRate}%</dd>
            </div>
            <div className="px-5 py-4 sm:px-7">
              <dt className="text-xs font-semibold text-ink-soft">Last read</dt>
              <dd className="mt-0.5 text-lg font-bold">{formatAgo(product.lastSuccessfulScrape)}</dd>
            </div>
          </dl>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-5 sm:px-7">
          <div role="tablist" aria-label="History views" className="flex w-full gap-1 rounded-2xl bg-tile p-1 sm:w-auto sm:inline-flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
                  activeTab === t.id ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-2">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-ink" />
              <p className="text-sm font-medium">Loading scrape history…</p>
            </div>
          ) : error ? (
            <p className="rounded-2xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
              Couldn&apos;t load the history: {error}
            </p>
          ) : attempts.length === 0 ? (
            <p className="py-20 text-center text-sm text-ink-2">
              No scrape attempts yet. The first reading is on its way.
            </p>
          ) : (
            <>
              {activeTab === 'chart' && (
                <HistoryChart
                  data={chartData}
                  dataKey="price"
                  yDomain={['auto', 'auto']}
                  yTickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                  yWidth={76}
                  formatValue={(p) => formatCurrency(p.price)}
                  seriesLabel="Price"
                  emptyLabel="No price"
                  legendRead="Price read"
                  legendFailed="Failed attempt, no price recorded"
                />
              )}

              {activeTab === 'stock' && (
                <HistoryChart
                  data={chartData}
                  dataKey="stock"
                  yDomain={[0, 'auto']}
                  yTickFormatter={(v) => `${v}`}
                  yWidth={44}
                  formatValue={(p) => stockLabel(p.stockStatus, p.stock)}
                  seriesLabel="Stock"
                  emptyLabel="No stock"
                  legendRead="Units available (sold out = 0)"
                  legendFailed="Failed attempt, no stock recorded"
                />
              )}

              {activeTab === 'log' && (
                <div className="overflow-x-auto rounded-panel bg-tile">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="border-b border-line text-xs text-ink-3">
                      <tr>
                        <th className={th}>Finished (local)</th>
                        <th className={th}>Outcome</th>
                        <th className={`${th} text-right`}>Tries</th>
                        <th className={`${th} text-right`}>Duration</th>
                        <th className={`${th} text-right`}>Price</th>
                        <th className={th}>Stock</th>
                        <th className={`${th} text-right`}>Manifest</th>
                        <th className={th}>Detail</th>
                      </tr>
                    </thead>
                    <tbody className="tnum divide-y divide-line text-ink">
                      {attempts.map((att) => {
                        const isFailed = att.outcome === 'failed';
                        return (
                          <tr key={att.id} className="transition-colors hover:bg-tile-2">
                            <td className={`${td} whitespace-nowrap text-ink-2`}>{formatLocalTime(att.finishedAt, true)}</td>
                            <td className={td}>
                              <OutcomePill outcome={att.outcome} />
                            </td>
                            <td className={`${td} text-right font-semibold`}>{att.triesCount}</td>
                            <td className={`${td} text-right text-ink-2`}>{(att.durationMs / 1000).toFixed(1)}s</td>
                            <td className={`${td} whitespace-nowrap text-right font-bold`}>
                              {isFailed ? <span className="text-ink-3">—</span> : formatCurrency(att.price, att.currency)}
                            </td>
                            <td className={`${td} whitespace-nowrap`}>
                              {isFailed ? <span className="text-ink-3">—</span> : stockLabel(att.stockStatus, att.stockQty)}
                            </td>
                            <td className={`${td} text-right text-ink-2`}>{att.manifestRevision ?? '—'}</td>
                            <td className={`${td} max-w-xs`}>
                              {isFailed ? (
                                <span className="block truncate text-bad" title={att.errorDetail || att.errorCode || ''}>
                                  <code className="rounded bg-bad-50 px-1.5 py-0.5 text-xs font-semibold">{att.errorCode}</code>{' '}
                                  {att.errorDetail || 'Scrape failed'}
                                </span>
                              ) : (
                                <span className="text-ink-3">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
            {product.active && (
              <button
                type="button"
                onClick={handleUntrack}
                disabled={isUntracking}
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-bad-50 px-4 py-3 text-sm font-semibold text-bad sm:hidden"
              >
                <Trash2 className="h-4 w-4" />
                {isUntracking ? 'Untracking…' : 'Untrack this variant'}
              </button>
            )}
        </div>
      </div>
    </div>
  );
};
