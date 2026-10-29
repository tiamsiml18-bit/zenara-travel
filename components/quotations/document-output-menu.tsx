'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PdfPreviewButton } from '@/components/quotations/pdf-preview-button';
import {
  PDF_DOCUMENT_MODES,
  PDF_DOCUMENT_MODE_LABELS,
  PDF_SECTION_KEYS,
  PDF_SECTION_LABELS,
  emptySelectionMessage,
  hasAnySection,
  sectionsForMode,
  serializePdfOptions,
  type PdfAvailability,
  type PdfDocumentMode,
  type PdfSections,
} from '@/lib/utils/pdf-sections';

/**
 * Chooses WHICH document to generate from a quotation — Full Quotation,
 * Itinerary Only, Quotation Without Itinerary, or a Custom Selection of
 * sections — then previews or downloads it. Presentation only: the saved
 * quotation is never touched. Full Quotation (the default) produces exactly
 * the same URLs as before, so Preview/Download behave as they always did
 * until another option is picked.
 */
export function DocumentOutputMenu({
  quotationId,
  availability = null,
}: {
  quotationId: string;
  /** Which sections have content on this quotation. Null/absent = unknown, so nothing is blocked here (the PDF route still checks). */
  availability?: PdfAvailability | null;
}) {
  const [mode, setMode] = useState<PdfDocumentMode>('full');
  // Custom starts from the Full Quotation; the user unticks what they do not want.
  const [custom, setCustom] = useState<PdfSections>(() => sectionsForMode('full'));

  const sections = mode === 'custom' ? custom : sectionsForMode(mode);
  // Blocks both "nothing selected" and "everything selected is empty on this
  // quotation" (which would only print a bare header), with the reason.
  const blockedReason = availability ? emptySelectionMessage(sections, availability) : hasAnySection(sections) ? null : 'Select at least one section.';
  const canOutput = blockedReason === null;
  const query = serializePdfOptions(mode, sections);
  const downloadHref = `/api/quotations/${quotationId}/pdf${query ? `?${query}` : ''}`;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="flex flex-col gap-2">
        <select
          aria-label="Document"
          value={mode}
          onChange={(e) => setMode(e.target.value as PdfDocumentMode)}
          className="rounded-md border border-sand-200 bg-surface px-3 py-2 text-sm font-medium text-ink-700"
        >
          {PDF_DOCUMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {PDF_DOCUMENT_MODE_LABELS[m]}
            </option>
          ))}
        </select>

        {mode === 'custom' && (
          <fieldset className="rounded-md border border-sand-200 bg-surface p-3">
            <legend className="px-1 text-xs font-medium text-ink-500">Include in the PDF</legend>
            <div className="flex flex-col gap-1.5">
              {PDF_SECTION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={custom[key]}
                    onChange={(e) => setCustom((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {PDF_SECTION_LABELS[key]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {blockedReason && (
          <p role="status" className="max-w-xs text-xs text-red-600">
            {blockedReason}
          </p>
        )}
      </div>

      <PdfPreviewButton quotationId={quotationId} query={query} disabled={!canOutput} />

      {canOutput ? (
        <a
          href={downloadHref}
          className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          <Download className="h-4 w-4" /> Download PDF
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 opacity-50"
        >
          <Download className="h-4 w-4" /> Download PDF
        </span>
      )}
    </div>
  );
}
