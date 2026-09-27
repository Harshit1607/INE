import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrackedProductOverview } from '../types.js';
import { panel, panelHeader, panelTitle } from '../ui.js';

interface SuccessChartProps {
  products: TrackedProductOverview[];
  loading: boolean;
}

const barColor = (rate: number) => (rate >= 90 ? '#0A0A0A' : rate >= 60 ? '#E59A2B' : '#E0485A');

export const SuccessChart: React.FC<SuccessChartProps> = ({ products, loading }) => {
  const data = products
    .filter((p) => p.active)
    .map((p) => ({ name: p.productName, variant: p.optionLabel, rate: p.successRate, attempts: p.totalAttempts }))
    .sort((a, b) => a.rate - b.rate);
  const height = Math.max(260, data.length * 40 + 40);

  return (
    <section aria-labelledby="success-heading" className={`${panel} flex flex-col`}>
      <div className={panelHeader}>
        <div>
          <h2 id="success-heading" className={panelTitle}>
            Success rate by variant
          </h2>
          <p className="text-xs font-medium text-ink-3">Share of attempts that returned a price, lowest first</p>
        </div>
        <div className="hidden items-center gap-3 text-xs font-medium text-ink-3 sm:flex" aria-hidden="true">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ink" />≥90%</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warn-dot" />60–89%</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-bad-dot" />&lt;60%</span>
        </div>
      </div>

      <div className="flex-1 px-3 py-4">
        {loading ? (
          <div className="mx-2 h-44 animate-pulse rounded-xl bg-tile" aria-hidden="true" />
        ) : data.length === 0 ? (
          <p className="px-2 py-14 text-center text-sm text-ink-2">Track a variant to see its success rate here.</p>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }} barSize={14}>
                <CartesianGrid horizontal={false} stroke="#E5E5E5" strokeDasharray="4 6" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#6B6B6B', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: '#0A0A0A', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F4F4F4' }}
                  contentStyle={{
                    backgroundColor: '#0A0A0A',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 13,
                    color: '#FFFFFF',
                    fontFamily: 'inherit'
                  }}
                  itemStyle={{ color: '#FFFFFF', fontWeight: 600 }}
                  labelStyle={{ color: '#A3A3A3' }}
                  formatter={(value: unknown, _n, item) => [
                    `${value}% of ${item?.payload?.attempts ?? 0} attempts`,
                    item?.payload?.variant ?? 'Success'
                  ]}
                />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]} background={{ fill: '#F4F4F4', radius: 6 }} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.name + d.variant} fill={barColor(d.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
};
