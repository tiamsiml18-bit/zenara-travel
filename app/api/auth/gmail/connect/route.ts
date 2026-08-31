import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { buildGoogleAuthUrl } from '@/lib/services/gmail';

export async function GET() {
  // Only an admin can connect the agency's shared Gmail account — this
  // grants send access on behalf of the whole team, not just this user.
  try {
    await requireRole('admin');
  } catch {
    return NextResponse.json({ error: 'Only an admin can connect Gmail.' }, { status: 403 });
  }

  // A random state value guards against CSRF on the callback — Google
  // returns it unchanged, and the callback route checks it matches before
  // trusting the response.
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildGoogleAuthUrl(state));
  response.cookies.set('gmail_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, path: '/' });
  return response;
}
