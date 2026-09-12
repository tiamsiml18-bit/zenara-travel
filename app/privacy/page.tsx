import type { Metadata } from 'next';
import { CLIENT_PRIVACY_NOTICE } from '@/lib/content/privacy-documents';
import { ZENARA_LOGO_DATA_URI } from '@/pdf/zenara-logo';

export const metadata: Metadata = {
  title: 'Privacy Notice — Zenara Travel and Tours',
  description: 'How Zenara Travel and Tours collects, uses, and protects client information.',
};

/**
 * Public, unauthenticated page for clients — intentionally outside the
 * (app) and (auth) route groups, so it uses only the root layout (no
 * sidebar, no login). Included in middleware.ts's PUBLIC_PATHS.
 *
 * Deliberately does NOT reuse components/settings/policy-document-view.tsx.
 * That component is built for the internal, authenticated Settings audience
 * (it shows a document-version key, a "Responsible officer" field, etc.) —
 * appropriate there, but it would read like an internal compliance artifact
 * here. This page renders the same CLIENT_PRIVACY_NOTICE content (legal
 * text is untouched) with layout built for a client reading it on its own.
 *
 * No Supabase/database call happens anywhere on this page — content is
 * static data from lib/content, and the logo is the existing pre-built
 * asset already used for the quotation PDF (pdf/zenara-logo.ts), not a
 * new logo and not a live query against agency_settings.
 */
export default function PublicPrivacyNoticePage() {
  const doc = CLIENT_PRIVACY_NOTICE;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <header className="mb-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- embedded data URI, not a remote image */}
        <img src={ZENARA_LOGO_DATA_URI} alt="Zenara Travel and Tours" className="mx-auto h-14 w-auto" />
        <h1 className="mt-6 font-display text-2xl font-semibold text-ink-900">{doc.title}</h1>
        {doc.subtitle && <p className="mt-1 text-sm text-ink-500">{doc.subtitle}</p>}
        <p className="mt-4 text-xs text-ink-400">
          Effective {doc.effectiveDate} &middot; Last updated {doc.lastUpdated}
        </p>
      </header>

      <div className="space-y-9">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2.5 font-display text-base font-semibold text-ink-900">{section.heading}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-ink-700">
              {section.paragraphs?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {section.bullets && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {section.numbered && (
                <ol className="list-decimal space-y-1.5 pl-5">
                  {section.numbered.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-14 border-t border-sand-200 pt-6 text-center text-xs text-ink-500">
        Questions about this notice? Contact us at {doc.contactEmail}
      </footer>
    </main>
  );
}
