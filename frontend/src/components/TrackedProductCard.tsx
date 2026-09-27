import React from 'react';
import { CheckCircle, ChevronRight, Clock, RefreshCw, Tag, XCircle } from 'lucide-react';
import { TrackedProductOverview } from '../types.js';

interface TrackedProductCardProps {
  product: TrackedProductOverview;
  onSelect: (product: TrackedProductOverview) => void;
}

export const TrackedProductCard: React.FC<TrackedProductCardProps> = ({ product, onSelect }) => {
  const { latestReading } = product;

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

  const formatLocalTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStockBadge = () => {
    if (!latestReading || !latestReading.stockStatus) {
      return <span className="text-xs text-slate-500">No stock data</span>;
    }

    const { stockStatus, stockQty } = latestReading;
    if (stockStatus === 'out_of_stock') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Sold Out
        </span>
      );
    }
    if (stockStatus === 'low_stock') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Low Stock {stockQty !== null ? `(${stockQty})` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        In Stock {stockQty !== null ? `(${stockQty})` : ''}
      </span>
    );
  };

  const getOutcomeBadge = () => {
    if (!latestReading) return null;
    const { outcome } = latestReading;
    if (outcome === 'success') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
          <CheckCircle className="w-3 h-3" /> Success
        </span>
      );
    }
    if (outcome === 'retried') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
          <RefreshCw className="w-3 h-3" /> Retried
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group relative p-5 rounded-2xl bg-slate-900/90 border transition duration-200 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-500/5 ${
        product.active
          ? 'border-slate-800 hover:border-indigo-500/50'
          : 'border-slate-800/40 opacity-70 hover:opacity-100 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Header Tags & Category */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium truncate">
            {product.brand && <span>{product.brand}</span>}
            {product.brand && product.category && <span>•</span>}
            {product.category && <span>{product.category}</span>}
          </div>
          <div className="flex items-center space-x-1.5">
            {!product.active && (
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Inactive
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {product.successRate}% Success
            </span>
          </div>
        </div>

        {/* Product Title */}
        <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition line-clamp-1">
          {product.productName}
        </h3>

        {/* Option Variant Badge */}
        <div className="mt-2 flex items-center space-x-1.5 text-xs">
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">{product.optionAxis}:</span>
          <span className="font-semibold text-slate-200">{product.optionLabel}</span>
          <span className="text-[10px] text-slate-500">({product.optionId})</span>
        </div>

        {/* Price & Stock Display */}
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-white">
              {latestReading?.outcome === 'failed'
                ? <span className="text-slate-500 text-lg">No reading</span>
                : formatCurrency(latestReading?.price ?? null, latestReading?.currency ?? 'INR')}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {getStockBadge()}
              {getOutcomeBadge()}
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-indigo-600 transition">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Last Success: {formatLocalTime(product.lastSuccessfulScrape)}</span>
        </div>
        <span>{product.totalAttempts} total scrapes</span>
      </div>
    </div>
  );
};
