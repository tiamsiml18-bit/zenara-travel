/**
 * Where password-reset links point. In production they must always use the
 * workspace domain — never a stale NEXT_PUBLIC_SITE_URL and never an Origin
 * header the caller controls (a spoofed Origin could otherwise aim the emailed
 * link at another site). Outside production the request's own origin is
 * accepted only if it is localhost or the configured site URL.
 */
export const PRODUCTION_SITE_ORIGIN = 'https://workspace.zenaratravelandtours.com';
const LOCAL_ORIGIN = 'http://localhost:3000';

function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin(input: {
  requestOrigin?: string | null;
  envSiteUrl?: string | null;
  isProduction: boolean;
}): string {
  const requestOrigin = toOrigin(input.requestOrigin);
  const envOrigin = toOrigin(input.envSiteUrl);

  if (input.isProduction) return PRODUCTION_SITE_ORIGIN;

  const allowed = new Set<string>([PRODUCTION_SITE_ORIGIN, LOCAL_ORIGIN]);
  if (envOrigin) allowed.add(envOrigin);
  if (requestOrigin && allowed.has(requestOrigin)) return requestOrigin;
  return envOrigin ?? LOCAL_ORIGIN;
}
