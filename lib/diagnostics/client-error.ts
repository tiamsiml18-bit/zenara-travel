/**
 * TEMPORARY client-side error diagnostics for the quotation pages.
 *
 * Purpose: capture the real browser exception behind "Application error: a
 * client-side exception has occurred". Remove this whole feature (see the
 * five files listed in REMOVAL below) once the cause is found.
 *
 * Privacy: everything here is allow-list based. Only the fields built in
 * buildClientErrorReport() ever reach the log; free text is redacted and
 * truncated; the URL is reduced to its path. Nothing is read from cookies,
 * storage, forms, props or page text. The server runs this same redaction
 * again, so the browser is never trusted.
 *
 * REMOVAL: delete lib/diagnostics/client-error.ts,
 * app/api/diagnostics/client-error/route.ts, app/(app)/quotations/layout.tsx,
 * app/(app)/quotations/error.tsx and lib/diagnostics/__tests__/client-error.test.ts.
 * The feature also switches itself off after CLIENT_ERROR_LOGGING_EXPIRES_AT.
 */

export const CLIENT_ERROR_ENDPOINT = '/api/diagnostics/client-error';

/** 14 days after the feature was written (2026-11-20), Manila time. */
export const CLIENT_ERROR_LOGGING_EXPIRES_AT = Date.parse('2026-12-04T00:00:00+08:00');

export const MAX_CLIENT_ERROR_BODY_BYTES = 8 * 1024;

export function isClientErrorLoggingActive(now: number = Date.now()): boolean {
  return now < CLIENT_ERROR_LOGGING_EXPIRES_AT;
}

const REPORT_TYPES = ['error', 'unhandledrejection', 'resource', 'render'] as const;
export type ClientErrorType = (typeof REPORT_TYPES)[number];

export interface ClientErrorReport {
  type: ClientErrorType;
  /** Server receive time (ISO). The browser's own clock is reported separately and only as a number. */
  at: string;
  clientTs: number | null;
  /** Path only — never the query string or fragment. */
  page: string;
  quotationId: string | null;
  message: string;
  stack: string;
  source: string;
  digest: string | null;
  browser: string;
}

// Regex literals only — never new RegExp(template string). The production
// minifier corrupts "\\b" inside template strings, which silently disabled the
// key=value redaction in the built app while the unit tests still passed.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Removes anything that could identify a person or grant access from free text
 * (error messages and stack traces), then truncates it. Quotation/record ids
 * (UUIDs) are deliberately kept: they are random and are the point of the log.
 */
export function redactText(input: unknown, max: number): string {
  let s = typeof input === 'string' ? input : input == null ? '' : String(input);
  s = s
    // bearer tokens and JWTs first, so a "Authorization: Bearer x" header cannot leave the token behind
    .replace(/\bBearer\s+[\w.~+/=-]+/gi, 'Bearer [token]')
    .replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]*/g, '[token]')
    // key=value / key: value pairs for sensitive keys
    .replace(
      /\b(token|access_token|refresh_token|id_token|apikey|api_key|password|passwd|pwd|secret|authorization|email)(\s*[=:]\s*)("[^"]*"|'[^']*'|(?:Bearer\s+)?[^\s&,;)]+)/gi,
      '$1$2[redacted]'
    )
    // email addresses
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    // URL fragments, then every query string (React's minified-error URLs carry the offending text there)
    .replace(/(https?:\/\/[^\s#)]+)#[^\s)]*/g, '$1')
    .replace(/\?[\w\-.%=&+~/,;[\]*@!$']+/g, '')
    // phone-number-like digit runs (9+ digits, optional separators)
    .replace(/\+?\d(?:[\s().-]?\d){8,}/g, '[number]')
    // long opaque tokens (40+ chars) that are not UUIDs
    .replace(/\b(?![0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)[A-Za-z0-9_-]{40,}\b/gi, '[token]');
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
}

/** Reduces anything URL-like to its pathname. Never returns a query string or fragment. */
export function sanitizePath(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return '';
  let path = raw;
  try {
    path = new URL(raw, 'http://placeholder.invalid').pathname;
  } catch {
    path = raw.split(/[?#]/)[0] ?? '';
  }
  return redactText(path, 200);
}

/** Pulls the quotation id out of /quotations/<uuid>[/...]; null on /quotations/new and friends. */
export function extractQuotationId(pathname: string): string | null {
  const match = /^\/quotations\/([^/]+)/.exec(pathname);
  return match && UUID_RE.test(match[1]!) ? match[1]!.toLowerCase() : null;
}

/** "Chrome 131 / Windows" — family, major version and OS only; never the raw user-agent string. */
export function describeBrowser(ua: unknown): string {
  if (typeof ua !== 'string') return 'unknown';
  const ver = (re: RegExp) => re.exec(ua)?.[1]?.split('.')[0] ?? '?';
  const browser = /Edg\//.test(ua)
    ? `Edge ${ver(/Edg\/([\d.]+)/)}`
    : /OPR\//.test(ua)
      ? `Opera ${ver(/OPR\/([\d.]+)/)}`
      : /Firefox\//.test(ua)
        ? `Firefox ${ver(/Firefox\/([\d.]+)/)}`
        : /Chrome\//.test(ua)
          ? `Chrome ${ver(/Chrome\/([\d.]+)/)}`
          : /Safari\//.test(ua)
            ? `Safari ${ver(/Version\/([\d.]+)/)}`
            : 'other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  return `${browser} / ${os}`;
}

/**
 * Builds the only object that is ever logged or shown. Returns null for
 * anything that is not a plain object with a known type.
 */
export function buildClientErrorReport(raw: unknown, now: Date = new Date()): ClientErrorReport | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!(REPORT_TYPES as readonly string[]).includes(r.type as string)) return null;

  const page = sanitizePath(r.page);
  const digest = typeof r.digest === 'string' && /^[\w-]{1,40}$/.test(r.digest) ? r.digest : null;
  const clientTs = typeof r.clientTs === 'number' && Number.isFinite(r.clientTs) ? Math.trunc(r.clientTs) : null;
  const source = typeof r.source === 'string' ? sanitizePath(r.source.replace(/:\d+(:\d+)?$/, '')) + (/:\d+(:\d+)?$/.exec(r.source)?.[0] ?? '') : '';

  return {
    type: r.type as ClientErrorType,
    at: now.toISOString(),
    clientTs,
    page,
    quotationId: extractQuotationId(page),
    message: redactText(r.message, 500),
    stack: redactText(r.stack, 3000),
    source: source.slice(0, 300),
    digest,
    browser: describeBrowser(r.ua),
  };
}

/** Plain-text version shown on the error screen so it can be copied. Contains only report fields — no user id. */
export function formatReportForDisplay(report: ClientErrorReport): string {
  return [
    `time: ${report.at}`,
    `page: ${report.page}`,
    `quotation: ${report.quotationId ?? '-'}`,
    `type: ${report.type}`,
    `browser: ${report.browser}`,
    report.digest ? `digest: ${report.digest}` : null,
    `message: ${report.message}`,
    report.source ? `source: ${report.source}` : null,
    report.stack ? `stack:\n${report.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Reads a request body but gives up as soon as it exceeds the limit, so an
 * oversized payload is never fully buffered. Returns null when too large.
 */
export async function readBodyCapped(request: Request, maxBytes: number = MAX_CLIENT_ERROR_BODY_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    bytes.set(value, total - value.byteLength);
  }
  return new TextDecoder().decode(bytes.subarray(0, total));
}

/** Browser-side sender used by the error screen (the inline listener has its own copy of this logic). */
export function postClientErrorReport(report: Pick<ClientErrorReport, 'type' | 'message' | 'stack' | 'page' | 'digest'> & { source?: string }): void {
  try {
    const body = JSON.stringify({
      type: report.type,
      message: String(report.message ?? '').slice(0, 500),
      stack: String(report.stack ?? '').slice(0, 3000),
      source: String(report.source ?? '').slice(0, 300),
      page: report.page,
      digest: report.digest,
      clientTs: Date.now(),
      ua: navigator.userAgent.slice(0, 300),
    });
    void fetch(CLIENT_ERROR_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' }).catch(() => {});
  } catch {
    // Diagnostics must never throw.
  }
}

/**
 * Inline script placed in the quotations layout. It is plain ES5 and runs
 * during HTML parsing — before React hydrates — so it still works when the
 * app itself fails to start. It sends at most 5 distinct events per page load
 * and sends only the fields the server re-sanitises above.
 */
export const CLIENT_ERROR_LISTENER_SOURCE = `(function(){
if(window.__zenClientErr)return;window.__zenClientErr=1;
var ENDPOINT=${JSON.stringify(CLIENT_ERROR_ENDPOINT)},sent=0,seen={};
function send(type,msg,stack,src){
try{
if(sent>=5)return;
var key=type+'|'+msg+'|'+src;if(seen[key])return;seen[key]=1;sent++;
var body=JSON.stringify({type:type,message:String(msg||'').slice(0,500),stack:String(stack||'').slice(0,3000),source:String(src||'').slice(0,300),page:location.pathname,clientTs:Date.now(),ua:navigator.userAgent.slice(0,300)});
if(navigator.sendBeacon&&navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'})))return;
fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true,credentials:'same-origin'}).catch(function(){});
}catch(e){}
}
addEventListener('error',function(e){
try{
var t=e.target;
if(t&&t!==window&&(t.src||t.href)){send('resource','Failed to load <'+String(t.tagName||'').toLowerCase()+'>','',t.src||t.href);return;}
var er=e.error;
send('error',e.message||(er&&er.message),er&&er.stack,(e.filename||'')+':'+(e.lineno||0)+':'+(e.colno||0));
}catch(x){}
},true);
addEventListener('unhandledrejection',function(e){
try{var r=e.reason;send('unhandledrejection',(r&&r.message)||String(r),r&&r.stack,'');}catch(x){}
});
})();`;
