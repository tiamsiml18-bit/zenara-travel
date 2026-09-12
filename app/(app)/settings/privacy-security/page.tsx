import Link from 'next/link';
import { ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { PRIVACY_DOCUMENTS } from '@/lib/content/privacy-documents';
import { getAcknowledgmentsForUser } from '@/lib/services/privacy';

export default async function PrivacySecurityPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const acknowledgments = await getAcknowledgmentsForUser(supabase, user.id);

  return (
    <>
      <Topbar title="Privacy & Security" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm text-ink-600">
            These documents govern how personal information is handled within HIIKAP, the internal CRM used by Zenara Travel
            and Tours. Every authorized user is expected to read and acknowledge each document.
          </p>

          <div className="divide-y divide-sand-200 rounded-lg border border-sand-200 bg-surface">
            {PRIVACY_DOCUMENTS.map((doc) => {
              const ack = acknowledgments[doc.key];
              const isCurrent = ack?.documentVersion === doc.version;
              return (
                <Link
                  key={doc.key}
                  href={`/settings/privacy-security/${doc.key}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sand-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-ink-900">{doc.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">{doc.summary}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                      {isCurrent ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-harbor-700" strokeWidth={1.75} />
                          <span className="text-harbor-700">Acknowledged</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={1.75} />
                          <span className="text-ink-500">Not yet acknowledged</span>
                        </>
                      )}
                      <span className="text-ink-400">· {doc.version}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
                </Link>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-ink-500">
            The Client Privacy Notice is also available publicly, without logging in, at{' '}
            <span className="font-mono">/privacy</span> — the version shown here is for staff reference.
          </p>
        </div>
      </main>
    </>
  );
}
