import { PLACEHOLDER, type PolicyDocument } from './policy-types';

export const TERMS_OF_USE: PolicyDocument = {
  key: 'terms-of-use',
  title: 'HIIKAP Terms of Use and Acceptable Use Policy',
  subtitle: 'Internal terms for authorized users of the HIIKAP CRM, operated by Zenara Travel and Tours',
  version: PLACEHOLDER.version,
  effectiveDate: PLACEHOLDER.effectiveDate,
  lastUpdated: PLACEHOLDER.lastUpdated,
  responsibleOfficer: PLACEHOLDER.privacyOfficer,
  contactEmail: PLACEHOLDER.privacyContact,
  summary: 'Acceptable-use rules for staff, consultants, and administrators using HIIKAP.',
  sections: [
    {
      heading: '1. Purpose',
      paragraphs: [
        'These Terms of Use govern access to and use of HIIKAP, the internal CRM application operated by Zenara Travel and Tours. By logging into HIIKAP, every user agrees to comply with these terms.',
      ],
    },
    {
      heading: '2. Authorized Users',
      paragraphs: [
        'HIIKAP access is limited to individuals authorized by Zenara — employees, consultants, travel agents, administrators, and contractors who have been issued an account for legitimate business purposes. Access is not transferable.',
      ],
    },
    {
      heading: '3. Account Security',
      paragraphs: [
        'Each user is responsible for all activity that occurs under their account. Users must notify an administrator immediately if they suspect their account has been compromised.',
      ],
    },
    {
      heading: '4. Password Responsibilities',
      paragraphs: [
        'Users must choose a strong, unique password, keep it confidential, and never write it down in an unsecured location or share it with another person, including colleagues and supervisors.',
      ],
    },
    {
      heading: '5. Proper HIIKAP Use',
      paragraphs: ['HIIKAP must only be used for legitimate Zenara business purposes consistent with a user\'s assigned role.'],
    },
    {
      heading: '6. Client Confidentiality',
      paragraphs: [
        'All client, quotation, booking, and pricing information within HIIKAP is confidential. Users must not disclose this information to anyone outside Zenara except as required for legitimate business purposes (for example, coordinating with a travel supplier on a specific booking).',
      ],
    },
    {
      heading: '7. Prohibited Activities',
      paragraphs: ['The following activities are strictly prohibited:'],
      bullets: [
        'Sharing login credentials with any other person',
        'Using another user\'s account or login session',
        'Attempting to bypass, disable, or circumvent access controls or permission settings',
        'Accessing client records without a legitimate business reason',
        'Exporting client information for personal use',
        'Selling or sharing client information with any third party not authorized by Zenara',
        'Using client information for personal marketing or solicitation',
        'Altering, deleting, or tampering with audit records',
        'Manipulating pricing calculations outside of the intended quotation workflow',
        'Circumventing approval controls built into HIIKAP',
        'Uploading malicious files or attachments',
        'Connecting or using unauthorized third-party integrations with HIIKAP',
        'Copying confidential client information into unauthorized external AI systems or services',
        'Using HIIKAP for any unlawful purpose',
        'Attempting to compromise, probe, or gain unauthorized access to HIIKAP, Supabase, Vercel, or any other connected service',
      ],
    },
    {
      heading: '8. Unauthorized Data Access',
      paragraphs: [
        'Viewing, searching, or browsing client or business records outside the scope of a user\'s assigned responsibilities is a violation of these terms, even if the underlying permission settings technically allow it.',
      ],
    },
    {
      heading: '9. Unauthorized Data Export',
      paragraphs: [
        'Downloading, printing, screenshotting, or otherwise exporting client or business data from HIIKAP for any purpose other than an authorized business task is prohibited.',
      ],
    },
    {
      heading: '10. Personal Use Restrictions',
      paragraphs: ['HIIKAP accounts and the information within them must not be used for any personal, non-business purpose.'],
    },
    {
      heading: '11. Data Accuracy',
      paragraphs: [
        'Users must enter and maintain accurate information in HIIKAP and correct errors promptly when identified, consistent with the Internal Privacy and Data Protection Policy.',
      ],
    },
    {
      heading: '12. Internal Notes',
      paragraphs: [
        'Internal notes fields should be used professionally and only for information relevant to servicing the client. Sensitive personal information should not be placed in free-text notes unless directly necessary.',
      ],
    },
    {
      heading: '13. Quotation and Pricing Information',
      paragraphs: [
        'Internal pricing information — including supplier cost, markup, and any other figure marked "internal only" — must never be shared with clients or anyone outside Zenara, and must never appear on client-facing documents.',
      ],
    },
    {
      heading: '14. Client Communications',
      paragraphs: [
        'Communications sent to clients through HIIKAP (or through integrations connected to it, such as the Gmail connection) must be professional, accurate, and consistent with Zenara\'s standards.',
      ],
    },
    {
      heading: '15. Uploaded Documents',
      paragraphs: [
        'Users must only upload files relevant to a legitimate business task (for example, a client\'s travel document). Uploading files containing malicious code, or files unrelated to Zenara business, is prohibited.',
      ],
    },
    {
      heading: '16. Third-Party Integrations',
      paragraphs: [
        'Only integrations approved and configured by a Zenara administrator (for example, the Gmail connection under Admin → Settings) may be used with HIIKAP. Users must not connect personal or unauthorized third-party services to HIIKAP or its data.',
      ],
    },
    {
      heading: '17. Security Incident Reporting',
      paragraphs: [
        'Users must report any suspected security or privacy incident immediately, following the HIIKAP Privacy and Security Incident Procedure. This includes lost devices, suspected unauthorized access, suspicious login activity, or any accidental disclosure of client information.',
      ],
    },
    {
      heading: '18. User Responsibilities',
      paragraphs: [
        'Users are expected to read and follow this document, the Internal Privacy and Data Protection Policy, and the Privacy and Security Incident Procedure, and to raise questions about any part they do not understand.',
      ],
    },
    {
      heading: '19. Suspension or Termination of Access',
      paragraphs: [
        'Zenara may suspend or terminate a user\'s HIIKAP access at any time, including on separation from the company, suspected misuse, or a violation of these terms, at its discretion.',
      ],
    },
    {
      heading: '20. Audit and Monitoring',
      paragraphs: [
        'Activity within HIIKAP may be logged and reviewed by Zenara for security, compliance, and operational purposes. Users should have no expectation of privacy regarding their activity within HIIKAP.',
      ],
    },
    {
      heading: '21. Intellectual Property',
      paragraphs: [
        'HIIKAP, its underlying software, and its design remain the property of Zenara Travel and Tours and/or its licensors. Users are granted a limited right to use HIIKAP for authorized business purposes only.',
      ],
    },
    {
      heading: '22. System Availability',
      paragraphs: [
        'Zenara does not guarantee uninterrupted availability of HIIKAP. Planned maintenance, updates, or unforeseen technical issues may temporarily affect access.',
      ],
    },
    {
      heading: '23. Policy Violations',
      paragraphs: [
        'Violations of these Terms of Use may result in disciplinary action, up to and including termination of employment or engagement, and, where applicable, legal action.',
      ],
    },
    {
      heading: '24. Amendments',
      paragraphs: [
        'These terms may be updated from time to time. Continued use of HIIKAP after an update constitutes acceptance of the revised terms. Users may be asked to re-acknowledge these terms after a material revision.',
      ],
    },
    {
      heading: '25. Contact Information',
      paragraphs: [`Questions about these Terms of Use should be directed to: ${PLACEHOLDER.privacyContact}`],
    },
  ],
};
