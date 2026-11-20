'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  buildClientErrorReport,
  formatReportForDisplay,
  isClientErrorLoggingActive,
  postClientErrorReport,
} from '@/lib/diagnostics/client-error';

// TEMPORARY — see lib/diagnostics/client-error.ts. Catches errors thrown while
// rendering any /quotations/* page, reports a sanitised copy, and shows a plain
// message instead of the blank "Application error" screen. The shown details
// contain only the sanitised report fields — never a user id.
export default function QuotationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const details = useMemo(() => {
    const report = buildClientErrorReport({
      type: 'render',
      message: error.message,
      stack: error.stack,
      digest: error.digest ?? null,
      page: typeof window === 'undefined' ? '' : window.location.pathname,
      clientTs: Date.now(),
      ua: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    });
    return report ? formatReportForDisplay(report) : '';
  }, [error]);

  useEffect(() => {
    if (!isClientErrorLoggingActive()) return;
    postClientErrorReport({
      type: 'render',
      message: error.message,
      stack: error.stack ?? '',
      page: window.location.pathname,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl rounded-lg border border-sand-200 bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">Something went wrong on this page</h2>
        <p className="mt-2 text-sm text-ink-700">
          This page could not be displayed. You can try again, or go back to the quotations list.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Try again
          </button>
          <Link href="/quotations" className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
            Back to quotations
          </Link>
        </div>
        {details && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-ink-500">Technical details (safe to copy and send)</summary>
            <textarea readOnly value={details} rows={10} className="mt-2 w-full rounded-md border border-sand-200 bg-sand-50 p-2 font-mono text-xs text-ink-700" />
          </details>
        )}
      </div>
    </main>
  );
}
