'use client';

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const COLORS = { bar: '#E9EBFF', coral: '#F47B73', grid: '#E5E7EB' };

export interface MonthlyVolumePoint {
  month: string;
  created: number;
  confirmed: number;
  value?: number;
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

export function MonthlyVolumeChart({ data, title }: { data: MonthlyVolumePoint[]; title: string }) {
  return (
    <div className="rounded-lg border border-sand-200 bg-white p-5">
      <h3 className="mb-4 font-display text-sm font-semibold text-ink-900">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ left: -20 }}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fontSize: 11, fill: '#7e899a' }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#7e899a' }} axisLine={false} tickLine={false} />
          <Tooltip
            labelFormatter={(v) => formatMonth(String(v))}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: COLORS.grid }}
          />
          <Bar dataKey="created" name="Created" fill={COLORS.bar} radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke={COLORS.coral} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
