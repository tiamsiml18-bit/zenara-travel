import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { rateLimitPasswordReset } from '@/lib/security/rate-limit';

async function sendResetLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');

  // Same generic outcome either way (below) whether this was rate-limited
  // or actually sent — an attacker probing for valid addresses can't tell
  // the difference from the response, only from the eventual email itself
  // never arriving, which the volume limits above make expensive to
  // exploit at scale.
  const rateLimit = await rateLimitPasswordReset(email);
  if (!rateLimit.allowed) {
    return;
  }

  const headersList = await headers();
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Always show the same confirmation, whether or not the email exists,
  // so this endpoint can't be used to enumerate registered users.
}

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: { sent?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center font-display text-xl font-semibold text-ink-900">Reset your password</h1>
        <p className="mb-8 text-center text-sm text-ink-500">
          We'll email you a link to set a new one.
        </p>

        <form
          action={async (formData) => {
            'use server';
            await sendResetLink(formData);
          }}
          className="rounded-lg border border-sand-200 bg-surface p-6 shadow-card"
        >
          <div className="mb-5">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@zenaratravel.com"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Send reset link
          </button>
          <p className="mt-4 text-center text-xs text-ink-500">
            Check your inbox — if that email is registered, a link is on its way.
          </p>
        </form>
      </div>
    </div>
  );
}
