import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { getPrivacyDocument } from '@/lib/content/privacy-documents';
import { getAcknowledgmentsForUser } from '@/lib/services/privacy';
import { PolicyDocumentView } from '@/components/settings/policy-document-view';
import { AcknowledgePolicyButton } from '@/components/settings/acknowledge-policy-button';
import { acknowledgePolicyAction } from '../actions';

/**
 * Cosmetic only — turns the internal version key (e.g. "v1.0-draft",
 * used verbatim for acknowledgment matching everywhere else) into a
 * clean display label (e.g. "1.0") so the document page doesn't read
 * like an unfinished build. The actual document.version value is never
 * modified; this only affects what's rendered here.
 */
function formatVersionDisplay(version: string): string {
  return version.replace(/^v/i, '').replace(/-draft$/i, '');
}

export default async function PrivacyDocumentPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: docKey } = await params;
  const document = getPrivacyDocument(docKey);
  if (!document) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const acknowledgments = await getAcknowledgmentsForUser(supabase, user.id);
  const ack = acknowledgments[document.key];
  const alreadyAcknowledged = ack?.documentVersion === document.version;

  return (
    <>
      <Topbar title={document.title} />
      <main className="flex-1 overflow-y-auto p-6">
        <Link href="/settings/privacy-security" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Privacy & Security
        </Link>

        <PolicyDocumentView document={document} versionDisplay={formatVersionDisplay(document.version)} />

        <div className="mt-6 max-w-3xl rounded-lg border border-sand-200 bg-sand-50 p-4">
          <AcknowledgePolicyButton
            documentKey={document.key}
            documentVersion={document.version}
            alreadyAcknowledged={alreadyAcknowledged}
            acknowledgedAt={alreadyAcknowledged ? ack?.acknowledgedAt : undefined}
            onAcknowledge={acknowledgePolicyAction}
          />
        </div>
      </main>
    </>
  );
}
