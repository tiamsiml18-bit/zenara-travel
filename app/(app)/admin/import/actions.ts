'use server';

import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import type { NormalizedClientRow } from '@/lib/validation/import';
import { findExistingContacts, getImportLookupMaps, bulkImportClients } from '@/lib/services/client-import';

export type CheckDuplicatesResult =
  | { ok: true; duplicateEmails: string[]; duplicateMobiles: string[] }
  | { ok: false; error: string };

/**
 * Called once, after client-side validation, with the emails/mobiles from
 * every structurally-valid row. Returns which of those already exist in the
 * database so the review screen can bucket rows into Valid / Duplicate /
 * Invalid before anything is written.
 */
export async function checkDuplicatesAction(emails: string[], mobiles: string[]): Promise<CheckDuplicatesResult> {
  await requireRole('admin');
  const supabase = await createSupabaseServerClient();
  try {
    const { emails: dupEmails, mobiles: dupMobiles } = await findExistingContacts(supabase, emails, mobiles);
    return { ok: true, duplicateEmails: [...dupEmails], duplicateMobiles: [...dupMobiles] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to check for duplicates.' };
  }
}

export type CommitImportResult = { ok: true; imported: number } | { ok: false; error: string };

/**
 * Final, explicit confirmation step — nothing is written to `clients` until
 * this is called, and it is only ever called from the wizard's "Import N
 * clients" button after the admin has seen the valid/duplicate/invalid
 * breakdown, matching the spec's "do not insert records until the admin
 * confirms."
 */
export async function commitImportAction(rows: NormalizedClientRow[]): Promise<CommitImportResult> {
  const user = await requireRole('admin');
  if (rows.length === 0) return { ok: false, error: 'No rows to import.' };
  if (rows.length > 20000) {
    return { ok: false, error: 'This batch is larger than the supported single-import limit (20,000 rows). Split the file and import in parts.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    const lookups = await getImportLookupMaps(supabase);
    const { imported } = await bulkImportClients(supabase, rows, lookups, user.id);
    return { ok: true, imported };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Import failed partway through — check the client list for what made it in before retrying the remainder.' };
  }
}
