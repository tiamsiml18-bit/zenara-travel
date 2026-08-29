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
  // quotation statuses
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
};

export function StatusBadge({ label }: { label: string }) {
  const tone = TONE_BY_STATUS[label] ?? 'bg-sand-200 text-ink-700';
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone)}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}
