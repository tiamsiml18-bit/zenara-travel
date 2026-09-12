import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server-admin';

/**
 * Rate limiting for pre-auth endpoints (login, password reset) — the two
 * places an attacker can hit repeatedly without ever having a session.
 * Backed by the `check_rate_limit` Postgres function, NOT an in-memory
 * counter: this app runs as Vercel serverless functions, which are
 * ephemeral and run as multiple concurrent instances with no shared
 * memory between them, so an in-memory map would silently fail to limit
 * anything in production — each instance would have its own, separately-
 * reset count. Postgres is this app's one existing, already-shared,
 * always-consistent store, so this reuses it rather than adding a new
 * Redis/Upstash dependency.
 *
 * Calls check_rate_limit() through createAdminClient() (the service-role
 * client), never the regular anon-key client. check_rate_limit() has NO
 * execute grant for anon/authenticated (see migration
 * 0065_lock_down_rate_limit_execute) specifically because it's a
 * PUBLIC-callable Postgres function whose parameters (key, max attempts,
 * window) are entirely caller-supplied — granting it to anon/authenticated
 * would let anyone invoke it directly via the Supabase RPC endpoint with
 * arbitrary parameters (e.g. an attacker-chosen victim's key with
 * max_attempts=0) to maliciously exhaust a specific person's bucket and
 * lock them out, without ever going through this application's login
 * form at all. Routing every call through the service-role client here
 * is what keeps that door closed while still letting the login/reset
 * flows use the function normally.
 *
 * Deliberately scoped to auth-only flows. Nothing here is wired into any
 * quotation/CRM server action, and nothing here changes how those work.
 */

/**
 * Best-effort client IP from the headers Vercel's edge network sets on
 * every request. `x-forwarded-for` can carry a comma-separated chain if
 * the request passed through multiple proxies — the first entry is the
 * original client. This is a defense-in-depth signal for catching one
 * source hitting many different accounts (password spraying); it is
 * deliberately NOT the only key (see rateLimitLogin/rateLimitPasswordReset
 * below), so a spoofed or missing IP header degrades to "email-only
 * limiting still applies," not "no limiting at all."
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headersList.get('x-real-ip');
  if (realIp) return realIp;
  // No IP header available (e.g. local dev without a proxy in front) —
  // fall back to a fixed key so the per-IP check still runs and still
  // groups same-origin requests together, rather than silently skipping
  // the IP-based check entirely.
  return 'unknown';
}

/**
 * Rate-limit keys are stored in a table that already has no RLS-readable
 * access for any application role (see migration 0062/0063) — but the
 * email address and IP are still, on their own, identifying information.
 * Hashing before storage means the stored key is meaningless without
 * already knowing the input, while remaining perfectly deterministic for
 * the same input, so the rate-limiting logic itself is unaffected. This
 * is the "store the minimum necessary" precaution, on top of (not instead
 * of) the RLS lockdown.
 */
function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export type RateLimitResult = { allowed: true } | { allowed: false; message: string };

/**
 * Runs a single named rate-limit check against `check_rate_limit`. Fails
 * OPEN on infrastructure error (the RPC call itself throwing, e.g. a
 * transient DB connectivity issue) — deliberately, not accidentally: this
 * app's login already depends on Supabase being reachable to authenticate
 * at all, so if Supabase is unreachable the login attempt fails on its own
 * regardless of what the rate limiter decides. Treating a rate-limiter
 * infrastructure error as "block everyone" would turn a transient,
 * unrelated hiccup into a full login outage for every legitimate staff
 * member, which is a worse outcome than the rate limiter occasionally
 * missing a check during a genuine incident. The failure is logged either
 * way so it isn't silent.
 */
async function checkOne(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max_hits: maxAttempts,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('[rate-limit] check_rate_limit RPC error, failing open:', error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error('[rate-limit] check_rate_limit threw, failing open:', err instanceof Error ? err.message : err);
    return true;
  }
}

const GENERIC_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';

/**
 * Login protection — two independent checks, both must pass:
 *
 *  - Per-email: 5 attempts / 15 minutes. Stops brute-force / credential
 *    stuffing against ONE account, including from many different IPs
 *    (distributed attempts against one account).
 *  - Per-IP: 20 attempts / 15 minutes, counted across ALL emails tried
 *    from that source. Stops one attacker password-spraying across many
 *    different staff accounts, which a per-email-only limit would never
 *    catch (each individual email would still be "under its own limit").
 *
 * The per-IP number is deliberately looser than per-email: a small office
 * can have several staff behind one shared/NAT'd IP, and normal mistyped
 * passwords across a handful of people sharing a connection should not
 * lock out the whole office. Keyed by an explicit "login" action prefix
 * so this never shares a bucket with the password-reset checks below.
 */
export async function rateLimitLogin(email: string): Promise<RateLimitResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getClientIp();

  const emailOk = await checkOne(`login:email:${hashIdentifier(normalizedEmail)}`, 5, 15 * 60);
  if (!emailOk) return { allowed: false, message: GENERIC_MESSAGE };

  const ipOk = await checkOne(`login:ip:${hashIdentifier(ip)}`, 20, 15 * 60);
  if (!ipOk) return { allowed: false, message: GENERIC_MESSAGE };

  return { allowed: true };
}

/**
 * Password-reset protection — stricter than login on the per-email side
 * (3 / 15 min) since this triggers an outbound email; a real staff member
 * essentially never needs more than one or two reset requests in a row.
 * Per-IP is looser (10 / 15 min) for the same shared-office reasoning as
 * login, and exists specifically to stop one source from spamming reset
 * emails at many different staff addresses to harass them or probe which
 * addresses exist (the page itself already returns an identical response
 * either way — this closes the volume angle on top of that).
 */
export async function rateLimitPasswordReset(email: string): Promise<RateLimitResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getClientIp();

  const emailOk = await checkOne(`pwreset:email:${hashIdentifier(normalizedEmail)}`, 3, 15 * 60);
  if (!emailOk) return { allowed: false, message: GENERIC_MESSAGE };

  const ipOk = await checkOne(`pwreset:ip:${hashIdentifier(ip)}`, 10, 15 * 60);
  if (!ipOk) return { allowed: false, message: GENERIC_MESSAGE };

  return { allowed: true };
}
