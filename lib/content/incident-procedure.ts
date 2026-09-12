import { PLACEHOLDER, type PolicyDocument } from './policy-types';

export const INCIDENT_PROCEDURE: PolicyDocument = {
  key: 'incident-procedure',
  title: 'HIIKAP Privacy and Security Incident Procedure',
  subtitle: 'For authorized users of the HIIKAP CRM operated by Zenara Travel and Tours',
  version: PLACEHOLDER.version,
  effectiveDate: PLACEHOLDER.effectiveDate,
  lastUpdated: PLACEHOLDER.lastUpdated,
  responsibleOfficer: PLACEHOLDER.privacyOfficer,
  contactEmail: PLACEHOLDER.privacyContact,
  summary: 'What to do if a privacy or security incident occurs in HIIKAP.',
  sections: [
    {
      heading: '1. What Is a Privacy/Security Incident',
      paragraphs: [
        'A privacy or security incident is any event that results in, or could reasonably result in, unauthorized access to, disclosure of, loss of, or damage to personal information processed through HIIKAP, or that compromises the confidentiality, integrity, or availability of HIIKAP itself.',
      ],
    },
    {
      heading: '2. Examples',
      paragraphs: ['Incidents can take many forms, including:'],
      bullets: [
        'A quotation or client document sent to the wrong email recipient',
        'A lost or stolen device that has HIIKAP access',
        'Stolen or compromised login credentials',
        'Unauthorized access to HIIKAP by a person without a legitimate business reason',
        'Accidental disclosure of client information',
        'A suspicious login attempt or unusual account activity',
        'Malware affecting a device used to access HIIKAP',
        'Exposure of the underlying database',
        'An incorrect or outdated document sent to a client',
        'Unauthorized export of client data',
      ],
    },
    {
      heading: '3. Immediate Employee Actions',
      paragraphs: ['If you discover or suspect an incident, immediately:'],
      numbered: [
        'Stop the activity that may be causing or contributing to the incident, where safe and reasonable to do so.',
        'Note what happened, when, and what information may be affected, to the best of your knowledge.',
        'Report the incident immediately following Section 5 below — do not wait to investigate it yourself first.',
      ],
    },
    {
      heading: '4. Actions Employees Must Not Take',
      paragraphs: ['To avoid making an incident worse or destroying evidence needed to assess it, do not:'],
      bullets: [
        'Attempt to hide, minimize, or delay reporting the incident',
        'Delete logs, records, emails, or other evidence related to the incident',
        'Attempt to independently "fix" a suspected security breach without reporting it first',
        'Notify affected clients or any external party on your own before the incident has been reviewed internally',
      ],
    },
    {
      heading: '5. Internal Reporting',
      paragraphs: [
        `Report the incident immediately to your direct supervisor or a Zenara administrator, and to ${PLACEHOLDER.privacyContact}. If Zenara has designated a Data Protection Officer or Privacy Officer, report to them as well. Provide as much detail as you have — what happened, when, what information may be involved, and any immediate steps already taken.`,
      ],
    },
    {
      heading: '6. Containment',
      paragraphs: [
        'Once reported, Zenara will take reasonable steps to contain the incident as quickly as possible — for example, revoking compromised credentials, disabling affected accounts, or restricting access to affected data — to limit further exposure.',
      ],
    },
    {
      heading: '7. Investigation',
      paragraphs: [
        'Zenara will investigate the scope and cause of the incident, including what information was involved, how the incident occurred, and how many individuals may be affected.',
      ],
    },
    {
      heading: '8. Evidence Preservation',
      paragraphs: [
        'Relevant logs, records, and communications related to the incident should be preserved (not deleted or altered) to support the investigation and any required regulatory reporting.',
      ],
    },
    {
      heading: '9. Assessment of Affected Information',
      paragraphs: [
        'Zenara will assess what categories of personal information were involved in the incident (for example, contact details only, versus passport or payment information) as this affects the severity of the incident and the response required.',
      ],
    },
    {
      heading: '10. Identification of Affected Clients',
      paragraphs: [
        'Where personal information belonging to specific clients was involved, Zenara will identify which clients were affected so that appropriate follow-up action can be taken.',
      ],
    },
    {
      heading: '11. Third-Party Coordination',
      paragraphs: [
        'Where the incident involves a third-party service provider (for example, a technology or payment provider), Zenara will coordinate with that provider as needed to understand and address the incident.',
      ],
    },
    {
      heading: '12. Legal and Regulatory Assessment',
      paragraphs: [
        'Zenara will assess whether the incident triggers any legal or regulatory obligation, including under the Data Privacy Act of 2012 and applicable National Privacy Commission rules, consulting legal counsel where appropriate.',
      ],
    },
    {
      heading: '13. Notification Assessment',
      paragraphs: [
        'Not every incident automatically requires notification to the National Privacy Commission or to affected individuals. Whether notification is required — and to whom — depends on the nature, scope, and circumstances of the specific incident, and on the requirements of applicable law and current NPC rules. This assessment will be made case by case.',
      ],
    },
    {
      heading: '14. Documentation',
      paragraphs: [
        'Every reported incident will be documented, including what happened, the response taken, and the outcome, to support future reference and continuous improvement.',
      ],
    },
    {
      heading: '15. Recovery',
      paragraphs: [
        'Once contained and investigated, Zenara will take the steps necessary to restore normal, secure operation — which may include resetting credentials, restoring data from backups, or other remediation specific to the incident.',
      ],
    },
    {
      heading: '16. Post-Incident Review',
      paragraphs: [
        'After resolution, Zenara will review the incident to understand what happened and why, and whether the response was effective.',
      ],
    },
    {
      heading: '17. Preventive Improvements',
      paragraphs: [
        'Where a review identifies a gap in HIIKAP\'s security, staff practices, or this policy itself, Zenara will consider and implement reasonable preventive improvements to reduce the likelihood of similar incidents in the future.',
      ],
    },
  ],
};
