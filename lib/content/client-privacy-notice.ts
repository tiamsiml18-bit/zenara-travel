import { PLACEHOLDER, type PolicyDocument } from './policy-types';

export const CLIENT_PRIVACY_NOTICE: PolicyDocument = {
  key: 'client-privacy-notice',
  title: 'Zenara Travel and Tours',
  subtitle: 'Client Privacy Notice',
  version: PLACEHOLDER.version,
  effectiveDate: PLACEHOLDER.effectiveDate,
  lastUpdated: PLACEHOLDER.lastUpdated,
  responsibleOfficer: PLACEHOLDER.privacyOfficer,
  contactEmail: PLACEHOLDER.privacyContact,
  summary: 'How Zenara Travel and Tours collects, uses, and protects your information.',
  sections: [
    {
      heading: '1. Who We Are',
      paragraphs: [
        `Zenara Travel and Tours (${PLACEHOLDER.registeredName}) is a Philippine travel agency. We use HIIKAP, our internal business application, to manage client relationships, quotations, bookings, and related travel services. This notice explains how we handle your personal information when you inquire about, book, or travel with us.`,
      ],
    },
    {
      heading: '2. What Information We Collect',
      paragraphs: ['Depending on how you interact with us, we may collect:'],
      bullets: [
        'Contact details — your name, phone number, email address, and, where necessary, your home or billing address',
        'Travel details — destination, travel dates, number of travelers, and traveler information',
        'Documents necessary for travel — such as passport or visa information, where legitimately required for the specific trip you\'re booking',
        'Special requirements — such as dietary, accessibility, or health-related travel needs you choose to share with us, where relevant to your trip',
        'Booking and payment information — quotations, bookings, payment status, and payment references (we do not store full payment card numbers)',
        'Communications — messages and correspondence you send us regarding your inquiry or booking',
      ],
    },
    {
      heading: '3. Why We Collect Your Information',
      paragraphs: ['We collect and use your information to:'],
      bullets: [
        'Respond to your inquiries and prepare travel quotations',
        'Arrange and manage your bookings',
        'Coordinate with hotels, airlines, tour operators, and other travel suppliers on your behalf',
        'Process payments and refunds',
        'Send you booking confirmations, updates, and travel-related communications',
        'Follow up on quotations and provide customer service',
        'Maintain accurate business and accounting records',
        'Comply with legal and regulatory obligations',
        'Prevent fraud and protect the security of our systems',
      ],
    },
    {
      heading: '4. How We Use Your Information',
      paragraphs: [
        'We use your information only for the purposes described in this notice, or for other purposes that are compatible with those purposes and permitted under applicable law.',
      ],
    },
    {
      heading: '5. When We Share Your Information',
      paragraphs: [
        'We do not sell your personal information. We do share it, only where reasonably necessary, with parties who help us deliver the travel services you\'ve requested or who we\'re legally required to share it with:',
      ],
    },
    {
      heading: '6. Travel Suppliers',
      paragraphs: [
        'To arrange your trip, we share the necessary booking details (such as your name, travel dates, and relevant traveler information) with hotels, airlines, tour operators, and other travel suppliers involved in your itinerary.',
      ],
    },
    {
      heading: '7. Payment Providers',
      paragraphs: [
        'Payment processing is handled through the payment methods you choose. We share only the information necessary to process your payment with the relevant payment provider.',
      ],
    },
    {
      heading: '8. Technology Providers',
      paragraphs: [
        'We use technology service providers to operate HIIKAP and our business systems (for example, database hosting, application hosting, and email delivery). These providers process information on our behalf and only as necessary to provide their service to us.',
      ],
    },
    {
      heading: '9. Government or Legal Disclosures',
      paragraphs: [
        'We may disclose your information where required by law, regulation, court order, or a lawful request from a government or regulatory authority, or where necessary to establish, exercise, or defend a legal claim.',
      ],
    },
    {
      heading: '10. International or Cross-Border Processing',
      paragraphs: [
        'Some of the technology and travel-supplier partners we work with may process or store information outside the Philippines. Where this occurs, we expect appropriate safeguards to be in place consistent with the Data Privacy Act of 2012.',
      ],
    },
    {
      heading: '11. Security',
      paragraphs: [
        'We take reasonable technical and organizational measures to protect your information, including access controls and restricting information access to staff who need it to serve you. No system can be guaranteed to be completely secure, and we cannot promise absolute security of your information.',
      ],
    },
    {
      heading: '12. How Long We Keep Your Information',
      paragraphs: [
        'We retain your information for as long as reasonably necessary for the purposes described in this notice — generally for the duration of our relationship with you, plus any additional period required for accounting, legal, or legitimate business record-keeping purposes.',
      ],
    },
    {
      heading: '13. Your Rights',
      paragraphs: [
        'Under the Philippine Data Privacy Act of 2012, you have the right, subject to applicable legal limitations, to:',
      ],
      bullets: [
        'Be informed about how your personal information is processed',
        'Access the personal information we hold about you',
        'Request correction of inaccurate information',
        'Object to certain processing of your information',
        'Request erasure or blocking of your information, where applicable',
        'Request a copy of your information in a portable format, where applicable',
        'Lodge a complaint with the National Privacy Commission',
      ],
    },
    {
      heading: '14. How to Exercise Your Rights',
      paragraphs: [
        `To exercise any of these rights, or if you have any questions about how we handle your information, please contact us at: ${PLACEHOLDER.privacyContact}.`,
      ],
    },
    {
      heading: '15. Privacy Concerns and Complaints',
      paragraphs: [
        'If you believe we have not handled your personal information appropriately, please contact us first so we can address your concern directly. You also have the right to file a complaint with the National Privacy Commission.',
      ],
    },
    {
      heading: '16. Privacy Incidents',
      paragraphs: [
        'If a privacy or security incident affecting your personal information occurs, we will assess the situation and take appropriate steps consistent with applicable law and National Privacy Commission guidance, which may include notifying you and the relevant authorities where required.',
      ],
    },
    {
      heading: '17. Updates to This Notice',
      paragraphs: [
        'We may update this notice from time to time to reflect changes in our practices or applicable law. The "Last Updated" date at the top of this notice reflects the most recent revision.',
      ],
    },
    {
      heading: '18. Contact Us',
      paragraphs: [`Official privacy contact: ${PLACEHOLDER.privacyContact}`, `Business address: ${PLACEHOLDER.businessAddress}`],
    },
  ],
};
