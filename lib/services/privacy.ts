import type { SupabaseClient } from '@supabase/supabase-js';
import { getPrivacyDocument } from '@/lib/content/privacy-documents';

// Deliberately the same pattern as lib/services/gmail.ts's REDIRECT_URI:
// plain (non-NEXT_PUBLIC) env var, read at runtime, with a hardcoded
// fallback to the known production URL.
export const APP_BASE_URL = process.env.APP_URL ?? 'https://zenara-travel.vercel.app';

/** Public, unauthenticated URL for the client-facing Privacy Notice. */
export const CLIENT_PRIVACY_NOTICE_URL = `${APP_BASE_URL}/privacy`;

export interface PolicyAcknowledgment {
  documentKey: string;
  documentVersion: string;
  acknowledgedAt: string;
}

/**
 * All of the current user's acknowledgments, keyed by document key, so
 * pages can quickly check "has this user acknowledged version X of
 * document Y" without a separate query per document.
 */
export async function getAcknowledgmentsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, PolicyAcknowledgment>> {
  const { data, error } = await supabase
    .from('policy_acknowledgments')
    .select('document_key, document_version, acknowledged_at')
    .eq('user_id', userId);

  if (error || !data) return {};

  const byKey: Record<string, PolicyAcknowledgment> = {};
  for (const row of data) {
    // A user could acknowledge more than one version over time; keep the
    // most recent acknowledgment per document key.
    const existing = byKey[row.document_key];
    if (!existing || row.acknowledged_at > existing.acknowledgedAt) {
      byKey[row.document_key] = {
        documentKey: row.document_key,
        documentVersion: row.document_version,
        acknowledgedAt: row.acknowledged_at,
      };
    }
  }
  return byKey;
}

export async function acknowledgeDocument(
  supabase: SupabaseClient,
  userId: string,
  documentKey: string,
  documentVersion: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // documentKey/documentVersion arrive as plain strings from a server
  // action call, which a crafted request could set to anything — validate
  // against the actual HIIKAP policy documents (lib/content) before
  // writing, rather than trusting the caller's input. This intentionally
  // doesn't touch the database schema or RLS: the unique constraint and
  // policies already correctly scope writes to the caller's own user_id,
  // this just stops junk document_key/document_version values from being
  // recorded in the first place.
  const document = getPrivacyDocument(documentKey);
  if (!document) {
    return { ok: false, error: 'Unknown policy document.' };
  }
  if (document.version !== documentVersion) {
    return { ok: false, error: 'This acknowledgment does not match the current version of this document. Please refresh and try again.' };
  }

  const { error } = await supabase
    .from('policy_acknowledgments')
    .upsert(
      { user_id: userId, document_key: documentKey, document_version: documentVersion },
      { onConflict: 'user_id,document_key,document_version', ignoreDuplicates: true }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Admin-only: every acknowledgment on file, most recent first — used for a
 * simple compliance view of who has (and hasn't) acknowledged the current
 * versions. Relies on the `policy_ack_select` RLS policy, which already
 * restricts this to admins; this function does not re-check role itself.
 */
export async function getAllAcknowledgments(supabase: SupabaseClient): Promise<
  Array<{ userId: string; userName: string; documentKey: string; documentVersion: string; acknowledgedAt: string }>
> {
  const { data, error } = await supabase
    .from('policy_acknowledgments')
    .select('user_id, document_key, document_version, acknowledged_at, users(full_name)')
    .order('acknowledged_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    userId: row.user_id,
    userName: row.users?.full_name ?? 'Unknown user',
    documentKey: row.document_key,
    documentVersion: row.document_version,
    acknowledgedAt: row.acknowledged_at,
  }));
}
