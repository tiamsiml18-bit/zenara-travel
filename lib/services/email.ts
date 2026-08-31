import type { SupabaseClient } from '@supabase/supabase-js';
import { sendGmailMessage } from './gmail';
import { renderQuotationPdf, pdfFileName } from './pdf';
import { writeAudit } from './audit';

export interface SendQuotationEmailInput {
  quotationId: string;
  to: string;
  subject: string;
  body: string;
  fromName: string;
}

/**
 * Always attaches the CURRENT (latest) quotation PDF — renderQuotationPdf
 * reads the quotation's current_version_id, so a revision created after
 * this email button was last clicked is picked up automatically; there's
 * no separate "which PDF" choice to make.
 */
export async function sendQuotationEmail(supabase: SupabaseClient, input: SendQuotationEmailInput, actingUserId: string) {
  const { data: quotation, error } = await supabase
    .from('quotations')
    .select('quotation_number, client_id, current_version:quotation_versions!quotations_current_version_id_fkey(version_label)')
    .eq('id', input.quotationId)
    .single();
  if (error || !quotation) throw new Error('Quotation not found.');

  const versionLabel = (Array.isArray(quotation.current_version) ? quotation.current_version[0] : quotation.current_version)?.version_label ?? 'Original';
  const pdfBuffer = await renderQuotationPdf(supabase, input.quotationId);
  const filename = pdfFileName(quotation.quotation_number as string, versionLabel);

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  try {
    await sendGmailMessage(supabase, {
      to: input.to,
      fromName: input.fromName,
      subject: input.subject,
      bodyText: input.body,
      attachment: { filename, content: pdfBuffer, mimeType: 'application/pdf' },
    });
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : 'Failed to send email.';
  }

  await supabase.from('email_log').insert({
    quotation_id: input.quotationId,
    client_id: quotation.client_id,
    recipient_email: input.to,
    subject: input.subject,
    email_type: 'quotation',
    sent_by: actingUserId,
    status,
    error_message: errorMessage,
  });

  if (status === 'failed') throw new Error(errorMessage ?? 'Failed to send email.');

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.email_sent',
    entityType: 'quotation',
    entityId: input.quotationId,
    metadata: { to: input.to },
  });
}

export interface SendFollowUpEmailInput {
  followUpId: string;
  quotationId: string | null;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  fromName: string;
  followUpNumber: number;
}

/**
 * No PDF attachment here — a follow-up is a short check-in, not a resend of
 * the quotation (the client already has that from the original email).
 * Sending this never marks the follow-up itself complete; per spec, that's
 * still a separate, deliberate agent action.
 */
export async function sendFollowUpEmail(supabase: SupabaseClient, input: SendFollowUpEmailInput, actingUserId: string) {
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  try {
    await sendGmailMessage(supabase, {
      to: input.to,
      fromName: input.fromName,
      subject: input.subject,
      bodyText: input.body,
    });
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : 'Failed to send email.';
  }

  await supabase.from('email_log').insert({
    quotation_id: input.quotationId,
    client_id: input.clientId,
    follow_up_id: input.followUpId,
    recipient_email: input.to,
    subject: input.subject,
    email_type: 'followup',
    follow_up_number: input.followUpNumber,
    sent_by: actingUserId,
    status,
    error_message: errorMessage,
  });

  if (status === 'failed') throw new Error(errorMessage ?? 'Failed to send email.');

  await supabase.from('client_activities').insert({
    client_id: input.clientId,
    activity_type: 'email_sent',
    description: `Follow-up email #${input.followUpNumber} sent: "${input.subject}"`,
    user_id: actingUserId,
    related_quotation_id: input.quotationId,
  });
}

export async function getEmailHistory(supabase: SupabaseClient, quotationId: string) {
  const { data, error } = await supabase
    .from('email_log')
    .select('id, subject, email_type, follow_up_number, recipient_email, sent_at, status, sent_by:users(full_name)')
    .eq('quotation_id', quotationId)
    .order('sent_at', { ascending: false });
  if (error) throw new Error(`Failed to load email history: ${error.message}`);
  return data ?? [];
}
