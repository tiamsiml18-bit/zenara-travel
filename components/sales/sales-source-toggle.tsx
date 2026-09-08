import Link from 'next/link';
import { clsx } from 'clsx';

const OPTIONS: { value: 'all' | 'crm' | 'historical'; label: string }[] = [
  { value: 'all', label: 'All Sales' },
  { value: 'crm', label: 'CRM Sales' },
  { value: 'historical', label: 'Historical Sales' },
];

/** A server-rendered link group (not a client toggle) so it composes naturally with the page's existing filter <form>/searchParams pattern — selecting a view is just another query param, same as every other filter here. */
export function SalesSourceToggle({ current, buildHref }: { current: 'all' | 'crm' | 'historical'; buildHref: (source: 'all' | 'crm' | 'historical') => string }) {
  return (
    <div className="inline-flex rounded-md border border-sand-200 bg-surface p-0.5">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={buildHref(o.value)}
          className={clsx(
            'rounded px-3 py-1.5 text-sm font-medium transition-colors',
            current === o.value ? 'bg-harbor-700 text-sand-50' : 'text-ink-700 hover:bg-sand-100'
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
