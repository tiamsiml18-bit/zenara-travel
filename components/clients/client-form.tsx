'use client';

// React 18.3 (this project's pinned version) doesn't export useActionState
// from 'react' — that's a React 19 API. The React-18-compatible equivalents
// are useFormState and useFormStatus from 'react-dom'; useFormState gives us
// [state, formAction], and useFormStatus (which must be called from a
// component that is itself a descendant of the <form>, not the component
// that renders the form) gives us the pending flag — hence SubmitButton
// being its own small component below rather than reading isPending here.
import { useFormState, useFormStatus } from 'react-dom';
import type { FormState } from '@/app/(app)/clients/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

type Option = { id: string; name: string };
type Agent = { id: string; full_name: string };

// Per the confirmation policy: routine status progression (New Lead →
// Contacted → Quotation Sent → Negotiating, etc.) saves directly, but these
// terminal/high-stakes statuses get a confirmation — they represent a real
// business outcome, not just administrative progress.
const MAJOR_STATUS_NAMES = new Set(['Confirmed', 'Paid', 'Cancelled', 'Lost']);

export function ClientForm({
  action,
  sources,
  statuses,
  agents,
  defaultValues,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  sources: Option[];
  statuses: Option[];
  agents: Agent[];
  defaultValues?: Partial<{
    fullName: string;
    mobileNumber: string;
    email: string;
    messengerHandle: string;
    instagramHandle: string;
    whatsappNumber: string;
    sourceId: string;
    destination: string;
    travelStartDate: string;
    travelEndDate: string;
    numAdults: number;
    numChildren: number;
    quotedPrice: number | null;
    statusId: string;
    assignedAgentId: string;
    notes: string;
  }>;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);
  const err = (field: string) => state?.fieldErrors?.[field];
  const { confirm, dialog } = useConfirmDialog();

  // Only an existing client being edited has a "before" state worth
  // comparing against — a brand-new client's initial status/agent isn't a
  // "change" that needs confirming, per the policy (normal creation, and
  // normal edits, never show a popup; only edits to specific major fields
  // on an existing record do).
  const isEditing = Boolean(defaultValues?.assignedAgentId || defaultValues?.statusId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    if (isEditing) {
      const newAgentId = String(formData.get('assignedAgentId') ?? '');
      const newStatusId = String(formData.get('statusId') ?? '');
      const agentChanged = defaultValues?.assignedAgentId && newAgentId !== defaultValues.assignedAgentId;
      const newStatusName = statuses.find((s) => s.id === newStatusId)?.name;
      const statusChangedToMajor =
        defaultValues?.statusId &&
        newStatusId !== defaultValues.statusId &&
        newStatusName &&
        MAJOR_STATUS_NAMES.has(newStatusName);

      if (agentChanged || statusChangedToMajor) {
        const summary: { label: string; from: string; to: string }[] = [];
        if (agentChanged) {
          summary.push({
            label: 'Assigned agent',
            from: agents.find((a) => a.id === defaultValues?.assignedAgentId)?.full_name ?? '—',
            to: agents.find((a) => a.id === newAgentId)?.full_name ?? '—',
          });
        }
        if (statusChangedToMajor) {
          summary.push({
            label: 'Status',
            from: statuses.find((s) => s.id === defaultValues?.statusId)?.name ?? '—',
            to: newStatusName ?? '—',
          });
        }
        const ok = await confirm({
          title: 'Confirm this change?',
          description: 'This is a major change to the client record.',
          summary,
          confirmLabel: 'Save changes',
        });
        if (!ok) return;
      }
    }

    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {dialog}
      {state?.error && (
        <div className="rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
          {state.error}
        </div>
      )}

      <Section title="Contact">
        <Field label="Full name" name="fullName" error={err('fullName')} required>
          <input
            name="fullName"
            defaultValue={defaultValues?.fullName}
            required
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mobile number" name="mobileNumber" error={err('mobileNumber')}>
            <input name="mobileNumber" defaultValue={defaultValues?.mobileNumber} className={inputClass} />
          </Field>
          <Field label="Email" name="email" error={err('email')}>
            <input name="email" type="email" defaultValue={defaultValues?.email} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Messenger" name="messengerHandle" error={err('messengerHandle')}>
            <input name="messengerHandle" defaultValue={defaultValues?.messengerHandle} className={inputClass} />
          </Field>
          <Field label="Instagram" name="instagramHandle" error={err('instagramHandle')}>
            <input name="instagramHandle" defaultValue={defaultValues?.instagramHandle} className={inputClass} />
          </Field>
          <Field label="WhatsApp" name="whatsappNumber" error={err('whatsappNumber')}>
            <input name="whatsappNumber" defaultValue={defaultValues?.whatsappNumber} className={inputClass} />
          </Field>
        </div>
        <Field label="Lead source" name="sourceId" error={err('sourceId')} required>
          <select name="sourceId" defaultValue={defaultValues?.sourceId} required className={inputClass}>
            <option value="">Select a source&hellip;</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Trip">
        <Field label="Destination" name="destination" error={err('destination')}>
          <input name="destination" defaultValue={defaultValues?.destination} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Travel start date" name="travelStartDate" error={err('travelStartDate')}>
            <input
              name="travelStartDate"
              type="date"
              defaultValue={defaultValues?.travelStartDate}
              className={inputClass}
            />
          </Field>
          <Field label="Travel end date" name="travelEndDate" error={err('travelEndDate')}>
            <input
              name="travelEndDate"
              type="date"
              defaultValue={defaultValues?.travelEndDate}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Adults" name="numAdults" error={err('numAdults')}>
            <input
              name="numAdults"
              type="number"
              min={0}
              defaultValue={defaultValues?.numAdults ?? 1}
              className={inputClass}
            />
          </Field>
          <Field label="Children" name="numChildren" error={err('numChildren')}>
            <input
              name="numChildren"
              type="number"
              min={0}
              defaultValue={defaultValues?.numChildren ?? 0}
              className={inputClass}
            />
          </Field>
          <Field label="Quoted price (PHP)" name="quotedPrice" error={err('quotedPrice')}>
            <input
              name="quotedPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaultValues?.quotedPrice ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Ownership">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" name="statusId" error={err('statusId')} required>
            <select name="statusId" defaultValue={defaultValues?.statusId} required className={inputClass}>
              <option value="">Select a status&hellip;</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned agent" name="assignedAgentId" error={err('assignedAgentId')} required>
            <select
              name="assignedAgentId"
              defaultValue={defaultValues?.assignedAgentId}
              required
              className={inputClass}
            >
              <option value="">Select an agent&hellip;</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes" name="notes" error={err('notes')}>
          <textarea name="notes" rows={3} defaultValue={defaultValues?.notes} className={inputClass} />
        </Field>
      </Section>

      <div className="flex justify-end gap-3 border-t border-sand-200 pt-6">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

const inputClass =
  'w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-sand-200 bg-white p-5">
      <h2 className="font-display text-sm font-semibold text-ink-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-coral-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-coral-600">{error}</p>}
    </div>
  );
}
