export const formatCurrency = (amount: number | null | undefined, currency: string | null = 'INR') => {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
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

export const formatLocalTime = (isoString?: string | null, withSeconds = false) => {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {})
  });
};

export const formatMinutes = (minutes: number) => {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

export const formatAgo = (isoString?: string | null) => {
  if (!isoString) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
  return mins < 1 ? 'just now' : `${formatMinutes(mins)} ago`;
};

export const stockLabel = (status: string | null, qty: number | null) => {
  if (!status) return 'No stock data';
  if (status === 'out_of_stock') return 'Sold out';
  const count = qty !== null ? ` · ${qty}` : '';
  if (status === 'low_stock') return `Low stock${count}`;
  return `In stock${count}`;
};
