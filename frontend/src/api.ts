import {
  RunHealth,
  ScrapeAttempt,
  StoreProduct,
  StoreProductDetail,
  TrackedProductOverview
} from './types.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // Ignored
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  getHealth: async (): Promise<{ status: string; time: string }> => {
    const res = await fetch(`${API_BASE}/api/health`);
    return handleResponse(res);
  },

  getRunHealth: async (): Promise<RunHealth> => {
    const res = await fetch(`${API_BASE}/api/runs/health`);
    return handleResponse(res);
  },

  /** Starts a manual scrape of all tracked variants; rejects with the backend's cooldown/busy message. */
  startManualRun: async (): Promise<{ runId: string; startedAt: string }> => {
    const res = await fetch(`${API_BASE}/api/runs/manual`, { method: 'POST' });
    return handleResponse(res);
  },

  getTrackedProducts: async (): Promise<TrackedProductOverview[]> => {
    const res = await fetch(`${API_BASE}/api/tracked`);
    const data = await handleResponse<{ trackedProducts: TrackedProductOverview[] }>(res);
    return data.trackedProducts;
  },

  getProductAttempts: async (id: string): Promise<{ product: TrackedProductOverview; attempts: ScrapeAttempt[] }> => {
    const res = await fetch(`${API_BASE}/api/tracked/${id}/attempts`);
    return handleResponse(res);
  },

  searchStoreProducts: async (q: string): Promise<StoreProduct[]> => {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
    const data = await handleResponse<{ results: StoreProduct[] }>(res);
    return data.results;
  },

  listCatalog: async (offset: number, limit: number): Promise<{ products: StoreProduct[]; total: number }> => {
    const res = await fetch(`${API_BASE}/api/catalog?offset=${offset}&limit=${limit}`);
    return handleResponse(res);
  },

  getStoreProductDetail: async (id: number): Promise<StoreProductDetail> => {
    const res = await fetch(`${API_BASE}/api/store-products/${id}`);
    return handleResponse(res);
  },

  trackProduct: async (storeProductId: number, optionId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/tracked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeProductId, optionId })
    });
    await handleResponse(res);
  },

  untrackProduct: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/tracked/${id}`, {
      method: 'DELETE'
    });
    await handleResponse(res);
  },

  getExportUrl: (): string => {
    return `${API_BASE}/api/export.csv`;
  }
};
