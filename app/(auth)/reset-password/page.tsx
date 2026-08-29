import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function updatePassword(formData: FormData) {
  'use server';
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent('Password must be at least 8 characters.')}`);
  }
  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent('Passwords do not match.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export default function ResetPasswordPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center font-display text-xl font-semibold text-ink-900">Set a new password</h1>

        <form action={updatePassword} className="rounded-lg border border-sand-200 bg-white p-6 shadow-card">
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
          <button
            type="submit"
            className="w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
