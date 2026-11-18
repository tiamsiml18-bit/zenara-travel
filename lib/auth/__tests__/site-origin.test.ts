import { describe, it, expect } from 'vitest';
import { resolveSiteOrigin, PRODUCTION_SITE_ORIGIN } from '@/lib/auth/site-origin';

describe('resolveSiteOrigin', () => {
  it('always uses the workspace domain in production, ignoring a stale env value', () => {
    expect(resolveSiteOrigin({ isProduction: true, envSiteUrl: 'https://zenara-travel.vercel.app', requestOrigin: 'https://zenara-travel.vercel.app' })).toBe(PRODUCTION_SITE_ORIGIN);
    expect(resolveSiteOrigin({ isProduction: true })).toBe('https://workspace.zenaratravelandtours.com');
  });

  it('never trusts a caller-controlled Origin header in production', () => {
    expect(resolveSiteOrigin({ isProduction: true, requestOrigin: 'https://evil.example' })).toBe(PRODUCTION_SITE_ORIGIN);
  });

  it('outside production accepts localhost, the workspace domain and the configured site URL only', () => {
    expect(resolveSiteOrigin({ isProduction: false, requestOrigin: 'http://localhost:3000' })).toBe('http://localhost:3000');
    expect(resolveSiteOrigin({ isProduction: false, envSiteUrl: 'https://preview.example.com', requestOrigin: 'https://preview.example.com' })).toBe('https://preview.example.com');
    expect(resolveSiteOrigin({ isProduction: false, requestOrigin: 'https://evil.example', envSiteUrl: 'https://preview.example.com' })).toBe('https://preview.example.com');
  });

  it('falls back to localhost with nothing configured and tolerates garbage values', () => {
    expect(resolveSiteOrigin({ isProduction: false, requestOrigin: 'not a url', envSiteUrl: '' })).toBe('http://localhost:3000');
  });
});
