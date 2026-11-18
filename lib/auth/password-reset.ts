/**
 * Password-recovery logic, kept free of Next/Supabase imports so it can be
 * unit-tested. Tokens are generated, stored (hashed), time-limited and made
 * single-use by Supabase Auth itself; this app never sees or logs a token.
 */

export const RESET_SUCCESS_MESSAGE =
  "If that email address belongs to a Zenara account, a password reset link is on its way. The link works once and expires after a short time. Check your spam folder if you don't see it.";
export const RESET_INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';
export const RESET_RATE_LIMIT_MESSAGE = 'Too many reset requests. Please wait a few minutes and try again.';
export const RESET_SEND_FAILED_MESSAGE =
  "We couldn't send the reset email right now. Please try again in a few minutes.";
export const RESET_UNEXPECTED_MESSAGE = 'Something went wrong. Please try again.';

export type ResetRequestResult = { ok: true; message: string } | { ok: false; message: string };

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

interface ResetDeps {
  origin: string;
  rateLimit: (email: string) => Promise<{ allowed: true } | { allowed: false; message: string }>;
  supabase: {
    auth: {
      resetPasswordForEmail: (
        email: string,
        options: { redirectTo: string }
      ) => Promise<{ error: { status?: number; code?: string } | null }>;
    };
  };
}

/**
 * The response never says whether the address is registered (Supabase answers
 * the same either way), so this can't be used to discover accounts.
 */
export async function requestPasswordReset(deps: ResetDeps, rawEmail: string): Promise<ResetRequestResult> {
  const email = String(rawEmail ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, message: RESET_INVALID_EMAIL_MESSAGE };

  const limit = await deps.rateLimit(email);
  if (!limit.allowed) return { ok: false, message: RESET_RATE_LIMIT_MESSAGE };

  const { error } = await deps.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${deps.origin}/reset-password`,
  });

  if (error) {
    // Status and code only — never the email, a token or a link.
    console.error('[password-reset] request rejected', { status: error.status, code: error.code });
    const rateLimited = error.status === 429 || (error.code ?? '').includes('rate_limit');
    return { ok: false, message: rateLimited ? RESET_RATE_LIMIT_MESSAGE : RESET_SEND_FAILED_MESSAGE };
  }

  return { ok: true, message: RESET_SUCCESS_MESSAGE };
}

// ---- Reset link handling -------------------------------------------------

export const LINK_INVALID_MESSAGE =
  'This reset link is invalid or was already used. Reset links work once and must be opened in the same browser where you requested them. Request a new link below.';
export const LINK_EXPIRED_MESSAGE = 'This reset link has expired. Request a new link below.';
export const LINK_MISSING_MESSAGE = 'Your reset session is missing or has expired. Request a new link below.';

/** Friendly text for the problems Supabase / our callback can report in the URL, or null when there is none. */
export function describeRecoveryLinkError(params: {
  error?: string;
  error_code?: string;
  link_error?: string;
}): string | null {
  if (params.error_code === 'otp_expired') return LINK_EXPIRED_MESSAGE;
  if (params.link_error || params.error || params.error_code) return LINK_INVALID_MESSAGE;
  return null;
}

/** Exchanges the one-time `code` from the emailed link for a session. */
export async function completeRecoveryExchange(
  supabase: { auth: { exchangeCodeForSession: (code: string) => Promise<{ error: unknown }> } },
  code: string
): Promise<{ ok: boolean }> {
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

// ---- New password -----------------------------------------------------------

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message, or null when the new password and its confirmation are acceptable. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

// ---- Forgot-password form state ------------------------------------------

export type ForgotFormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

/** Validates, calls the request action and returns the final state; never throws. */
export async function submitForgotPassword(
  email: string,
  action: (email: string) => Promise<ResetRequestResult>
): Promise<ForgotFormState> {
  const trimmed = email.trim();
  if (!isValidEmail(trimmed.toLowerCase())) return { status: 'error', message: RESET_INVALID_EMAIL_MESSAGE };
  try {
    const result = await action(trimmed);
    return result.ok ? { status: 'success', message: result.message } : { status: 'error', message: result.message };
  } catch {
    return { status: 'error', message: RESET_UNEXPECTED_MESSAGE };
  }
}
