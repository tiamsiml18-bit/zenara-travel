import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { buildClientErrorReport, isClientErrorLoggingActive, readBodyCapped } from '@/lib/diagnostics/client-error';

// TEMPORARY — see lib/diagnostics/client-error.ts for the purpose and the removal steps.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Receives sanitised browser-error reports from the quotation pages and writes
 * one line to the server runtime log. Never returns anything but {ok}.
 *  - 410 after the expiry date,
 *  - 401 for anyone who is not signed in (checked before the body is read),
 *  - 413 for oversized bodies (never fully buffered),
 *  - the report is rebuilt server-side from an allow-list and re-redacted.
 */
export async function POST(request: Request) {
  if (!isClientErrorLoggingActive()) {
    return NextResponse.json({ ok: false }, { status: 410 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const text = await readBodyCapped(request);
  if (text === null) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const report = buildClientErrorReport(parsed);
  if (!report) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // userRef is a short, non-reversible-in-practice prefix for telling sessions
  // apart in the log; it stays server-side and is never returned to the browser.
  console.error(
    '[client-error]',
    JSON.stringify({ ...report, userRef: user.id.slice(0, 8), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null })
  );
  return NextResponse.json({ ok: true });
}
