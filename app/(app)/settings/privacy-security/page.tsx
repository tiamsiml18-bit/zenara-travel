import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { PRIVACY_DOCUMENTS } from '@/lib/content/privacy-documents';
import { getAcknowledgmentsForUser } from '@/lib/services/privacy';

/**
 * Display-only labels for this one list, kept separate from lib/content
 * so the underlying document title/summary fields (still used on the
 * document detail page and the public /privacy page) are untouched.
 * Nothing here affects document content, versioning, or acknowledgment
 * matching, which all still key off doc.key/doc.version from lib/content.
 */
const LIST_LABELS: Record<string, string> = {
  'internal-privacy-policy': 'Privacy & Data Protection Policy',
  'terms-of-use': 'Terms of Use',
  'client-privacy-notice': 'Client Privacy Notice',
  'incident-procedure': 'Security & Incident Procedure',
};

export default async function PrivacySecurityPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const acknowledgments = await getAcknowledgmentsForUser(supabase, user.id);

  return (
    <>
      <Topbar title="Privacy & Security" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <p className="mb-6 text-sm text-ink-500">
            Privacy policies, terms, and data protection information for HIIKAP and Zenara Travel and Tours.
          </p>

          <div className="divide-y divide-sand-200">
            {PRIVACY_DOCUMENTS.map((doc) => {
              const label = LIST_LABELS[doc.key] ?? doc.title;
              const ack = acknowledgments[doc.key];
              const isAcknowledged = ack?.documentVersion === doc.version;
              return (
                <Link
                  key={doc.key}
                  href={`/settings/privacy-security/${doc.key}`}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-sand-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{label}</p>
                    {isAcknowledged && <p className="mt-0.5 text-xs text-ink-400">Acknowledged</p>}
                  </div>
                  <span className="shrink-0 text-xs text-ink-500">View document &rarr;</span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
