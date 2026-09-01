import { clsx } from 'clsx';

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'negative';
}) {
  return (
    <div className="rounded-lg border border-sand-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={clsx(
          'font-ticket mt-1.5 text-2xl font-semibold',
          tone === 'positive' && 'text-harbor-700',
          tone === 'warning' && 'text-coral-500',
          tone === 'negative' && 'text-coral-600',
          tone === 'default' && 'text-ink-900'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
