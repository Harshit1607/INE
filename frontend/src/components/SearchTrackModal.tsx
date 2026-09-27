import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, ChevronRight, Loader2, Plus, Search, X } from 'lucide-react';
import { StoreProduct, StoreProductDetail, TrackedProductOverview } from '../types.js';
import { api } from '../api.js';
import { categoryIcon } from '../categoryIcon.js';

interface SearchTrackModalProps {
  existingTracked: TrackedProductOverview[];
  /** Opens straight to this product's option picker (e.g. from the catalogue list). */
  initialProduct?: StoreProduct | null;
  onClose: () => void;
  onTrackedSuccess: () => void;
}

export const SearchTrackModal: React.FC<SearchTrackModalProps> = ({
  existingTracked,
  initialProduct,
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

  useEffect(() => {
    if (initialProduct) void handleSelectProduct(initialProduct);
    // Only on open: later product changes go through the search list.
  }, []);

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
      setSuccessMessage('Tracked. The first reading is running in the background.');
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="anim-scrim fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-title"
        className="anim-sheet relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-frame sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-6 sm:px-7">
          <div>
            <h2 id="track-title" className="text-2xl font-bold tracking-[-0.02em] text-ink">
              Track a variant
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Find a product in the mock store catalogue, pick one option, and its first reading starts right away.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tile text-ink-2 transition-colors hover:bg-ink hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5 sm:p-7">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product name, e.g. smart panel, console, veloria"
              aria-label="Search the catalogue"
              className="h-14 w-full rounded-2xl bg-tile pl-12 pr-12 text-base text-ink caret-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-ink" />
            )}
          </div>

          {query.trim() !== '' && !selectedProduct && (
            <div>
              <p className="px-1 text-sm font-semibold text-ink-2" aria-live="polite">
                {searching ? 'Searching…' : `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'}`}
              </p>
              {searchResults.length === 0 && !searching ? (
                <p className="mt-3 rounded-2xl bg-tile px-4 py-8 text-center text-sm text-ink-2">
                  No products in the catalogue match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-2xl bg-tile">
                  {searchResults.map((prod) => {
                    const Icon = categoryIcon(prod.category);
                    return (
                      <li key={prod.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-tile-2"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-ink">{prod.name}</span>
                            <span className="block truncate text-xs text-ink-3">
                              {prod.brand} · {prod.category} · #{prod.id}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-ink-3 transition-colors group-hover:text-ink" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {selectedProduct && (
            <div className="rounded-panel bg-tile p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-ink">{selectedProduct.name}</h3>
                  <p className="truncate text-sm font-medium text-ink-3">
                    {selectedProduct.brand} · {selectedProduct.category} · #{selectedProduct.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductDetail(null);
                  }}
                  className="shrink-0 text-sm font-semibold text-ink underline decoration-neutral-300 underline-offset-4 hover:decoration-ink"
                >
                  Change product
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
                  <Loader2 className="h-4 w-4 animate-spin text-ink" />
                  Loading options from the live store…
                </div>
              ) : productDetail ? (
                <div className="mt-3 space-y-5">
                  {productDetail.description && (
                    <p className="max-w-[65ch] text-sm leading-relaxed text-ink-2">{productDetail.description}</p>
                  )}

                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-ink">
                      Choose {productDetail.optionAxis || 'an option'}
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {productDetail.options.map((opt) => {
                        const isSelected = opt.id === selectedOptionId;
                        const isOptTracked = existingTracked.some(
                          (tp) => tp.storeProductId === selectedProduct.id && tp.optionId === opt.id && tp.active
                        );
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedOptionId(opt.id)}
                            className={`relative flex flex-col rounded-2xl px-3.5 py-3 text-left transition-colors ${
                              isSelected
                                ? 'bg-ink text-white'
                                : 'bg-white text-ink hover:bg-tile-2'
                            }`}
                          >
                            <span className="pr-14 text-sm font-semibold">{opt.label}</span>
                            {isOptTracked && (
                              <span
                                className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-ink text-white'
                                }`}
                              >
                                Tracked
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {isAlreadyTracked && (
                    <p className="flex items-center gap-2 rounded-2xl bg-warn-50 px-4 py-3 text-sm font-medium text-warn">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      This option is already tracked. Pick another one.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleTrack}
                    disabled={submitting || isAlreadyTracked}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-ink-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting tracking…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Track this variant
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {errorMessage && (
            <p className="flex items-center gap-2 rounded-2xl bg-bad-50 px-4 py-3 text-sm font-medium text-bad">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="flex items-center gap-2 rounded-2xl bg-ok-50 px-4 py-3 text-sm font-medium text-ok">
              <Check className="h-4 w-4 shrink-0" />
              {successMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
