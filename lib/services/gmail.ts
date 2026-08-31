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
  // Arial/Helvetica — the standard, universally-supported professional
  // email font, rendering identically and reliably across every mail
  // client rather than depending on each recipient's own OS system font.
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">
${paragraphs}
</div>`;
}

/**
 * The single source of truth for the business signature -- agency name,
 * website, phone, and WhatsApp all come from agency_settings (the same
 * row the Settings page manages), never hardcoded here and never a second
 * place an admin has to update. If a field is empty, its line is simply
 * omitted rather than showing a broken "Phone: null".
 */
async function getAgencySignatureData(supabase: SupabaseClient) {
  const { data } = await supabase.from('agency_settings').select('agency_name, website, phone, whatsapp').limit(1).maybeSingle();

  return {
    agencyName: data?.agency_name ?? 'Zenara Travel and Tours',
    website: data?.website ?? null,
    phone: data?.phone ?? null,
    whatsapp: data?.whatsapp ?? null,
  };
}

export function normalizeWebsiteUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function toDialableNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function toWhatsAppUrl(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
}

export interface SignatureData {
  agencyName: string;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
}

/**
 * The plain-text fallback signature -- same information as the HTML
 * version below, just without the clickable links (plain text can't have
 * those), for mail clients that render text/plain. Just the business card
 * info -- the consultant already signed off personally in the message
 * body itself, so repeating their name here would be redundant.
 */
export function buildSignatureText(agency: SignatureData): string {
  const lines = [`${agency.agencyName}`];
  if (agency.website) lines.push(`Website: ${agency.website}`);
  if (agency.phone) lines.push(`Phone: ${agency.phone}`);
  if (agency.whatsapp) lines.push(`WhatsApp: ${agency.whatsapp}`);
  return `\n\n--\n${lines.join('\n')}`;
}

/**
 * The HTML signature -- agency name and clickable website/phone/WhatsApp
 * links. No logo: an inline logo image is exactly the kind of thing that
 * shows up as a broken icon depending on the mail client, image-loading
 * settings, or a hiccup with the hosted file, so this stays text-only and
 * always reliable. Kept deliberately compact: tight spacing, no color
 * blocks or graphics, so it reads as a professional signature rather than
 * a marketing banner.
 */
export function buildSignatureHtml(agency: SignatureData): string {
  const contactLines: string[] = [];
  if (agency.website) {
    contactLines.push(
      `Website: <a href="${normalizeWebsiteUrl(agency.website)}" style="color:#0b5b73;text-decoration:none;">${agency.website}</a>`
    );
  }
  if (agency.phone) {
    contactLines.push(`Phone: <a href="tel:${toDialableNumber(agency.phone)}" style="color:#0b5b73;text-decoration:none;">${agency.phone}</a>`);
  }
  if (agency.whatsapp) {
    contactLines.push(`WhatsApp: <a href="${toWhatsAppUrl(agency.whatsapp)}" style="color:#0b5b73;text-decoration:none;">${agency.whatsapp}</a>`);
  }

  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e0d8;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4a4a4a;">
<div style="font-weight:bold;color:#1a1a1a;">${escapeHtmlAttr(agency.agencyName)}</div>
${contactLines.join('<br>\n')}
</div>`;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


/** The multipart/alternative block (plain text + HTML) shared by both the with-attachment and without-attachment cases below. */
function buildAlternativePart(bodyText: string, boundary: string, agency: SignatureData): string {
  const plainBody = bodyText + buildSignatureText(agency);
  const htmlBody = textToHtml(bodyText) + buildSignatureHtml(agency);
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    plainBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

export interface SendEmailInput {
  to: string;
  consultantFirstName: string; // used only in the signature, never in the sender display name
  subject: string;
  bodyText: string;
  attachment?: { filename: string; content: Buffer; mimeType: string };
}

/**
 * Builds a raw RFC 2822 MIME message and sends it via the Gmail API's
 * messages.send endpoint. The sender display name is always the agency
 * name -- "Zenara Travel and Tours", never "Leo | Zenara Travel and
 * Tours" -- so every email looks like it came from the business, with the
 * consultant's name appearing only inside the signature this function
 * appends automatically. No caller needs to build or paste a signature;
 * it's added here, in the one place all outgoing mail passes through, so
 * it can never be missed or duplicated.
 */
export async function sendGmailMessage(supabase: SupabaseClient, input: SendEmailInput): Promise<{ id: string }> {
  const connection = await getGmailConnection(supabase);
  if (!connection) throw new Error('No Gmail account is connected. Connect one in Admin → Settings first.');

  const [accessToken, agency] = await Promise.all([getValidAccessToken(supabase, connection), getAgencySignatureData(supabase)]);
  const mixedBoundary = `zenara_mixed_${Date.now()}`;
  const altBoundary = `zenara_alt_${Date.now()}`;

  const headers = [
    `From: "${encodeHeaderWord(agency.agencyName)}" <${connection.connected_email}>`,
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
      buildAlternativePart(input.bodyText, altBoundary, agency),
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
    raw = [...headers, '', buildAlternativePart(input.bodyText, altBoundary, agency)].join('\r\n');
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
