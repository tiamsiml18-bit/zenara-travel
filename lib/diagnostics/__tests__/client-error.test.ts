import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/auth/session';
import { POST } from '@/app/api/diagnostics/client-error/route';
import {
  CLIENT_ERROR_LISTENER_SOURCE,
  CLIENT_ERROR_LOGGING_EXPIRES_AT,
  MAX_CLIENT_ERROR_BODY_BYTES,
  buildClientErrorReport,
  describeBrowser,
  extractQuotationId,
  formatReportForDisplay,
  isClientErrorLoggingActive,
  readBodyCapped,
  redactText,
  sanitizePath,
} from '@/lib/diagnostics/client-error';

const QID = '8ac65bef-bb96-4313-a82f-35c0e18748af';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.abcDEF123_-xyz';

describe('redactText', () => {
  it('redacts emails, phone numbers, JWTs, bearer tokens and key=value secrets', () => {
    const out = redactText(
      `Failed for juan@example.com phone +63 917 116 7177 and 09171167177 ${JWT} Authorization: Bearer abc.def-123 password=hunter2 access_token=zzz`,
      2000
    );
    for (const secret of ['juan@example.com', '7177', '09171167177', JWT, 'abc.def-123', 'hunter2', 'zzz']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[email]');
    expect(out).toContain('[number]');
  });

  it('strips URL query strings and fragments (including ?code= and React error args)', () => {
    const out = redactText(
      'at https://workspace.zenaratravelandtours.com/reset-password?code=abc123&x=1 and https://react.dev/errors/418?args[]=Juan%20Dela%20Cruz#frag',
      2000
    );
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('Juan');
    expect(out).not.toContain('frag');
    expect(out).toContain('react.dev/errors/418');
  });

  it('redacts long opaque tokens but keeps UUIDs and ordinary stack frames', () => {
    const token = 'A'.repeat(48);
    const out = redactText(`${token} quotation ${QID} at e (/_next/static/chunks/app/page-1f2a3b4c.js:1:2345)`, 2000);
    expect(out).not.toContain(token);
    expect(out).toContain(QID);
    expect(out).toContain('page-1f2a3b4c.js:1:2345');
  });

  it('keeps ordinary diagnostic text intact', () => {
    expect(redactText("TypeError: Cannot read properties of undefined (reading 'map')", 500)).toBe(
      "TypeError: Cannot read properties of undefined (reading 'map')"
    );
  });

  it('truncates and tolerates non-strings', () => {
    expect(redactText('word '.repeat(200), 500)).toHaveLength(500 + '…[truncated]'.length);
    expect(redactText('x'.repeat(600), 500)).toBe('[token]'); // an unbroken 600-char run is treated as an opaque token
    expect(redactText(undefined, 10)).toBe('');
    expect(redactText({ a: 1 }, 50)).toBe('[object Object]');
  });
});

describe('paths and ids', () => {
  it('reduces anything URL-like to a path with no query or fragment', () => {
    expect(sanitizePath(`https://x.example/quotations/${QID}?version=abc&token=zzz#top`)).toBe(`/quotations/${QID}`);
    expect(sanitizePath(`/quotations/${QID}?a=b`)).toBe(`/quotations/${QID}`);
    expect(sanitizePath(undefined)).toBe('');
  });

  it('extracts the quotation id only from a real quotation path', () => {
    expect(extractQuotationId(`/quotations/${QID}`)).toBe(QID);
    expect(extractQuotationId(`/quotations/${QID}/edit`)).toBe(QID);
    expect(extractQuotationId('/quotations/new')).toBeNull();
    expect(extractQuotationId('/clients/abc')).toBeNull();
  });

  it('describes the browser without keeping the raw user agent', () => {
    expect(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')).toBe('Chrome 131 / macOS');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox 120 / Windows');
    expect(describeBrowser(42)).toBe('unknown');
  });
});

describe('buildClientErrorReport', () => {
  const base = {
    type: 'error',
    message: 'boom for maria@example.com',
    stack: `Error: boom\n    at f (https://workspace.zenaratravelandtours.com/_next/static/chunks/a.js?v=secret:1:2)`,
    source: 'https://workspace.zenaratravelandtours.com/_next/static/chunks/a.js?v=secret:10:20',
    page: `/quotations/${QID}?version=zzz`,
    clientTs: 1_700_000_000_000,
    ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.0.0 Safari/537.36',
    userId: 'should-be-ignored',
    cookie: 'sb-token=should-be-ignored',
  };

  it('builds only the allow-listed fields, sanitised', () => {
    const report = buildClientErrorReport(base, new Date('2026-11-20T04:00:00Z'))!;
    expect(Object.keys(report).sort()).toEqual(['at', 'browser', 'clientTs', 'digest', 'message', 'page', 'quotationId', 'source', 'stack', 'type']);
    expect(report.at).toBe('2026-11-20T04:00:00.000Z');
    expect(report.page).toBe(`/quotations/${QID}`);
    expect(report.quotationId).toBe(QID);
    expect(report.browser).toBe('Chrome 131 / Windows');
    expect(report.source).toBe('/_next/static/chunks/a.js:10:20');
    const json = JSON.stringify(report);
    for (const secret of ['maria@example.com', 'secret', 'should-be-ignored', 'sb-token']) expect(json).not.toContain(secret);
  });

  it('rejects non-objects and unknown types', () => {
    expect(buildClientErrorReport(null)).toBeNull();
    expect(buildClientErrorReport('x')).toBeNull();
    expect(buildClientErrorReport([])).toBeNull();
    expect(buildClientErrorReport({ type: 'hack' })).toBeNull();
  });

  it('keeps a safe digest and drops an unsafe one', () => {
    expect(buildClientErrorReport({ type: 'render', digest: '1234567890' })!.digest).toBe('1234567890');
    expect(buildClientErrorReport({ type: 'render', digest: 'a b@c.com' })!.digest).toBeNull();
  });

  it('displays only report fields (no user reference)', () => {
    const text = formatReportForDisplay(buildClientErrorReport({ ...base, type: 'render', digest: '99' })!);
    expect(text).toContain(`quotation: ${QID}`);
    expect(text).toContain('digest: 99');
    expect(text).not.toMatch(/userRef|userId/);
  });
});

describe('readBodyCapped', () => {
  const req = (body: string, headers: Record<string, string> = {}) => new Request('http://x/api', { method: 'POST', body, headers });

  it('reads a small body', async () => {
    expect(await readBodyCapped(req('{"a":1}'))).toBe('{"a":1}');
  });

  it('rejects an oversized body by content-length and when streamed without one', async () => {
    const big = 'x'.repeat(MAX_CLIENT_ERROR_BODY_BYTES + 1);
    expect(await readBodyCapped(req(big))).toBeNull();
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(big));
        c.close();
      },
    });
    const noLength = new Request('http://x/api', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    expect(await readBodyCapped(noLength)).toBeNull();
  });
});

describe('POST /api/diagnostics/client-error', () => {
  const post = (body: unknown, raw?: string) =>
    POST(new Request('http://x/api/diagnostics/client-error', { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
  let logged: string[];

  beforeEach(() => {
    logged = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
    vi.mocked(getCurrentUser).mockResolvedValue({ id: '0123456789abcdef-user-id' } as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects unauthenticated requests without reading or logging anything', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await post({ type: 'error', message: 'x' });
    expect(res.status).toBe(401);
    expect(logged).toHaveLength(0);
  });

  it('rejects oversized payloads with 413 and logs nothing', async () => {
    const res = await post(null, JSON.stringify({ type: 'error', message: 'x'.repeat(MAX_CLIENT_ERROR_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect(logged).toHaveLength(0);
  });

  it('rejects malformed JSON and unknown report shapes', async () => {
    expect((await post(null, '{nope')).status).toBe(400);
    expect((await post({ type: 'mystery' })).status).toBe(400);
  });

  it('logs one sanitised line, with a short user reference, and returns only {ok}', async () => {
    const res = await post({ type: 'error', message: 'boom for maria@example.com', stack: `at x?code=abc`, page: `/quotations/${QID}?token=zzz`, ua: 'Chrome/131.0.0.0 Windows' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(logged).toHaveLength(1);
    const line = logged[0]!;
    expect(line.startsWith('[client-error] ')).toBe(true);
    expect(line).toContain(QID);
    expect(line).toContain('"userRef":"01234567"');
    expect(line).not.toContain('0123456789abcdef');
    for (const secret of ['maria@example.com', 'abc', 'zzz']) expect(line).not.toContain(secret);
  });

  it('switches itself off after the expiry date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(CLIENT_ERROR_LOGGING_EXPIRES_AT + 1);
    expect((await post({ type: 'error', message: 'x' })).status).toBe(410);
    expect(logged).toHaveLength(0);
  });
});

describe('expiry and listener', () => {
  it('is active now and expires 14 days after 2026-11-20', () => {
    expect(isClientErrorLoggingActive(Date.parse('2026-11-20T12:00:00+08:00'))).toBe(true);
    expect(isClientErrorLoggingActive(Date.parse('2026-12-03T23:59:59+08:00'))).toBe(true);
    expect(isClientErrorLoggingActive(Date.parse('2026-12-04T00:00:00+08:00'))).toBe(false);
  });

  it('the inline listener is syntactically valid, bounded, and reads no storage, cookies or forms', () => {
    expect(() => new Function(CLIENT_ERROR_LISTENER_SOURCE)).not.toThrow();
    expect(CLIENT_ERROR_LISTENER_SOURCE).not.toMatch(/localStorage|sessionStorage|document\.cookie|\.value\b|FormData|innerText|innerHTML/);
    expect(CLIENT_ERROR_LISTENER_SOURCE).toContain('sent>=5');
  });
});

describe('build safety', () => {
  it('uses regex literals only — the production minifier corrupts \\b inside new RegExp(`template`) strings', () => {
    const source = readFileSync(path.resolve(__dirname, '../client-error.ts'), 'utf8');
    expect(source).not.toMatch(/new RegExp\(\s*`/);
  });
});
