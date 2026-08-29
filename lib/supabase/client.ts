import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Browser client — uses the anon key only. Every table it touches is
 * RLS-protected, so this client can never see data the signed-in user
 * isn't permitted to see, regardless of what a component asks for.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
