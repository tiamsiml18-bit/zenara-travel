import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center font-display text-xl font-semibold text-ink-900">Reset your password</h1>
        <p className="mb-8 text-center text-sm text-ink-500">We'll email you a link to set a new one.</p>

        <ForgotPasswordForm />

        <p className="mt-4 text-center text-xs text-ink-500">
          <Link href="/login" className="hover:text-ink-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
