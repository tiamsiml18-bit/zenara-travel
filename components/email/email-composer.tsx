'use client';

import { useState, useTransition } from 'react';
import { X, Paperclip } from 'lucide-react';

export function EmailComposer({
  connectedEmail,
  to,
  initialSubject,
  initialBody,
  attachmentLabel,
  onSend,
  onClose,
}: {
  connectedEmail: string | null;
  to: string;
  initialSubject: string;
  initialBody: string;
  attachmentLabel?: string;
  onSend: (subject: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!connectedEmail) {
    return (
      <Modal onClose={onClose} title="Email">
        <p className="text-sm text-ink-700">
          No Gmail account is connected yet. Ask an admin to connect one in{' '}
          <span className="font-medium">Admin → Settings</span> before sending email from the CRM.
        </p>
      </Modal>
    );
  }

  if (sent) {
    return (
      <Modal onClose={onClose} title="Email sent">
        <p className="text-sm text-ink-700">Your email to {to} has been sent.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
        >
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Compose email">
      <div className="space-y-3">
        {error && <div className="rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}

        <FieldRow label="From">
          <p className="text-sm text-ink-700">{connectedEmail}</p>
        </FieldRow>
        <FieldRow label="To">
          <p className="text-sm text-ink-700">{to}</p>
        </FieldRow>
        <FieldRow label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-sand-200 px-3 py-1.5 text-sm outline-none ring-harbor-400 focus:ring-2"
          />
        </FieldRow>
        <FieldRow label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
          />
        </FieldRow>
        {attachmentLabel && (
          <div className="flex items-center gap-1.5 rounded-md bg-sand-50 px-3 py-2 text-xs text-ink-500">
            <Paperclip className="h-3.5 w-3.5" /> {attachmentLabel}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-sand-200 px-4 py-2 text-sm hover:bg-sand-100">
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await onSend(subject, body);
              if (!result.ok) {
                setError(result.error ?? 'Failed to send email.');
                return;
              }
              setSent(true);
            })
          }
          className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Send Email'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-500 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">{label}</label>
      {children}
    </div>
  );
}
