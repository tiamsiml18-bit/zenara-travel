'use client';

import { useState } from 'react';
import { requestPasswordResetAction } from '@/app/(auth)/forgot-password/actions';
import { submitForgotPassword, type ForgotFormState } from '@/lib/auth/password-reset';

export function ForgotPasswordFormView({
  state,
  email,
  onEmailChange,
  onSubmit,
}: {
  state: ForgotFormState;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const submitting = state.status === 'submitting';
  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-sand-200 bg-surface p-6 shadow-card">
      {state.status === 'error' && (
        <div role="alert" className="mb-4 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">
          {state.message}
        </div>
      )}
      {state.status === 'success' && (
        <div role="status" className="mb-4 rounded-md border border-harbor-200 bg-harbor-50 px-3 py-2 text-sm text-harbor-800">
          {state.message}
        </div>
      )}
      <div className="mb-5">
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={submitting}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@zenaratravel.com"
          className="w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2 disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<ForgotFormState>({ status: 'idle' });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === 'submitting') return;
    setState({ status: 'submitting' });
    setState(await submitForgotPassword(email, requestPasswordResetAction));
  }

  return <ForgotPasswordFormView state={state} email={email} onEmailChange={setEmail} onSubmit={handleSubmit} />;
}
