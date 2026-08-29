import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * SERVICE ROLE CLIENT — bypasses RLS entirely.
 *
 * Import this ONLY inside server-only modules under lib/services/*, and only
 * for the narrow set of operations RLS genuinely cannot express, e.g.:
 *   - atomic quotation-number sequence allocation
 *   - cross-tenant audit log writes
 *   - admin user provisioning (creating an auth.users row)
 *
 * NEVER import this in a Client Component, a file under app/**\/page.tsx
 * that isn't itself a trusted server action, or anything that could end up
 * in a client bundle. There is no runtime guard against misuse beyond
 * discipline + code review — treat every new import of this file as a
 * security review item.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL — admin client cannot be created.'
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
