import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

export async function listAllUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, manager_id, is_active, created_at')
    .order('full_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Note: this only updates the `public.users` profile row (role, manager,
 * active flag). Provisioning the underlying `auth.users` row (inviting a new
 * person by email) requires the Supabase Auth admin API, which needs the
 * service-role key — see lib/supabase/server-admin.ts. That invite flow is
 * intentionally out of scope here: with four known agents at launch, the
 * pragmatic v1 approach is to create their auth accounts directly in the
 * Supabase dashboard once, then manage role/status from this screen
 * thereafter. A self-serve "invite teammate" flow is a reasonable Phase 2
 * addition once the team grows past manual onboarding.
 */
export async function updateUserRoleAndStatus(
  supabase: SupabaseClient,
  userId: string,
  updates: { role: 'admin' | 'manager' | 'agent'; managerId: string | null; isActive: boolean },
  actingUserId: string
) {
  const { error } = await supabase
    .from('users')
    .update({ role: updates.role, manager_id: updates.managerId, is_active: updates.isActive })
    .eq('id', userId);
  if (error) throw new Error(`Failed to update user: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'user.updated',
    entityType: 'user',
    entityId: userId,
    metadata: updates,
  });
}
