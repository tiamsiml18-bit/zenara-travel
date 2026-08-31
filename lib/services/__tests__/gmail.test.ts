import { describe, it, expect } from 'vitest';
import { normalizeWebsiteUrl, toDialableNumber, toWhatsAppUrl, buildSignatureText, buildSignatureHtml, type SignatureData } from '@/lib/services/gmail';

const FULL_AGENCY: SignatureData = {
  agencyName: 'Zenara Travel and Tours',
  website: 'https://zenaratravelandtours.com/',
  phone: '+63 906 376 9898',
  whatsapp: '+639063769898',
};

describe('normalizeWebsiteUrl', () => {
  it('leaves an already-prefixed URL untouched', () => {
    expect(normalizeWebsiteUrl('https://zenaratravelandtours.com')).toBe('https://zenaratravelandtours.com');
  });

  it('adds https:// to a bare domain', () => {
    expect(normalizeWebsiteUrl('zenaratravelandtours.com')).toBe('https://zenaratravelandtours.com');
  });
});

describe('toDialableNumber / toWhatsAppUrl', () => {
  it('strips formatting from a phone number for a tel: link', () => {
    expect(toDialableNumber('+63 906 376 9898')).toBe('+639063769898');
  });

  it('builds a correct wa.me link, stripping the leading +', () => {
    expect(toWhatsAppUrl('+639063769898')).toBe('https://wa.me/639063769898');
  });
});

describe('buildSignatureText', () => {
  it('includes agency name, website, phone, and whatsapp when all are set', () => {
    const sig = buildSignatureText(FULL_AGENCY);
    expect(sig).toContain('Zenara Travel and Tours');
    expect(sig).toContain('Website: https://zenaratravelandtours.com/');
    expect(sig).toContain('Phone: +63 906 376 9898');
    expect(sig).toContain('WhatsApp: +639063769898');
  });

  it('never repeats the consultant name — they already signed off personally in the message body', () => {
    const sig = buildSignatureText(FULL_AGENCY);
    expect(sig).not.toMatch(/sent by|travel consultant/i);
  });

  it('omits a line entirely rather than showing a blank/null value when a field is missing', () => {
    const sig = buildSignatureText({ ...FULL_AGENCY, phone: null });
    expect(sig).not.toMatch(/phone/i);
    expect(sig).not.toContain('null');
  });
});

describe('buildSignatureHtml', () => {
  it('never includes an image tag — no logo, so no risk of ever showing a broken-image icon', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).not.toContain('<img');
  });

  it('makes the website, phone, and WhatsApp all genuinely clickable links', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).toContain(`href="${FULL_AGENCY.website}"`);
    expect(html).toContain('href="tel:+639063769898"');
    expect(html).toContain('href="https://wa.me/639063769898"');
  });

  it('never repeats the consultant name — the agency name is the only identity line', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).not.toMatch(/sent by|travel consultant/i);
    expect(html).toMatch(/font-weight:bold[^>]*>Zenara Travel and Tours/);
  });

  it('omits a contact line entirely when the field is missing, never rendering a broken/empty link', () => {
    const html = buildSignatureHtml({ ...FULL_AGENCY, phone: null });
    expect(html).not.toContain('tel:');
    expect(html).not.toMatch(/phone/i);
  });
});
