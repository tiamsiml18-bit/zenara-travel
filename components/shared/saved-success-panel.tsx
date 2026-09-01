import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export function SavedSuccessPanel({
  entityLabel,
  entityName,
  viewHref,
  onCreateAnother,
  onDuplicate,
  doneHref,
}: {
  /** e.g. "Tour" or "Package" */
  entityLabel: string;
  entityName: string;
  viewHref: string;
  onCreateAnother: () => void;
  onDuplicate: () => void;
  doneHref: string;
}) {
  return (
    <div className="max-w-2xl rounded-lg border border-harbor-200 bg-harbor-50 p-6 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-harbor-600" strokeWidth={1.5} />
      <p className="font-display text-base font-semibold text-ink-900">{entityLabel} saved successfully</p>
      <p className="mt-1 text-sm text-ink-500">&quot;{entityName}&quot; is ready.</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {/* The main action — per spec, creating another should never
            require going Back first. */}
        <button
          type="button"
          onClick={onCreateAnother}
          className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-white hover:bg-harbor-800"
        >
          Create Another {entityLabel}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-md border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          Duplicate {entityLabel}
        </button>
        <Link
          href={viewHref}
          className="rounded-md border border-sand-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          View {entityLabel}
        </Link>
        <Link href={doneHref} className="rounded-md px-4 py-2 text-sm font-medium text-ink-500 hover:bg-sand-100 hover:text-ink-900">
          Done
        </Link>
      </div>
    </div>
  );
}
