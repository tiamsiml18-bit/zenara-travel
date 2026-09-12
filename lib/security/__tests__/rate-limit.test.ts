import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before importing the module under test.
const mockRpc = vi.fn();
const mockHeadersGet = vi.fn();
const mockRegularCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => ({ get: mockHeadersGet }),
}));

vi.mock('@/lib/supabase/server-admin', () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

// The REGULAR (anon-key) client — intentionally mocked separately from
// the admin client above, so tests can assert it is never touched by
// this module (see "never touches the regular anon-key client at all").
vi.mock('@/lib/supabase/server', () => ({
  createClient: mockRegularCreateClient,
}));

import { rateLimitLogin, rateLimitPasswordReset } from '../rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockHeadersGet.mockReset();
    mockRegularCreateClient.mockReset();
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'x-forwarded-for') return '203.0.113.5';
      return null;
    });
  });

  describe('uses the service-role client, not the regular anon-key client', () => {
    it('calls createAdminClient() (service-role) rather than the regular createClient()', async () => {
      // The module under test imports createAdminClient from
      // '@/lib/supabase/server-admin' — if this were ever changed back to
      // the regular client, this mock wouldn't be hit and mockRpc would
      // never be called, so this test would fail with "expected mock
      // function to have been called".
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('agent@zenaratravel.com');
      expect(mockRpc).toHaveBeenCalled();
    });

    it('never touches the regular anon-key client at all', async () => {
      // Stronger proof than the test above: the regular client is mocked
      // to explicitly fail if it's ever invoked. If the module under test
      // were changed to import createClient from '@/lib/supabase/server'
      // instead of (or in addition to) createAdminClient, this would
      // throw and fail the test, rather than silently passing.
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
      expect(mockRegularCreateClient).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitLogin', () => {
    it('allows the attempt when both the per-email and per-IP checks pass', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
    });

    it('blocks the attempt when the per-email check fails, without a generic-message leak of which check failed', async () => {
      mockRpc.mockImplementation(async (_fn: string, args: any) => {
        if (String(args.p_key).startsWith('login:email:')) return { data: false, error: null };
        return { data: true, error: null };
      });
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.message).not.toMatch(/email|ip|address/i);
      }
    });

    it('blocks the attempt when the per-IP check fails even though the per-email check passes', async () => {
      mockRpc.mockImplementation(async (_fn: string, args: any) => {
        if (String(args.p_key).startsWith('login:ip:')) return { data: false, error: null };
        return { data: true, error: null };
      });
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(false);
    });

    it('normalizes email casing/whitespace so the same account cannot dodge its own limit, and stores it hashed rather than in plain text', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('  Agent@ZenaraTravel.com  ');
      const firstCallKey = mockRpc.mock.calls.find(([, args]) => String(args.p_key).startsWith('login:email:'))?.[1].p_key;

      mockRpc.mockClear();
      await rateLimitLogin('agent@zenaratravel.com');
      const secondCallKey = mockRpc.mock.calls.find(([, args]) => String(args.p_key).startsWith('login:email:'))?.[1].p_key;

      // Same account, differently-cased/whitespaced input -> identical key
      // (proves normalization happens before hashing, not after).
      expect(firstCallKey).toBe(secondCallKey);
      // The plain email must never appear in what's sent to the database.
      expect(firstCallKey).not.toContain('agent@zenaratravel.com');
      expect(firstCallKey).not.toContain('@');
    });

    it('keys login checks separately from password-reset checks (no shared bucket)', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('agent@zenaratravel.com');
      const keys = mockRpc.mock.calls.map(([, args]) => args.p_key);
      expect(keys.every((k: string) => k.startsWith('login:'))).toBe(true);
    });

    it('fails OPEN (allows the attempt) when the RPC call returns an error, so a DB hiccup never blocks all logins', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
    });

    it('fails OPEN when the RPC call throws', async () => {
      mockRpc.mockRejectedValue(new Error('network error'));
      const result = await rateLimitLogin('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
    });

    it('falls back to a fixed IP key rather than skipping the IP check when no IP header is present', async () => {
      mockHeadersGet.mockReturnValue(null);
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('agent@zenaratravel.com');
      const ipCall = mockRpc.mock.calls.find(([, args]) => String(args.p_key).startsWith('login:ip:'));
      // Still runs the IP check (doesn't skip it), just against a shared
      // fallback bucket rather than a real per-IP one.
      expect(ipCall).toBeDefined();
      expect(typeof ipCall?.[1].p_key).toBe('string');
      expect((ipCall?.[1].p_key as string).length).toBeGreaterThan('login:ip:'.length);
    });

    it('stores the IP hashed, never in plain text', async () => {
      mockHeadersGet.mockImplementation((name: string) => (name === 'x-forwarded-for' ? '203.0.113.5' : null));
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('agent@zenaratravel.com');
      const ipCall = mockRpc.mock.calls.find(([, args]) => String(args.p_key).startsWith('login:ip:'));
      expect(ipCall?.[1].p_key).not.toContain('203.0.113.5');
    });

    it('never sends the password itself, or anything beyond email/IP, to the rate limiter', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitLogin('agent@zenaratravel.com');
      for (const [, args] of mockRpc.mock.calls) {
        const serialized = JSON.stringify(args);
        expect(serialized).not.toMatch(/password/i);
      }
    });
  });

  describe('rateLimitPasswordReset', () => {
    it('allows the request when under the limit', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await rateLimitPasswordReset('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
    });

    it('blocks the request when the per-email check fails', async () => {
      mockRpc.mockImplementation(async (_fn: string, args: any) => {
        if (String(args.p_key).startsWith('pwreset:email:')) return { data: false, error: null };
        return { data: true, error: null };
      });
      const result = await rateLimitPasswordReset('agent@zenaratravel.com');
      expect(result.allowed).toBe(false);
    });

    it('blocks the request when the per-IP check fails', async () => {
      mockRpc.mockImplementation(async (_fn: string, args: any) => {
        if (String(args.p_key).startsWith('pwreset:ip:')) return { data: false, error: null };
        return { data: true, error: null };
      });
      const result = await rateLimitPasswordReset('agent@zenaratravel.com');
      expect(result.allowed).toBe(false);
    });

    it('uses password-reset-specific keys, never colliding with login keys', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitPasswordReset('agent@zenaratravel.com');
      const keys = mockRpc.mock.calls.map(([, args]) => args.p_key);
      expect(keys.every((k: string) => k.startsWith('pwreset:'))).toBe(true);
    });

    it('is stricter than login on the per-email limit (fewer max attempts)', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await rateLimitPasswordReset('agent@zenaratravel.com');
      const emailCall = mockRpc.mock.calls.find(([, args]) => String(args.p_key).startsWith('pwreset:email:'));
      const loginEmailMaxAttempts = 5; // documented login per-email limit
      expect(emailCall?.[1].p_max_hits).toBeLessThan(loginEmailMaxAttempts);
    });

    it('fails OPEN on RPC error, so a DB hiccup never blocks password recovery entirely', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
      const result = await rateLimitPasswordReset('agent@zenaratravel.com');
      expect(result.allowed).toBe(true);
    });
  });
});
