/**
 * Structured content model for HIIKAP's privacy/legal documents.
 *
 * Content is kept as data (not raw markdown) since the project has no
 * markdown renderer dependency — `PolicyDocumentView` renders these
 * sections directly with consistent typography. Keeping it as data also
 * makes it trivial to reuse the same section for both the internal
 * (authenticated) render and the public /privacy render.
 */
export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Optional numbered sub-list, used sparingly (e.g. incident procedure steps). */
  numbered?: string[];
}

export interface PolicyDocument {
  /** Stable key used for routing and acknowledgment records. Never rename once in use. */
  key: string;
  title: string;
  subtitle?: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  responsibleOfficer: string;
  contactEmail: string;
  /** Short line shown in the document list. */
  summary: string;
  sections: PolicySection[];
}

export const PLACEHOLDER = {
  effectiveDate: 'September 12, 2026',
  version: 'v1.0-draft',
  lastUpdated: '[Last Updated — to be set by Zenara]',
  privacyOfficer: '[Name of Designated Data Protection Officer / Privacy Officer, if appointed]',
  privacyContact: 'bookings@zenaratravelandtours.com',
  businessAddress: 'Mahacot West, Batangas City, Philippines',
  registeredName: '[Official Registered Business Name, if different from "Zenara Travel and Tours"]',
} as const;
