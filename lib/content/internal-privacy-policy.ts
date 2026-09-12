import { PLACEHOLDER, type PolicyDocument } from './policy-types';

export const INTERNAL_PRIVACY_POLICY: PolicyDocument = {
  key: 'internal-privacy-policy',
  title: 'HIIKAP Internal Privacy and Data Protection Policy',
  subtitle: 'For authorized users of the HIIKAP CRM operated by Zenara Travel and Tours',
  version: PLACEHOLDER.version,
  effectiveDate: PLACEHOLDER.effectiveDate,
  lastUpdated: PLACEHOLDER.lastUpdated,
  responsibleOfficer: PLACEHOLDER.privacyOfficer,
  contactEmail: PLACEHOLDER.privacyContact,
  summary: 'Governs how personal information is handled by staff inside HIIKAP.',
  sections: [
    {
      heading: '1. Purpose and Scope',
      paragraphs: [
        'This policy governs how personal information is collected, used, stored, and protected within HIIKAP, the internal customer relationship management (CRM) application used by Zenara Travel and Tours ("Zenara") to run its travel business.',
        'HIIKAP is the application/software/system. Zenara Travel and Tours is the organization responsible, as data controller, for the client and business information processed through HIIKAP. This policy is designed to support Zenara\'s obligations under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and applicable guidance from the National Privacy Commission (NPC) — it does not, by itself, constitute a legal certification of compliance.',
        'This policy applies to every person who accesses HIIKAP, regardless of employment arrangement, including:',
      ],
      bullets: ['Employees', 'Consultants', 'Travel agents', 'Administrators', 'Contractors', 'Any other authorized HIIKAP user'],
    },
    {
      heading: '2. Organization and Accountability',
      paragraphs: [
        `Zenara Travel and Tours (${PLACEHOLDER.registeredName}) is the organization responsible for personal information processed through HIIKAP.`,
        'HIIKAP is the internal CRM application used to manage travel-related business operations — client relationships, quotations, packages, tours, bookings, payments, and follow-ups. HIIKAP itself is a tool; it is Zenara, as the business operating the tool, that is accountable for the personal information within it.',
        `Registered business address: ${PLACEHOLDER.businessAddress}`,
        `Official privacy contact: ${PLACEHOLDER.privacyContact}`,
        `Designated Data Protection Officer / Privacy Officer: ${PLACEHOLDER.privacyOfficer}`,
      ],
    },
    {
      heading: '3. Personal Information Processed',
      paragraphs: ['HIIKAP is reasonably expected to handle the following categories of information in the course of normal business use:'],
      bullets: [
        'Client information — full name, contact number, email address, address where necessary, preferred contact method, travel preferences, and client notes.',
        'Travel information — destination, travel dates, number of travelers, guest types, passenger information, passport information where legitimately required, visa-related information where legitimately required, and special travel requirements where legitimately required.',
        'Quotation and booking information — quotations, quotation revisions, package information, tour information, booking information, booking status, payment status, payment references, cancellation information, and refund information.',
        'CRM operational information — assigned consultant, follow-up records, client communications, internal notes, user activity, audit records, and other information necessary to operate the travel business.',
      ],
    },
    {
      heading: '4. Sensitive Personal Information',
      paragraphs: [
        'Sensitive personal information (as defined under the Data Privacy Act) must only be collected when genuinely necessary for a legitimate travel or business purpose, and only where legally permitted.',
        'Examples that may arise in a travel agency context include health-related travel requirements, passport information, and other government-issued identification.',
        'Staff must not place sensitive personal information into free-text notes fields unless it is directly necessary for the travel arrangement in question (for example, a documented dietary or mobility requirement relevant to booking). Sensitive information should never be added "just in case" or out of convenience.',
      ],
    },
    {
      heading: '5. Purpose of Processing',
      paragraphs: ['Zenara processes personal information through HIIKAP for legitimate business purposes, including:'],
      bullets: [
        'Responding to inquiries',
        'Preparing quotations',
        'Managing clients',
        'Creating travel packages',
        'Managing tours',
        'Arranging travel services',
        'Making bookings',
        'Managing payments',
        'Coordinating with suppliers',
        'Sending travel-related communications',
        'Managing follow-ups',
        'Processing cancellations and changes',
        'Customer service',
        'Maintaining accurate business records',
        'Fraud prevention and security',
        'Compliance with legal obligations',
        'Establishing, exercising, or defending legal claims',
        'Other legitimate business purposes permitted by applicable law',
      ],
    },
    {
      heading: '6. Lawful Basis for Processing',
      paragraphs: [
        'Processing carried out through HIIKAP relies on whichever lawful basis is appropriate to the specific activity, which may include consent, the necessity of processing for a contract with the client (or steps requested by the client prior to entering into a contract), compliance with a legal obligation, or another lawful basis recognized under applicable Philippine law.',
        'Not all processing under this policy relies exclusively on consent — much of it is necessary to deliver the travel services a client has requested, or to comply with legal or accounting obligations.',
      ],
    },
    {
      heading: '7. Data Minimization',
      paragraphs: [
        'Staff must only collect and record the information reasonably necessary for the relevant travel arrangement or business purpose at hand. Collecting information "in case it\'s useful later" is not a sufficient justification.',
      ],
    },
    {
      heading: '8. Data Accuracy',
      paragraphs: ['Staff using HIIKAP must:'],
      bullets: [
        'Keep client and booking information accurate and up to date',
        'Correct inaccurate information promptly when identified',
        'Avoid creating unnecessary duplicate client or quotation records',
        'Update outdated information (contact details, preferences, etc.) where necessary',
      ],
    },
    {
      heading: '9. Access Control',
      paragraphs: [
        'Access to HIIKAP is role-based. Only authorized users should access the information necessary for their specific work.',
        'Users must not:',
      ],
      bullets: [
        'Browse client records without a legitimate business reason',
        'Access information they are not authorized to view',
        'Share their HIIKAP account with anyone else',
        'Share their password with anyone else',
        'Allow another person to use their account or login session',
      ],
    },
    {
      heading: '10. Confidentiality',
      paragraphs: ['All non-public information within HIIKAP must be treated as confidential. Users must not:'],
      bullets: [
        'Send client databases or exports to a personal email address',
        'Download client information beyond what is needed for a specific task',
        'Share client lists with unauthorized parties',
        'Use client information for personal purposes',
        'Share client information with individuals who are not authorized HIIKAP users',
        'Take unnecessary screenshots of client or business data',
        'Copy confidential information into unauthorized external tools or services (including AI tools not approved by Zenara)',
      ],
    },
    {
      heading: '11. Third-Party Services',
      paragraphs: [
        'HIIKAP relies on approved technology and service providers to operate. Depending on the specific feature being used, this may include providers such as Supabase (database and backend infrastructure), Vercel (application hosting), email providers, payment providers, travel suppliers, and other approved service providers.',
        'Not every provider receives every type of information processed through HIIKAP — each provider only has access to what is necessary for the function it performs. Access granted to any third party should be limited to what is necessary for that purpose and subject to appropriate contractual and technical safeguards.',
      ],
    },
    {
      heading: '12. Data Retention',
      paragraphs: [
        'HIIKAP does not currently enforce a fixed, agency-wide retention period for each category of information. Zenara should retain personal information only for as long as reasonably necessary for the purpose for which it was collected, which may include:',
      ],
      bullets: [
        'The duration of an active client relationship',
        'The duration of an active or upcoming booking',
        'Accounting and financial record-keeping requirements',
        'Other legal requirements applicable to Zenara',
        'Potential legal claims',
        'Legitimate business record-keeping needs',
      ],
      numbered: [
        'Zenara should establish a formal retention schedule specifying how long each category of information described in Section 3 is kept.',
        'That retention schedule should be reviewed periodically (for example, annually) and updated as the business or applicable law changes.',
      ],
    },
    {
      heading: '13. Secure Disposal',
      paragraphs: [
        'When personal information is no longer required for the purposes described in this policy — and subject to any applicable legal or legitimate business record-keeping requirement — it should be securely deleted, destroyed, or anonymized using methods appropriate to the format in which it is stored.',
      ],
    },
    {
      heading: '14. Security',
      paragraphs: [
        'HIIKAP is designed with a number of technical and organizational safeguards appropriate to the information it holds, which as currently implemented include individual user accounts and authentication, role-based access control, database-level security, and audit logging of key activity.',
        'This document does not claim that every conceivable security feature (for example, specific encryption standards, formal penetration testing, or a fixed backup schedule) has been implemented or verified — Zenara should confirm the current state of technical safeguards with its development team and document them here as they are verified, rather than assuming this list is exhaustive.',
      ],
    },
    {
      heading: '15. Employee Responsibilities',
      paragraphs: ['Every HIIKAP user is expected to:'],
      bullets: [
        'Use a strong, unique password and keep it confidential',
        'Log out of shared or public devices after use',
        'Report lost or stolen devices that have HIIKAP access immediately',
        'Report suspected unauthorized access or suspicious activity immediately',
        'Only access client and business information for legitimate work purposes',
        'Follow this policy and the HIIKAP Terms of Use at all times',
      ],
    },
    {
      heading: '16. Data Subject Rights',
      paragraphs: [
        'Individuals whose personal information is processed through HIIKAP have rights under the Philippine Data Privacy Act, including, subject to applicable legal limitations and exceptions:',
      ],
      bullets: [
        'The right to be informed that their personal information will be, is being, or has been processed',
        'The right to access their personal information',
        'The right to correction or rectification of inaccurate information',
        'The right to object to processing',
        'The right to erasure or blocking of information, where applicable',
        'The right to data portability, where applicable',
        'The right to lodge a complaint with the National Privacy Commission',
        'The right to be indemnified for damages, where applicable',
      ],
    },
    {
      heading: '17. Privacy Requests',
      paragraphs: [
        `Any HIIKAP user who receives a privacy-related request from a client (such as a request to access, correct, or delete their information) should not attempt to resolve it unilaterally. The request should be forwarded promptly to Zenara's official privacy contact: ${PLACEHOLDER.privacyContact}.`,
        'Zenara should acknowledge and respond to privacy requests within a reasonable timeframe consistent with the Data Privacy Act and its Implementing Rules and Regulations.',
      ],
    },
    {
      heading: '18. Policy Updates',
      paragraphs: [
        'This policy will be reviewed periodically and updated as HIIKAP\'s functionality, Zenara\'s business practices, or applicable law changes. Material updates will be communicated to authorized HIIKAP users, who may be asked to re-acknowledge the policy following a significant revision.',
      ],
    },
  ],
};
