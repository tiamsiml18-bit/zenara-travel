'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Check,
  CalendarClock,
  StickyNote,
  Copy,
  MessageCircle,
  Mail,
  ExternalLink,
  SkipForward,
  XCircle,
} from 'lucide-react';
import {
  completeFollowUpAction,
  rescheduleFollowUpAction,
  addFollowUpNoteAction,
  skipFollowUpAction,
  stopFollowUpAction,
} from '@/app/(app)/followups/actions';
import { sendFollowUpEmailAction } from '@/app/(app)/emails/actions';
import { EmailComposer } from '@/components/email/email-composer';
import { generateFollowUpEmail } from '@/lib/utils/email-templates';
import type { PipelineStage } from '@/lib/services/pipeline';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildFollowUpMessage } from '@/lib/utils/followup-message';
import { FOLLOWUP_OUTCOMES, FOLLOWUP_METHODS, OUTCOME_LABELS } from '@/lib/validation/followup';

export interface FollowUpCardData {
  id: string;
  due_date: string;
  status: string;
  outcome: string | null;
  method: string | null;
  notes: string | null;
  completed_at: string | null;
  sequence_number: number;
  client: { id: string; full_name: string; mobile_number: string | null; whatsapp_number: string | null; messenger_handle: string | null; email: string | null } | null;
  quotation: {
    id: string;
    quotation_number: string;
    pipeline_stage: string | null;
    current_version: {
      destination: string;
      travel_start_date: string;
      travel_end_date: string;
      total_price: number;
      consultant_name_snapshot: string | null;
      hotel_name: string | null;
      valid_until: string | null;
    } | null;
  } | null;
  agent: { id: string; full_name: string } | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function FollowUpCard({ followUp, gmailConnectedEmail }: { followUp: FollowUpCardData; gmailConnectedEmail: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openPanel, setOpenPanel] = useState<'complete' | 'reschedule' | 'note' | null>(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const client = followUp.client;
  const quotation = followUp.quotation;
  const destination = quotation?.current_version?.destination ?? 'their trip';
  const overdue = followUp.status !== 'completed' && isOverdue(followUp.due_date);

  const message = client
    ? buildFollowUpMessage({
        clientFirstName: client.full_name.split(' ')[0] ?? client.full_name,
        destination,
        quotationNumber: quotation?.quotation_number ?? '',
      })
    : '';

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className={clsx(
        'rounded-lg border bg-white p-4',
        overdue ? 'border-coral-500/40' : 'border-sand-200',
        followUp.status === 'completed' && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink-900">{client?.full_name ?? 'Unknown client'}</p>
            {overdue && (
              <span className="rounded-full bg-coral-500/10 px-2 py-0.5 text-[11px] font-medium text-coral-600">
                Overdue
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {quotation?.quotation_number} · {destination}
            {followUp.agent ? ` · ${followUp.agent.full_name}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-ticket text-sm text-ink-900">{formatDate(followUp.due_date)}</p>
          {followUp.status === 'completed' && (
            <p className="text-xs text-harbor-600">
              {followUp.outcome ? OUTCOME_LABELS[followUp.outcome as keyof typeof OUTCOME_LABELS] : 'Completed'}
            </p>
          )}
        </div>
      </div>

      {followUp.notes && (
        <p className="mt-2 whitespace-pre-line rounded bg-sand-50 px-2.5 py-1.5 text-xs text-ink-700">
          {followUp.notes}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-coral-600">{error}</p>}

      {/* Primary actions row — always visible, thumb-friendly on mobile */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {client && (
          <Link href={`/clients/${client.id}`} className="action-chip">
            <ExternalLink className="h-3.5 w-3.5" /> Client
          </Link>
        )}
        {quotation && (
          <Link href={`/quotations/${quotation.id}`} className="action-chip">
            <ExternalLink className="h-3.5 w-3.5" /> Quotation
          </Link>
        )}

        {followUp.status !== 'completed' && (
          <>
            <button className="action-chip-primary" onClick={() => setOpenPanel(openPanel === 'complete' ? null : 'complete')}>
              <Check className="h-3.5 w-3.5" /> Mark complete
            </button>
            <button className="action-chip" onClick={() => setOpenPanel(openPanel === 'reschedule' ? null : 'reschedule')}>
              <CalendarClock className="h-3.5 w-3.5" /> Reschedule
            </button>
            <button
              className="action-chip"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await skipFollowUpAction(followUp.id);
                  if (!result.ok) return setError(result.error);
                  router.refresh();
                })
              }
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
            <button
              className="action-chip"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Stop follow-up reminders?',
                  description: `This ends the automatic follow-up sequence for ${client?.full_name ?? 'this client'} — no further reminders will be scheduled unless the agent starts a new one manually.`,
                  confirmLabel: 'Stop',
                  tone: 'danger',
                });
                if (!ok) return;
                startTransition(async () => {
                  setError(null);
                  const result = await stopFollowUpAction(followUp.id);
                  if (!result.ok) return setError(result.error);
                  router.refresh();
                });
              }}
            >
              <XCircle className="h-3.5 w-3.5" /> Stop
            </button>
          </>
        )}
        <button className="action-chip" onClick={() => setOpenPanel(openPanel === 'note' ? null : 'note')}>
          <StickyNote className="h-3.5 w-3.5" /> Add note
        </button>
        <button className="action-chip" onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy message'}
        </button>
        {client?.messenger_handle && (
          <a
            className="action-chip"
            href={`https://m.me/${client.messenger_handle.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Messenger
          </a>
        )}
        {client?.whatsapp_number && (
          <a
            className="action-chip"
            href={`https://wa.me/${client.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {client?.email && (
          <button type="button" className="action-chip" onClick={() => setShowEmailComposer(true)}>
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        )}
      </div>

      {showEmailComposer && client?.email && (
        <FollowUpEmailComposer
          followUp={followUp}
          clientEmail={client.email}
          gmailConnectedEmail={gmailConnectedEmail}
          onClose={() => setShowEmailComposer(false)}
        />
      )}

      {/* Expandable panels */}
      {openPanel === 'complete' && (
        <CompletePanel
          followUpId={followUp.id}
          isPending={isPending}
          onSubmit={(payload) =>
            startTransition(async () => {
              setError(null);
              const result = await completeFollowUpAction(payload);
              if (!result.ok) return setError(result.error);
              setOpenPanel(null);
              router.refresh();
            })
          }
        />
      )}

      {openPanel === 'reschedule' && (
        <ReschedulePanel
          followUpId={followUp.id}
          isPending={isPending}
          onSubmit={(payload) =>
            startTransition(async () => {
              setError(null);
              const result = await rescheduleFollowUpAction(payload);
              if (!result.ok) return setError(result.error);
              setOpenPanel(null);
              router.refresh();
            })
          }
        />
      )}

      {openPanel === 'note' && (
        <NotePanel
          followUpId={followUp.id}
          isPending={isPending}
          onSubmit={(payload) =>
            startTransition(async () => {
              setError(null);
              const result = await addFollowUpNoteAction(payload);
              if (!result.ok) return setError(result.error);
              setOpenPanel(null);
              router.refresh();
            })
          }
        />
      )}

      {dialog}

      <style jsx>{`
        :global(.action-chip) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border-radius: 0.375rem;
          border: 1px solid #E5E7EB;
          padding: 0.35rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #576275;
        }
        :global(.action-chip:hover) {
          background-color: #F8F9FC;
        }
        :global(.action-chip-primary) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border-radius: 0.375rem;
          background-color: #5961C7;
          padding: 0.35rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #F8F9FC;
        }
        :global(.action-chip-primary:hover) {
          background-color: #3841b2;
        }
      `}</style>
    </div>
  );
}

function FollowUpEmailComposer({
  followUp,
  clientEmail,
  gmailConnectedEmail,
  onClose,
}: {
  followUp: FollowUpCardData;
  clientEmail: string;
  gmailConnectedEmail: string | null;
  onClose: () => void;
}) {
  const consultantFirstName = (followUp.quotation?.current_version?.consultant_name_snapshot ?? followUp.agent?.full_name ?? 'Your consultant').split(
    ' '
  )[0]!;
  const clientFirstName = (followUp.client?.full_name ?? 'there').split(' ')[0]!;
  const draft = generateFollowUpEmail({
    clientFirstName,
    destination: followUp.quotation?.current_version?.destination ?? 'your trip',
    consultantFirstName,
    followUpNumber: followUp.sequence_number,
    pipelineStage: (followUp.quotation?.pipeline_stage as PipelineStage | null) ?? null,
    hotelName: followUp.quotation?.current_version?.hotel_name ?? null,
    validUntil: followUp.quotation?.current_version?.valid_until ?? null,
  });

  return (
    <EmailComposer
      connectedEmail={gmailConnectedEmail}
      to={clientEmail}
      initialSubject={draft.subject}
      initialBody={draft.body}
      onClose={onClose}
      onSend={(subject, body) =>
        sendFollowUpEmailAction({
          followUpId: followUp.id,
          quotationId: followUp.quotation?.id ?? null,
          clientId: followUp.client?.id ?? '',
          to: clientEmail,
          subject,
          body,
          consultantFirstName,
          followUpNumber: followUp.sequence_number,
        })
      }
    />
  );
}

function CompletePanel({
  followUpId,
  isPending,
  onSubmit,
}: {
  followUpId: string;
  isPending: boolean;
  onSubmit: (payload: { followUpId: string; outcome: string; method: string; notes?: string }) => void;
}) {
  const [outcome, setOutcome] = useState<string>(FOLLOWUP_OUTCOMES[1] ?? FOLLOWUP_OUTCOMES[0] ?? 'interested');
  const [method, setMethod] = useState<string>(FOLLOWUP_METHODS[0]);
  const [notes, setNotes] = useState('');

  return (
    <div className="mt-3 space-y-2 rounded-md border border-sand-200 bg-sand-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="rounded-md border border-sand-200 px-2 py-1.5 text-sm">
          {FOLLOWUP_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-sand-200 px-2 py-1.5 text-sm">
          {FOLLOWUP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What happened? e.g. Client requested a lower price."
        rows={2}
        className="w-full rounded-md border border-sand-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSubmit({ followUpId, outcome, method, notes })}
        className="w-full rounded-md bg-harbor-700 py-1.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save outcome'}
      </button>
    </div>
  );
}

function ReschedulePanel({
  followUpId,
  isPending,
  onSubmit,
}: {
  followUpId: string;
  isPending: boolean;
  onSubmit: (payload: { followUpId: string; newDueDate: string }) => void;
}) {
  const [date, setDate] = useState('');

  return (
    <div className="mt-3 flex gap-2 rounded-md border border-sand-200 bg-sand-50 p-3">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="flex-1 rounded-md border border-sand-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={isPending || !date}
        onClick={() => onSubmit({ followUpId, newDueDate: date })}
        className="rounded-md bg-harbor-700 px-3 py-1.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}

function NotePanel({
  followUpId,
  isPending,
  onSubmit,
}: {
  followUpId: string;
  isPending: boolean;
  onSubmit: (payload: { followUpId: string; note: string }) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="mt-3 flex gap-2 rounded-md border border-sand-200 bg-sand-50 p-3">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Quick note…"
        className="flex-1 rounded-md border border-sand-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={isPending || !note.trim()}
        onClick={() => onSubmit({ followUpId, note })}
        className="rounded-md bg-harbor-700 px-3 py-1.5 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}
