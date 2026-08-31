'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { EmailComposer } from '@/components/email/email-composer';
import { sendQuotationEmailAction } from '@/app/(app)/emails/actions';

export function SendQuotationEmailButton({
  quotationId,
  connectedEmail,
  clientEmail,
  subject,
  body,
  consultantFirstName,
  attachmentLabel,
}: {
  quotationId: string;
  connectedEmail: string | null;
  clientEmail: string | null;
  subject: string;
  body: string;
  consultantFirstName: string;
  attachmentLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (!clientEmail) return null; // nothing to send to — the client has no email on file

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
      >
        <Mail className="h-4 w-4" /> Send Email
      </button>

      {open && (
        <EmailComposer
          connectedEmail={connectedEmail}
          to={clientEmail}
          initialSubject={subject}
          initialBody={body}
          attachmentLabel={attachmentLabel}
          onClose={() => setOpen(false)}
          onSend={(s, b) => sendQuotationEmailAction({ quotationId, to: clientEmail, subject: s, body: b, consultantFirstName })}
        />
      )}
    </>
  );
}
