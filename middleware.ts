import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { completeRecoveryExchange } from '@/lib/auth/password-reset';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/privacy'];

export async function middleware(request: NextRequest) {
  // Vercel Cron invokes these routes server-to-server with an
  // `Authorization: Bearer <CRON_SECRET>` header, never a browser session
  // cookie — each cron route handler (app/api/cron/*/route.ts) already
  // authenticates that header itself and rejects a missing/incorrect
  // secret with 401. Without this, the session check below would bounce
  // every real Cron invocation to /login before it ever reached that
  // check. Scoped to this one prefix only: it does not make /api/* in
  // general public, and every other route below still requires a session.
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });
  // Cookies Supabase asks us to set, kept so they can be carried onto a redirect.
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
          pendingCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
          pendingCookies.push({ name, value: '', options });
        },
      },
    }
  );

  // Password-recovery emails link to /reset-password?code=… (PKCE). Turn that
  // one-time code into a session here — cookies can't be written from the page
  // itself — then drop the code from the URL. A bad/used/expired code lands on
  // the page's friendly "request a new link" state.
  if (request.nextUrl.pathname === '/reset-password' && request.nextUrl.searchParams.has('code')) {
    const exchange = await completeRecoveryExchange(supabase, request.nextUrl.searchParams.get('code')!);
    const target = new URL('/reset-password', request.url);
    if (!exchange.ok) target.searchParams.set('link_error', 'invalid');
    const redirectResponse = NextResponse.redirect(target);
    for (const c of pendingCookies) redirectResponse.cookies.set({ name: c.name, value: c.value, ...c.options });
    return redirectResponse;
  }

  // Refresh the session if it's expired — required for Server Components,
  // which cannot write cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Exact match, not prefix match — every current PUBLIC_PATHS entry is a
  // single flat route (no /login/[token], no /privacy/[section], etc.),
  // so this doesn't change behavior for the existing public routes. It
  // does stop a future route like /privacy-internal or /privacy/staff-only
  // from becoming accidentally public just because it starts with
  // "/privacy" — a prefix match on '/privacy' would have covered those too.
  const isPublicPath = PUBLIC_PATHS.includes(path);

  // Unauthenticated user hitting a protected route -> bounce to login.
  if (!user && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', path);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting the login page -> send them to the dashboard.
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image optimization files.
     * Fine-grained per-role checks happen deeper (layout + RLS); this
     * middleware only handles "logged in or not".
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
