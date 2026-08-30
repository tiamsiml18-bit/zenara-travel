'use client';

import { useState } from 'react';
import { Eye, X, ExternalLink } from 'lucide-react';

/**
 * Opens the quotation PDF inline, in a modal over the current page, instead
 * of a new browser tab. Uses the exact same /api/quotations/[id]/pdf?preview=1
 * endpoint the "Download PDF" and old tab-based preview used — same bytes,
 * same generation path, just displayed differently.
 *
 * Desktop browsers render PDFs inside an <iframe> reliably. Mobile browsers
 * (iOS Safari especially) have a spottier history with this — sometimes
 * still triggering a download or a "tap to open" flow instead of smooth
 * inline viewing — so "Open in a new tab" stays available inside the modal
 * as a one-click fallback rather than being the only option.
 */
export function PdfPreviewButton({ quotationId }: { quotationId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pdfUrl = `/api/quotations/${quotationId}/pdf?preview=1`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
      >
        <Eye className="h-4 w-4" /> Preview
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4 sm:p-8">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-200 px-4 py-2.5">
              <span className="text-sm font-medium text-ink-700">Quotation preview</span>
              <div className="flex items-center gap-1">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-500 hover:bg-sand-100 hover:text-ink-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1.5 text-ink-500 hover:bg-sand-100 hover:text-ink-900"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe src={pdfUrl} title="Quotation PDF preview" className="flex-1 border-0" />
          </div>
        </div>
      )}
    </>
  );
}
