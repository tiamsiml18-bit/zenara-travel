'use client';

import { IMPORT_FIELDS, IMPORT_FIELD_LABELS, IMPORT_REQUIRED_FIELDS, type ImportField } from '@/lib/validation/import';
import type { ParsedSheet } from './upload-step';

export function ColumnMappingStep({
  sheet,
  mapping,
  onChange,
}: {
  sheet: ParsedSheet;
  mapping: Record<string, ImportField | ''>;
  onChange: (mapping: Record<string, ImportField | ''>) => void;
}) {
  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = IMPORT_REQUIRED_FIELDS.filter((f) => !mappedFields.has(f));

  return (
    <div>
      <p className="mb-4 text-sm text-ink-500">
        {sheet.rows.length.toLocaleString()} rows detected in <span className="font-medium text-ink-700">{sheet.fileName}</span>.
        We've guessed a mapping below — review it and adjust anything that's wrong.
      </p>

      {missingRequired.length > 0 && (
        <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
          Map a column to <strong>{missingRequired.map((f) => IMPORT_FIELD_LABELS[f]).join(', ')}</strong> before continuing.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Spreadsheet column</th>
              <th className="px-4 py-3">Sample value</th>
              <th className="px-4 py-3">Maps to</th>
            </tr>
          </thead>
          <tbody>
            {sheet.headers.map((header) => (
              <tr key={header} className="border-b border-sand-100 last:border-0">
                <td className="px-4 py-3 font-medium text-ink-900">{header}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-ink-500">
                  {sheet.rows[0]?.[header] || <span className="italic text-ink-500/60">empty</span>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={mapping[header] ?? ''}
                    onChange={(e) => onChange({ ...mapping, [header]: e.target.value as ImportField | '' })}
                    className="w-full rounded-md border border-sand-200 px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Don't import</option>
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {IMPORT_FIELD_LABELS[field]}
                        {IMPORT_REQUIRED_FIELDS.includes(field) ? ' (required)' : ''}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
