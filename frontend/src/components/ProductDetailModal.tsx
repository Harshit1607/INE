import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ScrapeAttempt, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';

interface ProductDetailModalProps {
  product: TrackedProductOverview;
  onClose: () => void;
  onProductUpdated: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onProductUpdated
}) => {
  const [attempts, setAttempts] = useState<ScrapeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUntracking, setIsUntracking] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'log' | 'table'>('chart');

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

  const formatCurrency = (amount: number | null, currency: string | null = 'INR') => {
    if (amount === null || isNaN(amount)) return '—';
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `₹${amount.toLocaleString()}`;
    }
  };

  const formatLocalTime = (isoString?: string) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Prepare chart data (ordered chronologically ascending)
  const chartData = [...attempts]
    .sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime())
    .map((att) => {
      const isFailed = att.outcome === 'failed';
      return {
        timestamp: new Date(att.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: formatLocalTime(att.finishedAt),
        // Honest rule: price is null on failure so Recharts draws a GAP rather than 0!
        price: isFailed ? null : att.price,
        stockStatus: att.stockStatus || 'Failed',
        stockQty: att.stockQty,
        outcome: att.outcome,
        tries: att.triesCount,
        error: att.errorCode
      };
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>{product.brand}</span>
              <span>•</span>
              <span>{product.category}</span>
              <span>•</span>
              <span>Store Product #{product.storeProductId}</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{product.productName}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Tag className="w-3.5 h-3.5" />
                {product.optionAxis}: {product.optionLabel}
              </span>
              <span className="text-xs text-slate-500">Option ID: {product.optionId}</span>
              <a
                href={`https://demo.inelabteamdev.com/item/${product.storeProductId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition ml-2"
              >
                <span>View on Mock Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {product.active && (
              <button
                onClick={handleUntrack}
                disabled={isUntracking}
                className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition flex items-center gap-1.5"
                title="Stop Scraping"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Untrack</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 flex space-x-6">
          <button
            onClick={() => setActiveTab('chart')}
            className={`py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'chart'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Price & Stock History Chart
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'log'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Honest Scrape Log ({attempts.length})
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'table'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Data Table
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
              <p className="text-sm">Loading scrape history and logs...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              Failed to load history: {error}
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No scrape attempts recorded yet. An automated scrape will occur shortly.
            </div>
          ) : (
            <>
              {/* Tab 1: Chart View */}
              {activeTab === 'chart' && (
                <div className="space-y-4">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="timestamp" stroke="#64748b" fontSize={12} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          domain={['auto', 'auto']}
                          tickFormatter={(v) => `₹${Number(v).toLocaleString()}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                            color: '#f8fafc'
                          }}
                          formatter={(value: unknown) => {
                            if (value === null) return ['Failed Attempt (Gap)', 'Price'];
                            return [`₹${Number(value).toLocaleString()}`, 'Price'];
                          }}
                          labelFormatter={(_label, payload) => {
                            if (payload && payload[0]) {
                              return payload[0].payload.fullDate;
                            }
                            return _label;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          dot={{ fill: '#6366f1', r: 4 }}
                          activeDot={{ r: 6, fill: '#a5b4fc' }}
                          connectNulls={false} // NEVER connect nulls: failed attempts appear honestly as gaps!
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    Note: Failed scrape attempts honestly appear as <strong>gaps</strong> in the chart line rather than drawn as zero or misleading interpolated values.
                  </p>
                </div>
              )}

              {/* Tab 2: Honest Scrape Log */}
              {activeTab === 'log' && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Timestamp (Local)</th>
                          <th className="px-4 py-3">Outcome</th>
                          <th className="px-4 py-3">Tries</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3">Stock</th>
                          <th className="px-4 py-3">Manifest Rev</th>
                          <th className="px-4 py-3">Details / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {attempts.map((att) => {
                          const isSuccess = att.outcome === 'success';
                          const isRetried = att.outcome === 'retried';
                          const isFailed = att.outcome === 'failed';

                          return (
                            <tr key={att.id} className="hover:bg-slate-800/40 transition">
                              <td className="px-4 py-3 font-mono text-slate-400">
                                {formatLocalTime(att.finishedAt)}
                              </td>
                              <td className="px-4 py-3">
                                {isSuccess && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" /> success
                                  </span>
                                )}
                                {isRetried && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <RefreshCw className="w-3 h-3" /> retried
                                  </span>
                                )}
                                {isFailed && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <XCircle className="w-3 h-3" /> failed
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-semibold">{att.triesCount} {att.triesCount === 1 ? 'try' : 'tries'}</td>
                              <td className="px-4 py-3 text-slate-400">{(att.durationMs / 1000).toFixed(1)}s</td>
                              <td className="px-4 py-3 font-bold text-white">
                                {isFailed ? <span className="text-slate-500">—</span> : formatCurrency(att.price, att.currency)}
                              </td>
                              <td className="px-4 py-3">
                                {isFailed ? (
                                  <span className="text-slate-500">—</span>
                                ) : (
                                  <span>{att.stockStatus} {att.stockQty !== null ? `(${att.stockQty})` : ''}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-400">
                                {att.manifestRevision || '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                                {isFailed ? (
                                  <span className="text-rose-400" title={att.errorDetail || att.errorCode || ''}>
                                    [{att.errorCode}] {att.errorDetail || 'Scrape failed'}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Data Table View */}
              {activeTab === 'table' && (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Finished At (UTC)</th>
                        <th className="px-4 py-3">Product ID</th>
                        <th className="px-4 py-3">Option</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock Status</th>
                        <th className="px-4 py-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {attempts.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono">{new Date(att.finishedAt).toISOString()}</td>
                          <td className="px-4 py-3">{product.storeProductId}</td>
                          <td className="px-4 py-3">{product.optionLabel}</td>
                          <td className="px-4 py-3 font-bold text-white">
                            {att.outcome === 'failed' ? '—' : formatCurrency(att.price, att.currency)}
                          </td>
                          <td className="px-4 py-3">
                            {att.outcome === 'failed' ? '—' : `${att.stockStatus} ${att.stockQty ? `(${att.stockQty})` : ''}`}
                          </td>
                          <td className="px-4 py-3 capitalize">{att.outcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
