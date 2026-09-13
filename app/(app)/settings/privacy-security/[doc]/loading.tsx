import { Loader2 } from 'lucide-react';

/**
 * Shown while a specific privacy/security document is being fetched and
 * server-rendered — covers exactly the moment between clicking a document
 * (or Back, or another document) and the new page appearing. Purely a
 * visual loading indicator; document content, layout, and the
 * acknowledgment flow are completely unchanged.
 */
export default function PrivacyDocumentLoading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
      <Loader2 className="h-6 w-6 animate-spin text-harbor-600" strokeWidth={1.75} />
      <p className="text-sm text-ink-500">Loading document…</p>
    </main>
  );
}
