import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Sparkles,
  Tag,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { StoreProduct, StoreProductDetail, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';

interface SearchTrackModalProps {
  existingTracked: TrackedProductOverview[];
  onClose: () => void;
  onTrackedSuccess: () => void;
}

export const SearchTrackModal: React.FC<SearchTrackModalProps> = ({
  existingTracked,
  onClose,
  onTrackedSuccess
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [productDetail, setProductDetail] = useState<StoreProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await api.searchStoreProducts(query);
        setSearchResults(results);
      } catch (err: unknown) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Load product detail when product selected
  const handleSelectProduct = async (product: StoreProduct) => {
    setSelectedProduct(product);
    setErrorMessage(null);
    try {
      setLoadingDetail(true);
      const detail = await api.getStoreProductDetail(product.id);
      setProductDetail(detail);
      if (detail.options && detail.options.length > 0) {
        setSelectedOptionId(detail.options[0].id);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  // Check if option is already tracked
  const isAlreadyTracked = Boolean(
    selectedProduct &&
    existingTracked.some(
      (tp) => tp.storeProductId === selectedProduct.id && tp.optionId === selectedOptionId && tp.active
    )
  );

  const handleTrack = async () => {
    if (!selectedProduct || !selectedOptionId) return;

    if (isAlreadyTracked) {
      setErrorMessage('This product and option variant is already actively tracked.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await api.trackProduct(selectedProduct.id, selectedOptionId);
      setSuccessMessage('Tracked successfully! Initial scrape initiated in background.');
      setTimeout(() => {
        onTrackedSuccess();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Track a Store Product & Variant
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search by partial or full title, pick an option variant, and initiate price tracking.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search store products (e.g. 'smart panel', 'console', 'veloria')..."
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              autoFocus
            />
            {searching && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-indigo-400 animate-spin" />
            )}
          </div>

          {/* Search Results List */}
          {query.trim() !== '' && !selectedProduct && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Matching Products ({searchResults.length})
              </div>
              {searchResults.length === 0 && !searching ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No store products matched &quot;{query}&quot;.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-60 overflow-y-auto">
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className="p-3.5 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs text-slate-400 font-medium">
                          {prod.brand} • {prod.category} • ID #{prod.id}
                        </div>
                        <div className="text-sm font-semibold text-white group-hover:text-indigo-400 transition">
                          {prod.name}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Product Configuration */}
          {selectedProduct && (
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">
                    {selectedProduct.brand} • {selectedProduct.category} • ID #{selectedProduct.id}
                  </div>
                  <h3 className="text-base font-bold text-white">{selectedProduct.name}</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductDetail(null);
                  }}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Change Product
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-8 text-center text-slate-400 flex items-center justify-center space-x-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading variant options from live store...</span>
                </div>
              ) : productDetail ? (
                <div className="space-y-4">
                  {productDetail.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {productDetail.description}
                    </p>
                  )}

                  {/* Option Variant Picker */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Select {productDetail.optionAxis || 'Option'} Variant:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {productDetail.options.map((opt) => {
                        const isSelected = opt.id === selectedOptionId;
                        const isOptTracked = existingTracked.some(
                          (tp) =>
                            tp.storeProductId === selectedProduct.id &&
                            tp.optionId === opt.id &&
                            tp.active
                        );

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedOptionId(opt.id)}
                            className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                              isSelected
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-xs font-semibold">{opt.label}</span>
                            <span className="text-[10px] text-slate-500 mt-1">ID: {opt.id}</span>
                            {isOptTracked && (
                              <span className="absolute top-2 right-2 text-[9px] uppercase font-bold text-emerald-400">
                                Tracked
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duplicate warning */}
                  {isAlreadyTracked && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>This product and option is already actively tracked.</span>
                    </div>
                  )}

                  {/* Track Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTrack}
                      disabled={submitting || isAlreadyTracked}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Initiating Tracking...</span>
                        </>
                      ) : (
                        <>
                          <Tag className="w-4 h-4" />
                          <span>Track Variant</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
