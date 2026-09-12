import { INTERNAL_PRIVACY_POLICY } from './internal-privacy-policy';
import { TERMS_OF_USE } from './terms-of-use';
import { CLIENT_PRIVACY_NOTICE } from './client-privacy-notice';
import { INCIDENT_PROCEDURE } from './incident-procedure';
import type { PolicyDocument } from './policy-types';

export { INTERNAL_PRIVACY_POLICY, TERMS_OF_USE, CLIENT_PRIVACY_NOTICE, INCIDENT_PROCEDURE };
export type { PolicyDocument, PolicySection } from './policy-types';

/**
 * All four documents, in the display order requested for
 * Settings → Privacy & Security. Client Privacy Notice is included here too
 * (read-only reference + optional staff acknowledgment) even though it also
 * has its own public, unauthenticated route at /privacy for clients.
 */
export const PRIVACY_DOCUMENTS: PolicyDocument[] = [
  INTERNAL_PRIVACY_POLICY,
  TERMS_OF_USE,
  CLIENT_PRIVACY_NOTICE,
  INCIDENT_PROCEDURE,
];

export function getPrivacyDocument(key: string): PolicyDocument | undefined {
  return PRIVACY_DOCUMENTS.find((doc) => doc.key === key);
}
