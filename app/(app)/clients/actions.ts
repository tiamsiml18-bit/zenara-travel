'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { clientSchema, clientNoteSchema } from '@/lib/validation/client';
import * as clientsService from '@/lib/services/clients';

function parseFormValues(formData: FormData) {
  return {
    fullName: formData.get('fullName'),
    mobileNumber: formData.get('mobileNumber'),
    email: formData.get('email'),
    messengerHandle: formData.get('messengerHandle'),
    instagramHandle: formData.get('instagramHandle'),
    whatsappNumber: formData.get('whatsappNumber'),
    sourceId: formData.get('sourceId'),
    destination: formData.get('destination'),
    travelStartDate: formData.get('travelStartDate'),
    travelEndDate: formData.get('travelEndDate'),
    numAdults: formData.get('numAdults'),
    numChildren: formData.get('numChildren'),
    quotedPrice: formData.get('quotedPrice') || undefined,
    statusId: formData.get('statusId'),
    assignedAgentId: formData.get('assignedAgentId'),
    notes: formData.get('notes'),
  };
}

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(parseFormValues(formData));

  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
    ) };
  }

  const supabase = await createSupabaseServerClient();
  let newId: string;
  try {
    newId = await clientsService.createClient(supabase, parsed.data, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create client.' };
  }

  revalidatePath('/clients');
  redirect(`/clients/${newId}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(parseFormValues(formData));

  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
    ) };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await clientsService.updateClient(supabase, clientId, parsed.data, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update client.' };
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

/**
 * Minimal inline client creation used by the "New client" tab of the
 * quotation wizard, so an agent never has to leave the quotation flow to
 * create the client it's for. Full client editing still happens on the
 * client profile page afterwards.
 */
export async function quickCreateClientAction(input: {
  fullName: string;
  mobileNumber?: string;
  email?: string;
  destination?: string;
  sourceId: string;
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: newLeadStatus } = await supabase
    .from('client_statuses')
    .select('id')
    .eq('name', 'New Lead')
    .single();

  const parsed = clientSchema.safeParse({
    fullName: input.fullName,
    mobileNumber: input.mobileNumber ?? '',
    email: input.email ?? '',
    sourceId: input.sourceId,
    destination: input.destination ?? '',
    numAdults: 1,
    numChildren: 0,
    statusId: newLeadStatus?.id ?? '',
    assignedAgentId: user.id,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid client details.' };
  }

  try {
    const clientId = await clientsService.createClient(supabase, parsed.data, user.id);
    return { ok: true, clientId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create client.' };
  }
}

export async function addClientNoteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = clientNoteSchema.safeParse({
    clientId: formData.get('clientId'),
    note: formData.get('note'),
  });
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  await clientsService.addClientNote(supabase, parsed.data.clientId, parsed.data.note, user.id);
  revalidatePath(`/clients/${parsed.data.clientId}`);
}

/**
 * Archiving is a "major change" per the confirmation policy — the button
 * that calls this is gated by a confirm dialog client-side; this action
 * itself doesn't ask again, it just executes once called.
 */
export async function archiveClientAction(clientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await clientsService.archiveClient(supabase, clientId, user.id);
    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to archive client.' };
  }
}
