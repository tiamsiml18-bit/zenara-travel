import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, fetchConnectedEmailAddress } from '@/lib/services/gmail';
import { writeAudit } from '@/lib/services/audit';

export async function GET(request: NextRequest) {
  const settingsUrl = new URL('/admin/settings', request.url);

  let user;
  try {
    user = await requireRole('admin');
  } catch {
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get('gmail_oauth_state')?.value;

  if (!code || !state || state !== expectedState) {
    settingsUrl.searchParams.set('gmail_error', 'The connection request could not be verified. Please try again.');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first consent (or when
      // prompt=consent forces it, which buildGoogleAuthUrl always sets) —
      // if it's still missing, something about the app's OAuth consent
      // screen config needs a look rather than silently storing a
      // connection that will stop working the moment the access token
      // expires.
      throw new Error('Google did not return a refresh token. Try disconnecting any prior authorization for this app in your Google Account settings, then reconnect.');
    }

    const connectedEmail = await fetchConnectedEmailAddress(tokens.access_token);
    const supabase = await createClient();

    // Single-connection design — replace whatever was there before rather
    // than accumulating rows, since the agency only ever has one connected
    // Gmail account at a time.
    await supabase.from('email_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('email_connections').insert({
      connected_email: connectedEmail,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_by: user.id,
    });

    await writeAudit(supabase, {
      userId: user.id,
      action: 'email_connection.connected',
      entityType: 'email_connection',
      entityId: connectedEmail,
    });

    settingsUrl.searchParams.set('gmail_connected', '1');
  } catch (err) {
    settingsUrl.searchParams.set('gmail_error', err instanceof Error ? err.message : 'Failed to connect Gmail.');
  }

  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete('gmail_oauth_state');
  return response;
}
