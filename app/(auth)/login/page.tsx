import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function login(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/dashboard');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent('Incorrect email or password.')}`);
  }

  redirect(redirectTo || '/dashboard');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-1 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-harbor-700 font-display text-lg font-semibold text-sand-50">
            Z
          </div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Zenara Travel and Tours</h1>
          <p className="text-sm text-ink-500">Sign in to your workspace</p>
        </div>

        <form action={login} className="rounded-lg border border-sand-200 bg-surface p-6 shadow-card">
          <input type="hidden" name="redirectTo" value={params.redirectTo ?? '/dashboard'} />

          {params.error && (
            <div className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
              {params.error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@zenaratravel.com"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 placeholder:text-ink-500/60 focus:ring-2"
            />
          </div>

          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-ink-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-harbor-500 hover:text-harbor-600">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 transition-colors hover:bg-harbor-600"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
