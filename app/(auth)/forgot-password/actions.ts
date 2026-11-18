'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { rateLimitPasswordReset } from '@/lib/security/rate-limit';
import { requestPasswordReset, type ResetRequestResult } from '@/lib/auth/password-reset';
import { resolveSiteOrigin } from '@/lib/auth/site-origin';

export async function requestPasswordResetAction(email: string): Promise<ResetRequestResult> {
  const headersList = await headers();
  const origin = resolveSiteOrigin({
    requestOrigin: headersList.get('origin'),
    envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    isProduction: process.env.VERCEL_ENV === 'production',
  });

  const supabase = await createClient();
  return requestPasswordReset({ origin, rateLimit: rateLimitPasswordReset, supabase }, email);
}
