import type { Metadata } from 'next';
import { CLIENT_PRIVACY_NOTICE } from '@/lib/content/privacy-documents';
import { PolicyDocumentView } from '@/components/settings/policy-document-view';

export const metadata: Metadata = {
  title: 'Privacy Notice — Zenara Travel and Tours',
  description: 'How Zenara Travel and Tours collects, uses, and protects client information.',
};

/**
 * Public page, intentionally outside the (app) and (auth) route groups so
 * it uses only the root layout — no sidebar, no login required. Clients
 * reach this from a link in quotation/booking emails (see
 * lib/utils/email-templates.ts) without needing a HIIKAP account.
 * Included in middleware.ts's PUBLIC_PATHS.
 */
export default function PublicPrivacyNoticePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PolicyDocumentView document={CLIENT_PRIVACY_NOTICE} />
    </main>
  );
}
