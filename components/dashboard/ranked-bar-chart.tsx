'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const COLORS = { bar: '#5961C7', grid: '#E5E7EB' };

export interface RankedBarDatum {
  label: string;
  value: number;
}

export function RankedBarChart({
  data,
  title,
  valueLabel = 'Count',
}: {
  data: RankedBarDatum[];
  title: string;
  valueLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-sand-200 bg-white p-5">
      <h3 className="mb-4 font-display text-sm font-semibold text-ink-900">{title}</h3>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-500">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={COLORS.grid} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#7e899a' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11, fill: '#374151' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [v, valueLabel]}
              contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: COLORS.grid }}
            />
            <Bar dataKey="value" fill={COLORS.bar} radius={[0, 3, 3, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
