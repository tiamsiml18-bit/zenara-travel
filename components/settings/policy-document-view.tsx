import type { PolicyDocument } from '@/lib/content/policy-types';

/**
 * Renders a PolicyDocument's structured content. Shared by the internal
 * (authenticated) Settings → Privacy & Security pages and the public,
 * unauthenticated /privacy page for the Client Privacy Notice — same
 * component, same typography, so the two never visually drift apart.
 *
 * Metadata fields (version, effective date, last updated, responsible
 * officer) only render when they hold a confirmed value. A field whose
 * value is still a bracketed placeholder (e.g. "[Last Updated — to be
 * set by Zenara]") or the draft version marker ("v1.0-draft") is simply
 * omitted rather than shown to the reader — nothing is invented to fill
 * the gap, and the underlying value is untouched everywhere else (still
 * used as-is for acknowledgment version matching).
 */
export function PolicyDocumentView({ document }: { document: PolicyDocument }) {
  const metaFields = [
    { label: 'Version', value: document.version },
    { label: 'Effective date', value: document.effectiveDate },
    { label: 'Last updated', value: document.lastUpdated },
    { label: 'Responsible officer', value: document.responsibleOfficer },
  ].filter((field) => isConfirmedValue(field.value));

  return (
    <article className="max-w-3xl">
      <header className="mb-6 border-b border-sand-200 pb-5">
        <h1 className="font-display text-xl font-semibold text-ink-900">{document.title}</h1>
        {document.subtitle && <p className="mt-1 text-sm text-ink-600">{document.subtitle}</p>}
        {metaFields.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink-500 sm:grid-cols-4">
            {metaFields.map((field) => (
              <Meta key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
        )}
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

function isConfirmedValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) return false; // unresolved bracket placeholder
  if (/draft/i.test(trimmed)) return false; // e.g. "v1.0-draft"
  return trimmed.length > 0;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="text-ink-700">{value}</dd>
    </div>
  );
}
