import { findAdapterForUrl } from '@/lib/suppliers/registry';
import { isUrlAllowedByRobots, BOT_USER_AGENT } from '@/lib/suppliers/robots';
import type { ExtractionResult } from '@/lib/suppliers/types';

const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3MB — a page's HTML shell, not its assets
const FETCH_TIMEOUT_MS = 12000;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local, incl. cloud metadata endpoints
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
  /^::1$/,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((p) => p.test(hostname));
}

/**
 * Validates and normalizes a supplier URL. This is a lightweight SSRF guard
 * appropriate for a feature that has the server fetch an arbitrary,
 * agent-supplied URL: it rejects non-http(s) schemes and obviously-internal
 * hostnames (localhost, private IP ranges, the cloud metadata link-local
 * address). It does not attempt a full DNS-rebinding defense — that would
 * need request-time IP resolution and pinning, which is a reasonable
 * hardening step for Phase 16 (security review) once this ships behind
 * real traffic, not something to over-engineer into a v1 supplier import.
 */
function parseAndValidateUrl(raw: string): { url: URL | null; error: string | null } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { url: null, error: "That doesn't look like a valid URL. Make sure it starts with https://." };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { url: null, error: 'Only http:// and https:// URLs are supported.' };
  }
  if (isBlockedHost(url.hostname)) {
    return { url: null, error: 'This URL points to a restricted address and cannot be fetched.' };
  }
  return { url, error: null };
}

function classifyFetchFailure(status: number | null, err: unknown): string {
  if (status === 401 || status === 403) {
    return 'This page requires login or blocks automated access. Please copy the details manually instead.';
  }
  if (status === 404) {
    return "That page couldn't be found — double-check the URL.";
  }
  if (status && status >= 500) {
    return "The supplier's site had an error loading that page. Try again in a moment, or enter the details manually.";
  }
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return "The supplier's site took too long to respond. Try again, or enter the details manually.";
  }
  return "We couldn't reach that page. Please check the URL, or enter the details manually.";
}

const EXPECTED_FIELDS: { key: 'itinerary' | 'inclusions' | 'exclusions'; label: string }[] = [
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'inclusions', label: 'Inclusions' },
  { key: 'exclusions', label: 'Exclusions' },
];

/**
 * Fetches a supplier page (respecting robots.txt) and runs it through the
 * matching adapter. Never persists anything — the result is handed back to
 * the caller for the agent to review and edit, per spec. Every return path
 * is a normal ExtractionResult, never a thrown error, so the server action
 * calling this never needs its own try/catch for "extraction went wrong" —
 * only for truly unexpected failures.
 */
export async function extractFromSupplierUrl(rawUrl: string): Promise<ExtractionResult> {
  const { url, error: validationError } = parseAndValidateUrl(rawUrl);
  if (!url) return { ok: false, data: null, warnings: [], error: validationError };

  const allowed = await isUrlAllowedByRobots(url);
  if (!allowed) {
    return {
      ok: false,
      data: null,
      warnings: [],
      error: "This site's robots.txt disallows automated access to this page. Please copy the trip details manually.",
    };
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': `${BOT_USER_AGENT}/1.0 (+travel quotation assistant; contact agency admin)`,
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, data: null, warnings: [], error: classifyFetchFailure(res.status, null) };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return {
        ok: false,
        data: null,
        warnings: [],
        error: "That URL doesn't point to a web page we can read (unexpected content type).",
      };
    }

    // Cap how much we read rather than trusting Content-Length, which a
    // server can lie about or omit.
    const reader = res.body?.getReader();
    if (!reader) {
      html = await res.text();
    } else {
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          return { ok: false, data: null, warnings: [], error: 'That page is larger than we can process.' };
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      html = new TextDecoder('utf-8').decode(combined);
    }
  } catch (err) {
    return { ok: false, data: null, warnings: [], error: classifyFetchFailure(null, err) };
  }

  const adapter = findAdapterForUrl(url);
  const data = adapter.extract(html, url);

  if (!data) {
    return {
      ok: false,
      data: null,
      warnings: [],
      error: "We couldn't find enough structured information on this page — please copy the details manually.",
    };
  }

  const warnings: string[] = [];
  for (const field of EXPECTED_FIELDS) {
    if (data[field.key].length === 0) {
      warnings.push(`${field.label} wasn't found on the page — add it manually if the supplier lists one.`);
    }
  }
  if (!data.destination) {
    warnings.push("Destination couldn't be determined automatically — please fill it in.");
  }

  return { ok: true, data, warnings, error: null };
}
