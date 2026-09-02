import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type UserRole = 'admin' | 'manager' | 'agent';

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  managerId: string | null;
  isActive: boolean;
}

/**
 * Loads the current authenticated user's app profile (role, team, etc).
 * Returns null if not authenticated. This is the ONLY place that should
 * read `users.role` for authorization decisions — components and server
 * actions call this rather than querying `users` themselves, so role logic
 * stays in one place.
 *
 * Wrapped in React's `cache()` because both the shared (app) layout AND
 * almost every individual page call requireUser() — without this, each
 * navigation ran the full auth check (a real network round trip to
 * Supabase's Auth server, plus a separate `users` table lookup) TWICE per
 * request, once for the layout and once for the page. `cache()` dedupes
 * repeated calls to the same function within a single request/render pass,
 * so no matter how many components call requireUser() while rendering one
 * page, the actual network work only happens once. This is the standard
 * Next.js App Router pattern for exactly this situation, not something
 * specific to this app.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, manager_id, is_active')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role as UserRole,
    managerId: profile.manager_id,
    isActive: profile.is_active,
  };
});

/**
 * Use at the top of any Server Component / Server Action that requires
 * an authenticated session. Redirects to /login rather than throwing,
 * since this is normal navigation, not an error state.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect('/login');
  }
  return user;
}

/**
 * Use inside Server Actions / route handlers that must only be reachable
 * by specific roles (e.g. admin settings, excel import). Throws rather
 * than redirecting, since these are typically called from a form action
 * and should surface as an explicit authorization error, not a silent
 * navigation change.
 */
export async function requireRole(...allowed: UserRole[]): Promise<AppUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new Error('You do not have permission to perform this action.');
  }
  return user;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
};
