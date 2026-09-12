import type { PolicyDocument } from '@/lib/content/policy-types';

/**
 * Renders a PolicyDocument's structured content. Shared by the internal
 * (authenticated) Settings → Privacy & Security pages and the public,
 * unauthenticated /privacy page for the Client Privacy Notice — same
 * component, same typography, so the two never visually drift apart.
 *
 * `versionDisplay` is optional and purely cosmetic: when omitted (as on
 * the public /privacy page, which never passes it), the raw
 * `document.version` string renders exactly as before. The internal
 * Settings → Privacy & Security document page passes a cleaned-up label
 * (e.g. "1.0" instead of "v1.0-draft") without altering the underlying
 * version value used for acknowledgment matching anywhere else.
 */
export function PolicyDocumentView({ document, versionDisplay }: { document: PolicyDocument; versionDisplay?: string }) {
  return (
    <article className="max-w-3xl">
      <header className="mb-6 border-b border-sand-200 pb-5">
        <h1 className="font-display text-xl font-semibold text-ink-900">{document.title}</h1>
        {document.subtitle && <p className="mt-1 text-sm text-ink-600">{document.subtitle}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink-500 sm:grid-cols-4">
          <Meta label="Version" value={versionDisplay ?? document.version} />
          <Meta label="Effective date" value={document.effectiveDate} />
          <Meta label="Last updated" value={document.lastUpdated} />
          <Meta label="Responsible officer" value={document.responsibleOfficer} />
        </dl>
      </header>

      <div className="space-y-6">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 font-display text-sm font-semibold text-ink-900">{section.heading}</h2>
            <div className="space-y-2.5 text-sm leading-relaxed text-ink-700">
              {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              {section.bullets && (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {section.numbered && (
                <ol className="list-decimal space-y-1 pl-5">
                  {section.numbered.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-8 border-t border-sand-200 pt-4 text-xs text-ink-500">
        Contact: {document.contactEmail}
      </footer>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="text-ink-700">{value}</dd>
    </div>
  );
}
