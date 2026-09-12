import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { PRIVACY_DOCUMENTS } from '@/lib/content/privacy-documents';
import { getAcknowledgmentsForUser } from '@/lib/services/privacy';

/**
 * Display-only overrides for the main list, kept separate from
 * lib/content so the underlying document title/summary fields (and the
 * document detail page, which still reads from lib/content directly)
 * are untouched. This is purely how each row is labeled on this one
 * page — nothing here affects document content, versioning, or
 * acknowledgment matching, all of which still key off doc.key/doc.version
 * from lib/content as before.
 */
const LIST_LABELS: Record<string, { title: string; description: string }> = {
  'internal-privacy-policy': {
    title: 'HIIKAP Internal Privacy & Data Protection Policy',
    description: 'How personal information is handled inside HIIKAP.',
  },
  'terms-of-use': {
    title: 'HIIKAP Terms of Use & Acceptable Use Policy',
    description: 'Rules for authorized HIIKAP users.',
  },
  'client-privacy-notice': {
    title: 'Client Privacy Notice',
    description: 'How Zenara Travel and Tours collects and protects client information.',
  },
  'incident-procedure': {
    title: 'HIIKAP Privacy & Security Incident Procedure',
    description: 'What to do when a privacy or security incident occurs.',
  },
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
            Policies and guidelines for using HIIKAP and handling client information.
          </p>

          <div className="divide-y divide-sand-200">
            {PRIVACY_DOCUMENTS.map((doc) => {
              const label = LIST_LABELS[doc.key] ?? { title: doc.title, description: doc.summary };
              const ack = acknowledgments[doc.key];
              const isAcknowledged = ack?.documentVersion === doc.version;
              return (
                <Link
                  key={doc.key}
                  href={`/settings/privacy-security/${doc.key}`}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-sand-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{label.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">{label.description}</p>
                    {isAcknowledged && <p className="mt-1 text-xs text-ink-400">Acknowledged</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
                </Link>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-ink-400">
            <Link href="/privacy" className="underline hover:text-ink-600">
              Client Privacy Notice
            </Link>{' '}
            is also available publicly.
          </p>
        </div>
      </main>
    </>
  );
}
