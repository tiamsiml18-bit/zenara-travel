'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { acknowledgeDocument } from '@/lib/services/privacy';
import { writeAudit } from '@/lib/services/audit';

/**
 * Any authenticated, active HIIKAP user can acknowledge a policy document
 * for themselves — this is intentionally NOT role-gated the way the
 * Agency Settings actions are, since every authorized user (not just
 * admins) needs to be able to acknowledge internal policies.
 */
export async function acknowledgePolicyAction(
  documentKey: string,
  documentVersion: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const result = await acknowledgeDocument(supabase, user.id, documentKey, documentVersion);
  if (!result.ok) return result;

  await writeAudit(supabase, {
    userId: user.id,
    action: 'policy.acknowledged',
    entityType: 'policy_acknowledgment',
    entityId: documentKey,
    metadata: { documentVersion },
  });

  revalidatePath('/settings/privacy-security');
  revalidatePath(`/settings/privacy-security/${documentKey}`);
  return { ok: true };
}
