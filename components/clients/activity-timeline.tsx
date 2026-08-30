import Link from 'next/link';

const ICON_BY_TYPE: Record<string, string> = {
  client_created: '☀',
  quotation_created: '✉',
  quotation_sent: '➤',
  quotation_revised: '↻',
  quotation_duplicated: '⧉',
  quotation_status_changed: '◉',
  client_status_changed: '◉',
  followup_completed: '✓',
  booking_created: '✈',
  payment_added: '₱',
  note_added: '✎',
  manual: '✎',
};

export function ActivityTimeline({
  activities,
}: {
  activities: Array<{
    id: string;
    activity_type: string;
    description: string;
    created_at: string;
    related_quotation_id: string | null;
    user: { full_name: string } | null;
  }>;
}) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {activities.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-5 pl-1 last:pb-0">
          {i < activities.length - 1 && (
            <span className="absolute left-[15px] top-6 h-full w-px bg-sand-200" aria-hidden />
          )}
          <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white text-xs">
            {ICON_BY_TYPE[a.activity_type] ?? '•'}
          </span>
          <div className="pt-0.5">
            <p className="text-sm text-ink-900">
              {a.description}{' '}
              {a.related_quotation_id && (
                <Link href={`/quotations/${a.related_quotation_id}`} className="font-medium text-harbor-600 hover:underline">
                  View quotation
                </Link>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {new Date(a.created_at).toLocaleString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {a.user?.full_name ? ` · ${a.user.full_name}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
