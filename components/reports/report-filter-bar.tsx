'use client';

import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/services/pipeline';

// The same six stages Follow-up (pipeline) status uses — one consistent
// status system throughout the CRM.
const QUOTATION_STATUSES: PipelineStage[] = ['sent', 'negotiating', 'confirmed', 'paid', 'no_response', 'lost'];

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
  // Every dropdown and date field submits the form itself the instant it
  // changes — no separate "Apply" button. The destination text field is the
  // one thing that still needs a deliberate action (typing a partial word
  // shouldn't re-run the report on every keystroke), so pressing Enter
  // there still submits via the form's native behavior.
  const autoSubmit = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <form action="/reports" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-sand-200 bg-white p-4">
      <Field label="From">
        <input type="date" name="from" defaultValue={defaults.dateFrom} onChange={autoSubmit} className={inputClass} />
      </Field>
      <Field label="To">
        <input type="date" name="to" defaultValue={defaults.dateTo} onChange={autoSubmit} className={inputClass} />
      </Field>
      <Field label="Agent">
        <select name="agent" defaultValue={defaults.agent ?? ''} onChange={autoSubmit} className={inputClass}>
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
        <select name="status" defaultValue={defaults.status ?? ''} onChange={autoSubmit} className={inputClass}>
          <option value="">Any status</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PIPELINE_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Lead source">
        <select name="source" defaultValue={defaults.source ?? ''} onChange={autoSubmit} className={inputClass}>
          <option value="">Any source</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <a href="/reports" className="text-sm font-medium text-ink-500 hover:text-ink-900">
        Clear filters
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
