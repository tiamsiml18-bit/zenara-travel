'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Plain browser-history back, not a hardcoded parent route — appears on
 * every page via Topbar (see below), so it needs to work regardless of
 * which specific page it's rendered on rather than needing per-page
 * "where does back go" wiring. Falls back to the dashboard if there's
 * nothing in history to go back to (e.g., the page was opened directly).
 */
export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/dashboard');
        }
      }}
      title="Back"
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
