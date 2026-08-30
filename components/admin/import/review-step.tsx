'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { RowValidationResult } from '@/lib/validation/import';

export interface ReviewBucket {
  valid: RowValidationResult[];
  duplicates: (RowValidationResult & { duplicateReason: string })[];
  invalid: RowValidationResult[];
}

export function ReviewStep({ buckets }: { buckets: ReviewBucket }) {
  const [openPanel, setOpenPanel] = useState<'duplicates' | 'invalid' | null>(null);

  return (
    <div>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="positive"
          label="Valid"
          count={buckets.valid.length}
          hint="Will be imported"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
          label="Duplicate"
          count={buckets.duplicates.length}
          hint="Already exist — skipped"
          onClick={buckets.duplicates.length > 0 ? () => setOpenPanel(openPanel === 'duplicates' ? null : 'duplicates') : undefined}
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5" />}
          tone="negative"
          label="Invalid"
          count={buckets.invalid.length}
          hint="Fix in the sheet and re-upload"
          onClick={buckets.invalid.length > 0 ? () => setOpenPanel(openPanel === 'invalid' ? null : 'invalid') : undefined}
        />
      </div>

      {buckets.valid.some((v) => v.warnings.length > 0) && (
        <p className="mb-4 text-xs text-ink-500">
          {buckets.valid.filter((v) => v.warnings.length > 0).length} valid row(s) have a status, agent, or source
          that wasn't recognized — those rows will still import, just without that field set. Expand a row below to see details.
        </p>
      )}

      {openPanel === 'duplicates' && (
        <RowTable
          title="Duplicate rows (skipped)"
          rows={buckets.duplicates}
          reasonFor={(r) => r.duplicateReason}
        />
      )}
      {openPanel === 'invalid' && (
        <RowTable title="Invalid rows (not imported)" rows={buckets.invalid} reasonFor={(r) => r.errors.join(' ')} />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  count,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  tone: 'positive' | 'warning' | 'negative';
  label: string;
  count: number;
  hint: string;
  onClick?: () => void;
}) {
  const toneClasses = {
    positive: 'text-harbor-700 bg-harbor-100',
    warning: 'text-amber-700 bg-amber-100',
    negative: 'text-coral-600 bg-coral-500/10',
  }[tone];

  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border border-sand-200 bg-white p-4 text-left ${onClick ? 'cursor-pointer hover:bg-sand-50' : ''}`}
    >
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${toneClasses}`}>{icon}</div>
      <p className="font-ticket text-2xl font-semibold text-ink-900">{count.toLocaleString()}</p>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      <p className="text-xs text-ink-500">{hint}</p>
      {onClick && <p className="mt-1 text-xs font-medium text-harbor-600">Click to review →</p>}
    </Wrapper>
  );
}

function RowTable<T extends RowValidationResult>({
  title,
  rows,
  reasonFor,
}: {
  title: string;
  rows: T[];
  reasonFor: (row: T) => string;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-lg border border-sand-200 bg-white">
      <div className="border-b border-sand-200 bg-sand-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
        {title}
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-500">
            <tr>
              <th className="px-4 py-2">Row</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowNumber} className="border-t border-sand-100">
                <td className="px-4 py-2 font-ticket text-ink-700">#{r.rowNumber}</td>
                <td className="px-4 py-2 text-ink-700">{reasonFor(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
