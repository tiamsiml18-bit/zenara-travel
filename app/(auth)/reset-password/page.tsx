import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PendingSubmitButton } from '@/components/auth/pending-submit-button';
import { describeRecoveryLinkError, LINK_MISSING_MESSAGE, validateNewPassword } from '@/lib/auth/password-reset';

async function updatePassword(formData: FormData) {
  'use server';
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const invalid = validateNewPassword(password, confirm);
  if (invalid) {
    redirect(`/reset-password?error=${encodeURIComponent(invalid)}`);
  }

  const supabase = await createClient();
  // The recovery link must have been opened first — without its session there
  // is nobody to change the password for.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/reset-password?link_error=invalid`);
  }

  // Supabase Auth hashes the new password before storing it.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string; error_code?: string; link_error?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `error` here is also used for form errors (length, mismatch) — those only
  // ever appear with a valid session, so a missing session means the link is the problem.
  const linkProblem = describeRecoveryLinkError({
    error_code: searchParams?.error_code,
    link_error: searchParams?.link_error,
    error: user ? undefined : searchParams?.error,
  });

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-8 text-center font-display text-xl font-semibold text-ink-900">Set a new password</h1>
          <div className="rounded-lg border border-sand-200 bg-surface p-6 shadow-card">
            <div role="alert" className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
              {linkProblem ?? LINK_MISSING_MESSAGE}
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-md bg-harbor-700 py-2 text-center text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center font-display text-xl font-semibold text-ink-900">Set a new password</h1>

        <form action={updatePassword} className="rounded-lg border border-sand-200 bg-surface p-6 shadow-card">
          {searchParams?.error && (
            <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
              {searchParams.error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-ink-700">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2"
            />
          </div>
          <PendingSubmitButton label="Update password" pendingLabel="Updating…" />
        </form>
      </div>
    </div>
  );
}
