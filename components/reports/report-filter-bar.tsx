const QUOTATION_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'follow_up',
  'negotiating',
  'confirmed',
  'paid',
  'cancelled',
  'lost',
  'expired',
] as const;

const inputClass = 'rounded-md border border-sand-200 bg-white px-2.5 py-[0.45rem] text-[0.8125rem] text-ink-900';

export function ReportFilterBar({
  agents,
  sources,
  defaults,
}: {
  agents: { id: string; full_name: string }[];
  sources: { id: string; name: string }[];
  defaults: {
    dateFrom?: string;
    dateTo?: string;
    agent?: string;
    destination?: string;
    status?: string;
    source?: string;
  };
}) {
  return (
    <form action="/reports" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-sand-200 bg-white p-4">
      <Field label="From">
        <input type="date" name="from" defaultValue={defaults.dateFrom} className={inputClass} />
      </Field>
      <Field label="To">
        <input type="date" name="to" defaultValue={defaults.dateTo} className={inputClass} />
      </Field>
      <Field label="Agent">
        <select name="agent" defaultValue={defaults.agent ?? ''} className={inputClass}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Destination">
        <input
          name="destination"
          defaultValue={defaults.destination}
          placeholder="Any destination"
          className={`${inputClass} w-40`}
        />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={defaults.status ?? ''} className={inputClass}>
          <option value="">Any status</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Lead source">
        <select name="source" defaultValue={defaults.source ?? ''} className={inputClass}>
          <option value="">Any source</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600">
        Apply
      </button>
      <a href="/reports" className="text-sm font-medium text-ink-500 hover:text-ink-900">
        Reset
      </a>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</label>
      {children}
    </div>
  );
}
