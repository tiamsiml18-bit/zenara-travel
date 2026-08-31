import type { SupabaseClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
// Deliberately NOT NEXT_PUBLIC_SITE_URL — Next.js statically inlines
// NEXT_PUBLIC_* variables at BUILD time, even inside server-only files like
// this one, so a value changed in Vercel after the last build wouldn't
// take effect until a fresh build happens to re-embed it. A plain
// (non-public) variable is read from the real environment at runtime,
// every time, with a hardcoded fallback to the known production URL so
// this works even if the variable was never set at all.
const REDIRECT_URI = `${process.env.APP_URL ?? 'https://zenara-travel.vercel.app'}/api/auth/gmail/callback`;

// gmail.send is the actual permission being granted (matches the explicit
// "only what's needed to send" requirement); userinfo.email is a separate,
// much narrower scope that only reveals which account was connected (for
// display in Settings) — it grants no visibility into mail content at all,
// so adding it doesn't broaden what this app can actually do with Gmail.
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline', // required to receive a refresh_token, not just a short-lived access_token
    prompt: 'consent', // forces Google to re-issue a refresh_token even on a repeat connect
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Gmail access token: ${await res.text()}`);
  return res.json();
}

/** Fetches the connected Gmail account's actual address via Google's userinfo endpoint — used right after connecting, since the OAuth token response itself doesn't include it. */
export async function fetchConnectedEmailAddress(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch the connected Google account email.');
  const data = await res.json();
  return data.email as string;
}

export async function getGmailConnection(supabase: SupabaseClient) {
  const { data } = await supabase.from('email_connections').select('*').limit(1).maybeSingle();
  return data;
}

/**
 * Always returns a currently-valid access token, refreshing it first if the
 * cached one has expired (or is expiring within the next minute, to avoid a
 * race against Google's own clock). Persists the refreshed token back to
 * the DB so the next send doesn't need to refresh again.
 */
async function getValidAccessToken(
  supabase: SupabaseClient,
  connection: { id: string; refresh_token: string; access_token: string | null; access_token_expires_at: string | null }
): Promise<string> {
  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt < Date.now() + 60_000;

  if (connection.access_token && !isExpiringSoon) return connection.access_token;

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from('email_connections')
    .update({ access_token: refreshed.access_token, access_token_expires_at: newExpiresAt })
    .eq('id', connection.id);
  return refreshed.access_token;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Converts the agent's plain-text draft (as typed in the composer) into
 * clean, simply-styled HTML — paragraph spacing and a readable system font
 * instead of relying on each recipient's mail client's own plain-text
 * rendering, which is inconsistent (as seen: fine in light mode, cramped
 * in dark mode). This only changes how it's DISPLAYED, never the actual
 * wording — the natural, human phrasing the agent wrote is untouched.
 */
function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px 0;">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">
${paragraphs}
</div>`;
}

/** The multipart/alternative block (plain text + HTML) shared by both the with-attachment and without-attachment cases below. */
function buildAlternativePart(bodyText: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    textToHtml(bodyText),
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

export interface SendEmailInput {
  to: string;
  fromName: string; // the consultant's display name, e.g. "Leo · Zenara Travel and Tours"
  subject: string;
  bodyText: string;
  attachment?: { filename: string; content: Buffer; mimeType: string };
}

/**
 * Builds a raw RFC 2822 MIME message and sends it via the Gmail API's
 * messages.send endpoint. Sent "as" the connected Gmail account (Gmail
 * doesn't allow an arbitrary From address without domain verification),
 * with the consultant's name in the From header's display name — the
 * client sees a personal name, not a generic CRM address, even though the
 * underlying mailbox is the one shared account.
 */
export async function sendGmailMessage(supabase: SupabaseClient, input: SendEmailInput): Promise<{ id: string }> {
  const connection = await getGmailConnection(supabase);
  if (!connection) throw new Error('No Gmail account is connected. Connect one in Admin → Settings first.');

  const accessToken = await getValidAccessToken(supabase, connection);
  const mixedBoundary = `zenara_mixed_${Date.now()}`;
  const altBoundary = `zenara_alt_${Date.now()}`;

  const headers = [
    `From: "${encodeHeaderWord(input.fromName)}" <${connection.connected_email}>`,
    `To: ${input.to}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ];

  let raw: string;
  if (input.attachment) {
    // multipart/mixed (attachment) containing a multipart/alternative
    // (plain + HTML body) as its first part, then the attachment as the
    // second — the standard nesting for "styled email with a file
    // attached."
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    const attachmentBase64 = input.attachment.content.toString('base64');
    raw = [
      ...headers,
      '',
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      buildAlternativePart(input.bodyText, altBoundary),
      '',
      `--${mixedBoundary}`,
      `Content-Type: ${input.attachment.mimeType}; name="${input.attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${input.attachment.filename}"`,
      '',
      attachmentBase64,
      '',
      `--${mixedBoundary}--`,
    ].join('\r\n');
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    raw = [...headers, '', buildAlternativePart(input.bodyText, altBoundary)].join('\r\n');
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  return res.json();
}

/** RFC 2047 encoding for any header value that might contain non-ASCII characters (a "·" in a display name, a peso sign, etc.) — used for both the Subject and From display name, so neither can ever corrupt the raw MIME message. */
function encodeHeaderWord(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
}
