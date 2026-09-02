'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { UploadStep, type ParsedSheet } from './upload-step';
import { ColumnMappingStep } from './column-mapping-step';
import { ReviewStep, type ReviewBucket } from './review-step';
import {
  autoMapHeaders,
  validateMappedRow,
  IMPORT_REQUIRED_FIELDS,
  type ImportField,
  type MappedRow,
  type NormalizedClientRow,
} from '@/lib/validation/import';
import { checkDuplicatesAction, commitImportAction } from '@/app/(app)/admin/import/actions';

type WizardStep = 'upload' | 'map' | 'validating' | 'review' | 'done';

/** Yields to the browser every CHUNK_SIZE rows so a 10-20k row sheet never blocks the UI thread in one long tick. */
const CHUNK_SIZE = 300;
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function ImportWizard({
  statuses,
  sources,
  agents,
}: {
  statuses: { name: string }[];
  sources: { name: string }[];
  agents: { full_name: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportField | ''>>({});
  const [buckets, setBuckets] = useState<ReviewBucket | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [commitError, setCommitError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const canProceedFromMapping = IMPORT_REQUIRED_FIELDS.every((f) => mappedFields.has(f));

  function handleParsed(parsed: ParsedSheet) {
    setSheet(parsed);
    setMapping(autoMapHeaders(parsed.headers));
    setStep('map');
  }

  async function handleValidate() {
    if (!sheet) return;
    setStep('validating');
    setValidationProgress(0);

    const lookups = {
      statusNames: new Set(statuses.map((s) => s.name)),
      agentNames: new Set(agents.map((a) => a.full_name)),
      sourceNames: new Set(sources.map((s) => s.name)),
    };

    const mappedRows: MappedRow[] = sheet.rows.map((row, i) => {
      const mapped: MappedRow = { __rowNumber: i + 2 }; // +2: header row is row 1
      for (const [header, field] of Object.entries(mapping)) {
        if (field) mapped[field] = row[header];
      }
      return mapped;
    });

    const valid: NormalizedClientRow[] = [];
    const invalid: ReviewBucket['invalid'] = [];
    const validationResults: ReturnType<typeof validateMappedRow>[] = [];

    for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
      const chunk = mappedRows.slice(i, i + CHUNK_SIZE);
      for (const row of chunk) {
        const result = validateMappedRow(row, lookups);
        validationResults.push(result);
        if (result.row) valid.push(result.row);
        else invalid.push(result);
      }
      setValidationProgress(Math.min(100, Math.round(((i + chunk.length) / mappedRows.length) * 100)));
      await nextTick();
    }

    // Duplicates within the file itself, by email or mobile.
    const seenEmails = new Set<string>();
    const seenMobiles = new Set<string>();
    const inFileValid: NormalizedClientRow[] = [];
    const inFileDupes: ReviewBucket['duplicates'] = [];
    for (const row of valid) {
      const emailKey = row.email?.toLowerCase();
      const mobileKey = row.mobileNumber ?? undefined;
      const isDupe = (emailKey && seenEmails.has(emailKey)) || (mobileKey && seenMobiles.has(mobileKey));
      if (isDupe) {
        inFileDupes.push({
          rowNumber: row.rowNumber,
          row,
          errors: [],
          warnings: [],
          duplicateReason: 'Same email or mobile number appears earlier in this file.',
        });
      } else {
        if (emailKey) seenEmails.add(emailKey);
        if (mobileKey) seenMobiles.add(mobileKey);
        inFileValid.push(row);
      }
    }

    // Duplicates against the database.
    const emailsToCheck = inFileValid.map((r) => r.email).filter((e): e is string => Boolean(e));
    const mobilesToCheck = inFileValid.map((r) => r.mobileNumber).filter((m): m is string => Boolean(m));
    const dupCheck = await checkDuplicatesAction(emailsToCheck, mobilesToCheck);

    const finalValid: NormalizedClientRow[] = [];
    const dbDupes: ReviewBucket['duplicates'] = [];
    if (dupCheck.ok) {
      const dupEmailSet = new Set(dupCheck.duplicateEmails);
      const dupMobileSet = new Set(dupCheck.duplicateMobiles);
      for (const row of inFileValid) {
        const isDupe = (row.email && dupEmailSet.has(row.email.toLowerCase())) || (row.mobileNumber && dupMobileSet.has(row.mobileNumber));
        if (isDupe) {
          dbDupes.push({
            rowNumber: row.rowNumber,
            row,
            errors: [],
            warnings: [],
            duplicateReason: 'A client with this email or mobile number already exists.',
          });
        } else {
          finalValid.push(row);
        }
      }
    } else {
      // If the duplicate check itself fails (network/auth), fail safe: treat
      // nothing as a confirmed duplicate rather than silently skipping rows
      // the admin never got to see a reason for.
      finalValid.push(...inFileValid);
    }

    const finalValidRowNumbers = new Set(finalValid.map((r) => r.rowNumber));
    setBuckets({
      valid: validationResults.filter((r) => r.row && finalValidRowNumbers.has(r.rowNumber)),
      duplicates: [...inFileDupes, ...dbDupes],
      invalid,
    });
    setStep('review');
  }

  function handleCommit() {
    if (!buckets) return;
    setCommitError(null);
    const rowsToImport = buckets.valid.map((v) => v.row).filter((r): r is NormalizedClientRow => Boolean(r));

    startTransition(async () => {
      const result = await commitImportAction(rowsToImport);
      if (!result.ok) {
        setCommitError(result.error);
        return;
      }
      setImportedCount(result.imported);
      setStep('done');
    });
  }

  return (
    <div className="max-w-4xl">
      {step === 'upload' && <UploadStep onParsed={handleParsed} />}

      {step === 'map' && sheet && (
        <div>
          <ColumnMappingStep sheet={sheet} mapping={mapping} onChange={setMapping} />
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
              disabled={!canProceedFromMapping}
              onClick={handleValidate}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              Validate {sheet.rows.length.toLocaleString()} rows
            </button>
          </div>
        </div>
      )}

      {step === 'validating' && (
        <div className="rounded-lg border border-sand-200 bg-surface p-10 text-center">
          <p className="mb-3 text-sm font-medium text-ink-900">Validating rows… {validationProgress}%</p>
          <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-sand-100">
            <div className="h-full bg-harbor-600 transition-all" style={{ width: `${validationProgress}%` }} />
          </div>
        </div>
      )}

      {step === 'review' && buckets && (
        <div>
          <ReviewStep buckets={buckets} />
          {commitError && (
            <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
              {commitError}
            </div>
          )}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('map')}
              className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
            >
              Back to mapping
            </button>
            <button
              type="button"
              disabled={isPending || buckets.valid.length === 0}
              onClick={handleCommit}
              className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-40"
            >
              {isPending ? 'Importing…' : `Import ${buckets.valid.length.toLocaleString()} clients`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-lg border border-sand-200 bg-surface p-10 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-harbor-600" strokeWidth={1.5} />
          <p className="mb-1 font-display text-lg font-semibold text-ink-900">
            {importedCount.toLocaleString()} client{importedCount !== 1 ? 's' : ''} imported
          </p>
          <p className="mb-5 text-sm text-ink-500">Each new client has an activity timeline noting they came in via import.</p>
          <button
            type="button"
            onClick={() => router.push('/clients')}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Go to clients
          </button>
        </div>
      )}
    </div>
  );
}
