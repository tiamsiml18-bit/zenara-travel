import { clsx } from 'clsx';

const TONE_BY_STATUS: Record<string, string> = {
  'New Lead': 'bg-harbor-100 text-harbor-700',
  Contacted: 'bg-harbor-100 text-harbor-700',
  'Quotation Draft': 'bg-sand-200 text-ink-700',
  'Quotation Sent': 'bg-harbor-100 text-harbor-700',
  'Follow-up Due': 'bg-coral-500/10 text-coral-600',
  Negotiating: 'bg-coral-500/10 text-coral-600',
  Confirmed: 'bg-green-100 text-green-700',
  Paid: 'bg-green-100 text-green-700',
  Cancelled: 'bg-sand-200 text-ink-500',
  Lost: 'bg-sand-200 text-ink-500',
  Expired: 'bg-sand-200 text-ink-500',
  // Quotation Status and Follow-up Status share these exact six stages —
  // one consistent status system, so this Title Case set is the only one
  // that should ever be passed in going forward (see PIPELINE_STAGE_LABELS
  // in lib/services/pipeline.ts, the single source for these labels).
  Sent: 'bg-harbor-100 text-harbor-700',
  Draft: 'bg-sand-200 text-ink-700',
  'No Response': 'bg-sand-200 text-ink-500',
  // Lowercase raw enum values, kept only so any already-rendered or
  // historical value still gets a real tone instead of the gray fallback.
  draft: 'bg-sand-200 text-ink-700',
  sent: 'bg-harbor-100 text-harbor-700',
  viewed: 'bg-harbor-100 text-harbor-700',
  follow_up: 'bg-coral-500/10 text-coral-600',
  negotiating: 'bg-coral-500/10 text-coral-600',
  confirmed: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-sand-200 text-ink-500',
  lost: 'bg-sand-200 text-ink-500',
  expired: 'bg-sand-200 text-ink-500',
  no_response: 'bg-sand-200 text-ink-500',
};

export function StatusBadge({ label }: { label: string }) {
  const tone = TONE_BY_STATUS[label] ?? 'bg-sand-200 text-ink-700';
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone)}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}
