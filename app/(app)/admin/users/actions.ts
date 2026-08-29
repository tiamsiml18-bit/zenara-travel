'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { updateUserRoleAndStatus } from '@/lib/services/users';

export async function updateUserAction(userId: string, formData: FormData) {
  const admin = await requireRole('admin');

  // An admin can't demote or deactivate their own account from this screen —
  // a simple guard against accidentally locking yourself out of admin
  // settings with no other admin around to undo it.
  if (userId === admin.id) {
    return { ok: false, error: "You can't change your own role or status here — ask another admin." };
  }

  const role = formData.get('role') as 'admin' | 'manager' | 'agent';
  const managerId = (formData.get('managerId') as string) || null;
  const isActive = formData.get('isActive') === 'on';

  const supabase = await createSupabaseServerClient();
  try {
    await updateUserRoleAndStatus(supabase, userId, { role, managerId, isActive }, admin.id);
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update user.' };
  }
}
