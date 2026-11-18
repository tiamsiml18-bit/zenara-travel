import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  requestPasswordReset,
  isValidEmail,
  describeRecoveryLinkError,
  completeRecoveryExchange,
  validateNewPassword,
  submitForgotPassword,
  RESET_SUCCESS_MESSAGE,
  RESET_INVALID_EMAIL_MESSAGE,
  RESET_RATE_LIMIT_MESSAGE,
  RESET_SEND_FAILED_MESSAGE,
  RESET_UNEXPECTED_MESSAGE,
  LINK_EXPIRED_MESSAGE,
  LINK_INVALID_MESSAGE,
} from '@/lib/auth/password-reset';

const ORIGIN = 'https://workspace.zenaratravelandtours.com';
const allow = async () => ({ allowed: true as const });

function deps(over: Partial<{ error: { status?: number; code?: string } | null; allowed: boolean }> = {}) {
  const resetPasswordForEmail = vi.fn(async () => ({ error: over.error ?? null }));
  const rateLimit = vi.fn(async () => (over.allowed === false ? { allowed: false as const, message: 'x' } : { allowed: true as const }));
  return { resetPasswordForEmail, rateLimit, d: { origin: ORIGIN, rateLimit, supabase: { auth: { resetPasswordForEmail } } } };
}

afterEach(() => vi.restoreAllMocks());

describe('isValidEmail', () => {
  it.each([['owner@example.com', true], ['a@b.co', true], ['', false], ['no-at-sign', false], ['a@b', false], ['a b@c.com', false]])('%s -> %s', (e, ok) => {
    expect(isValidEmail(e)).toBe(ok);
  });
});

describe('requestPasswordReset', () => {
  it('asks Supabase for a reset link that lands on the workspace reset page, and reports success', async () => {
    const { d, resetPasswordForEmail } = deps();
    const result = await requestPasswordReset(d, ' Owner@Example.com ');
    expect(result).toEqual({ ok: true, message: RESET_SUCCESS_MESSAGE });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
      redirectTo: 'https://workspace.zenaratravelandtours.com/reset-password',
    });
  });

  it('rejects an invalid email without calling the rate limiter or Supabase', async () => {
    const { d, resetPasswordForEmail, rateLimit } = deps();
    expect(await requestPasswordReset(d, 'nope')).toEqual({ ok: false, message: RESET_INVALID_EMAIL_MESSAGE });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('does not send when rate limited, and says so', async () => {
    const { d, resetPasswordForEmail } = deps({ allowed: false });
    expect(await requestPasswordReset(d, 'owner@example.com')).toEqual({ ok: false, message: RESET_RATE_LIMIT_MESSAGE });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('shows a rate-limit message when Supabase throttles the email (429 / over_email_send_rate_limit)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await requestPasswordReset(deps({ error: { status: 429 } }).d, 'owner@example.com')).toEqual({ ok: false, message: RESET_RATE_LIMIT_MESSAGE });
    expect(await requestPasswordReset(deps({ error: { code: 'over_email_send_rate_limit' } }).d, 'owner@example.com')).toEqual({ ok: false, message: RESET_RATE_LIMIT_MESSAGE });
  });

  it('shows a useful error when sending fails (e.g. SMTP failure) and logs only status/code — never the email', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await requestPasswordReset(deps({ error: { status: 500, code: 'unexpected_failure' } }).d, 'owner@example.com');
    expect(result).toEqual({ ok: false, message: RESET_SEND_FAILED_MESSAGE });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('owner@example.com');
    expect(JSON.stringify(spy.mock.calls)).toContain('unexpected_failure');
  });

  it('gives the same success response whether or not the address is registered (Supabase answers identically)', async () => {
    const a = await requestPasswordReset(deps().d, 'registered@example.com');
    const b = await requestPasswordReset(deps().d, 'unknown@example.com');
    expect(a).toEqual(b);
  });
});

describe('reset link handling (token expiry / single use are enforced by Supabase; the app must handle the outcomes)', () => {
  it('maps an expired link to the expiry message', () => {
    expect(describeRecoveryLinkError({ error: 'access_denied', error_code: 'otp_expired' })).toBe(LINK_EXPIRED_MESSAGE);
  });

  it('maps an invalid/used link or a failed code exchange to the generic link message', () => {
    expect(describeRecoveryLinkError({ link_error: 'invalid' })).toBe(LINK_INVALID_MESSAGE);
    expect(describeRecoveryLinkError({ error: 'access_denied' })).toBe(LINK_INVALID_MESSAGE);
  });

  it('shows nothing when there is no link problem', () => {
    expect(describeRecoveryLinkError({})).toBeNull();
  });

  it('a valid one-time code becomes a session; the same code a second time (already used) does not', async () => {
    const used = new Set<string>();
    const supabase = {
      auth: {
        exchangeCodeForSession: vi.fn(async (code: string) => {
          if (used.has(code)) return { error: { message: 'invalid flow state' } };
          used.add(code);
          return { error: null };
        }),
      },
    };
    expect(await completeRecoveryExchange(supabase, 'abc')).toEqual({ ok: true });
    expect(await completeRecoveryExchange(supabase, 'abc')).toEqual({ ok: false });
  });

  it('an expired code or a thrown error is a failed exchange, never an exception', async () => {
    expect(await completeRecoveryExchange({ auth: { exchangeCodeForSession: async () => ({ error: { message: 'expired' } }) } }, 'x')).toEqual({ ok: false });
    expect(await completeRecoveryExchange({ auth: { exchangeCodeForSession: async () => { throw new Error('boom'); } } }, 'x')).toEqual({ ok: false });
  });
});

describe('validateNewPassword', () => {
  it('requires at least 8 characters and a matching confirmation', () => {
    expect(validateNewPassword('short', 'short')).toBe('Password must be at least 8 characters.');
    expect(validateNewPassword('longenough', 'different1')).toBe('Passwords do not match.');
    expect(validateNewPassword('longenough', 'longenough')).toBeNull();
  });
});

describe('submitForgotPassword (the form\'s submit flow)', () => {
  it('validates before calling the server', async () => {
    const action = vi.fn();
    expect(await submitForgotPassword('bad', action)).toEqual({ status: 'error', message: RESET_INVALID_EMAIL_MESSAGE });
    expect(action).not.toHaveBeenCalled();
  });

  it('returns success with the server message', async () => {
    expect(await submitForgotPassword('owner@example.com', async () => ({ ok: true, message: 'sent' }))).toEqual({ status: 'success', message: 'sent' });
  });

  it('returns the server error message when the request fails', async () => {
    expect(await submitForgotPassword('owner@example.com', async () => ({ ok: false, message: 'nope' }))).toEqual({ status: 'error', message: 'nope' });
  });

  it('turns a thrown error (network/server failure) into a visible error, not a silent nothing', async () => {
    expect(await submitForgotPassword('owner@example.com', async () => { throw new Error('network'); })).toEqual({ status: 'error', message: RESET_UNEXPECTED_MESSAGE });
  });
});
