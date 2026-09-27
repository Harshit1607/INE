import React from 'react';
import { Outcome } from '../types.js';
import { stockLabel } from '../format.js';

const OUTCOME_STYLE: Record<Outcome, { label: string; pill: string; dot: string }> = {
  success: { label: 'Success', pill: 'bg-ok-50 text-ok', dot: 'bg-ok-dot' },
  retried: { label: 'Retried', pill: 'bg-warn-50 text-warn', dot: 'bg-warn-dot' },
  failed: { label: 'Failed', pill: 'bg-bad-50 text-bad', dot: 'bg-bad-dot' }
};

export const OutcomePill: React.FC<{ outcome: Outcome }> = ({ outcome }) => {
  const s = OUTCOME_STYLE[outcome];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
};

export const StockPill: React.FC<{ status: string | null; qty: number | null }> = ({ status, qty }) => {
  const tone =
    status === 'out_of_stock'
      ? 'bg-bad-50 text-bad'
      : status === 'low_stock'
      ? 'bg-warn-50 text-warn'
      : status
      ? 'bg-white text-ink'
      : 'bg-white text-ink-2';
  return (
    <span className={`tnum inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {stockLabel(status, qty)}
    </span>
  );
};
