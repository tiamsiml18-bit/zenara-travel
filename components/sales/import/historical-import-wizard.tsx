'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { UploadStep, type ParsedSheet } from '@/components/admin/import/upload-step';
import { HistoricalColumnMappingStep } from './historical-column-mapping-step';
import {
  autoMapHistoricalHeaders,
  validateHistoricalMappedRow,
  HISTORICAL_IMPORT_REQUIRED_FIELDS,
  type HistoricalImportField,
  type HistoricalMappedRow,
  type NormalizedHistoricalRow,
  type HistoricalRowValidationResult,
} from '@/lib/validation/historical-sales-import';
import { validateHistoricalImportAction, commitHistoricalImportAction } from '@/app/(app)/sales/actions';

type WizardStep = 'upload' | 'map' | 'checking' | 'review' | 'done';

export function HistoricalImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, HistoricalImportField | ''>>({});
  const [valid, setValid] = useState<NormalizedHistoricalRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<HistoricalRowValidationResult[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<NormalizedHistoricalRow[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [openPanel, setOpenPanel] = useState<'duplicates' | 'invalid' | null>(null);

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const canProceedFromMapping = HISTORICAL_IMPORT_REQUIRED_FIELDS.every((f) => mappedFields.has(f));

  function handleParsed(parsed: ParsedSheet) {
    setSheet(parsed);
    setMapping(autoMapHistoricalHeaders(parsed.headers));
    setStep('map');
  }

  function handleCheck() {
    if (!sheet) return;
    setStep('checking');
    setCheckError(null);

    const mappedRows: HistoricalMappedRow[] = sheet.rows.map((row, i) => {
      const mapped: HistoricalMappedRow = { __rowNumber: i + 2 };
      for (const [header, field] of Object.entries(mapping)) {
        if (field) mapped[field] = row[header];
      }
      return mapped;
    });

    const clientValidated = mappedRows.map(validateHistoricalMappedRow);
    const clientValid = clientValidated.filter((r) => r.row !== null);
    const clientInvalid = clientValidated.filter((r) => r.row === null);

    startTransition(async () => {
      const result = await validateHistoricalImportAction(mappedRows);
      if (!result.ok) {
        setCheckError(result.error);
        setStep('map');
        return;
      }
      const duplicateSet = new Set(result.data!.duplicateRowNumbers);
      setValid(clientValid.map((r) => r.row!).filter((r) => !duplicateSet.has(r.rowNumber)));
      setDuplicateRows(clientValid.map((r) => r.row!).filter((r) => duplicateSet.has(r.rowNumber)));
      setInvalidRows(clientInvalid);
      setStep('review');
    });
  }

  function handleCommit() {
    setCommitError(null);
    startTransition(async () => {
      const result = await commitHistoricalImportAction(valid);
      if (!result.ok) {
        setCommitError(result.error);
        return;
      }
      setImportedCount(result.data?.imported ?? 0);
      setStep('done');
    });
  }

  return (
    <div className="max-w-4xl">
      {step === 'upload' && <UploadStep onParsed={handleParsed} />}

      {step === 'map' && sheet && (
        <div>
          {checkError && <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{checkError}</div>}
          <HistoricalColumnMappingStep sheet={sheet} mapping={mapping} onChange={setMapping} />
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => {
                setSheet(null);
                setStep('upload');
              }}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              Start over
            </button>
            <button
              type="button"
              disabled={!canProceedFromMapping || isPending}
              onClick={handleCheck}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              {isPending ? 'Checking…' : `Check ${sheet.rows.length.toLocaleString()} rows`}
            </button>
          </div>
        </div>
      )}

      {step === 'checking' && (
        <div className="rounded-lg border border-sand-200 bg-surface p-10 text-center">
          <p className="text-sm font-medium text-ink-900">Checking for duplicates…</p>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} tone="positive" label="Valid" count={valid.length} hint="Will be imported" />
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="warning"
              label="Duplicate"
              count={duplicateRows.length}
              hint="Already exist — skipped"
              onClick={duplicateRows.length > 0 ? () => setOpenPanel(openPanel === 'duplicates' ? null : 'duplicates') : undefined}
            />
            <SummaryCard
              icon={<XCircle className="h-5 w-5" />}
              tone="negative"
              label="Invalid"
              count={invalidRows.length}
              hint="Fix in the sheet and re-upload"
              onClick={invalidRows.length > 0 ? () => setOpenPanel(openPanel === 'invalid' ? null : 'invalid') : undefined}
            />
          </div>

          {openPanel === 'duplicates' && (
            <RowTable
              title="Duplicate rows (skipped) — same customer, invoice date, and reference already exist"
              rows={duplicateRows}
              reasonFor={() => 'Matches an existing Historical Sale.'}
            />
          )}
          {openPanel === 'invalid' && <RowTable title="Invalid rows (not imported)" rows={invalidRows} reasonFor={(r) => r.errors.join(' ')} />}

          {commitError && <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{commitError}</div>}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep('map')} className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
              Back to mapping
            </button>
            <button
              type="button"
              disabled={isPending || valid.length === 0}
              onClick={handleCommit}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              {isPending ? 'Importing…' : `Import ${valid.length.toLocaleString()} historical sales`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-lg border border-sand-200 bg-surface p-10 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-harbor-600" strokeWidth={1.5} />
          <p className="mb-1 font-display text-lg font-semibold text-ink-900">
            {importedCount.toLocaleString()} historical sale{importedCount !== 1 ? 's' : ''} imported
          </p>
          <p className="mb-5 text-sm text-ink-500">No quotations, clients, bookings, or payment records were created — these are Historical Sales entries only.</p>
          <button
            type="button"
            onClick={() => router.push('/sales?source=historical')}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Go to Historical Sales
          </button>
        </div>
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
    warning: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    negative: 'text-coral-600 bg-coral-500/10',
  }[tone];

  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-lg border border-sand-200 bg-surface p-4 text-left ${onClick ? 'cursor-pointer hover:bg-sand-50' : ''}`}
    >
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${toneClasses}`}>{icon}</div>
      <p className="font-ticket text-2xl font-semibold text-ink-900">{count.toLocaleString()}</p>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      <p className="text-xs text-ink-500">{hint}</p>
      {onClick && <p className="mt-1 text-xs font-medium text-harbor-600">Click to review →</p>}
    </Wrapper>
  );
}

function RowTable<T extends { rowNumber: number }>({ title, rows, reasonFor }: { title: string; rows: T[]; reasonFor: (row: T) => string }) {
  return (
    <div className="mb-5 overflow-hidden rounded-lg border border-sand-200 bg-surface">
      <div className="border-b border-sand-200 bg-sand-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">{title}</div>
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
