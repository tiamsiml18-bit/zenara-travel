'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import * as emailService from '@/lib/services/email';

export type EmailActionResult = { ok: true } | { ok: false; error: string };

export async function sendQuotationEmailAction(input: {
  quotationId: string;
  to: string;
  subject: string;
  body: string;
  fromName: string;
}): Promise<EmailActionResult> {
  const user = await requireUser();
  if (!input.to || !input.subject.trim() || !input.body.trim()) {
    return { ok: false, error: 'Recipient, subject, and message are all required.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await emailService.sendQuotationEmail(supabase, input, user.id);
    revalidatePath(`/quotations/${input.quotationId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send email.' };
  }
}

export async function sendFollowUpEmailAction(input: {
  followUpId: string;
  quotationId: string | null;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  fromName: string;
  followUpNumber: number;
}): Promise<EmailActionResult> {
  const user = await requireUser();
  if (!input.to || !input.subject.trim() || !input.body.trim()) {
    return { ok: false, error: 'Recipient, subject, and message are all required.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await emailService.sendFollowUpEmail(supabase, input, user.id);
    revalidatePath('/followups');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send email.' };
  }
}
