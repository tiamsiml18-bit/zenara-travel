import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeWebsiteUrl,
  toDialableNumber,
  toWhatsAppUrl,
  buildSignatureText,
  buildSignatureHtml,
  isValidImageUrl,
  type SignatureData,
} from '@/lib/services/gmail';

const FULL_AGENCY: SignatureData = {
  agencyName: 'Zenara Travel and Tours',
  logoUrl: 'https://example.supabase.co/storage/v1/object/public/branding/logo.png',
  website: 'https://zenaratravelandtours.com/',
  phone: '+63 906 376 9898',
  whatsapp: '+639063769898',
  facebook: 'https://www.facebook.com/zenaratravelandtours',
  instagram: 'https://www.instagram.com/zenaratravelandtours/',
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

describe('isValidImageUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a small, genuinely-image response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([
          ['content-type', 'image/png'],
          ['content-length', '23177'],
        ]) as unknown as Headers,
      })
    );
    await expect(isValidImageUrl('https://example.com/logo.png')).resolves.toBe(true);
  });

  it('rejects a non-200 response — a broken or deleted logo must never be used', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: new Map() as unknown as Headers }));
    await expect(isValidImageUrl('https://example.com/missing.png')).resolves.toBe(false);
  });

  it('rejects a response that is not actually an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, headers: new Map([['content-type', 'text/html']]) as unknown as Headers })
    );
    await expect(isValidImageUrl('https://example.com/deleted-file')).resolves.toBe(false);
  });

  it("rejects an oversized image — exactly the kind of file that can time out through a mail client's image proxy", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
          ['content-length', '831257'],
        ]) as unknown as Headers,
      })
    );
    await expect(isValidImageUrl('https://example.com/huge-logo.jpg')).resolves.toBe(false);
  });

  it('rejects when the request itself fails (network error, DNS failure, etc.)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    await expect(isValidImageUrl('https://unreachable.example.com/logo.png')).resolves.toBe(false);
  });
});

describe('buildSignatureText', () => {
  it('includes agency name, website, phone, and whatsapp when all are set', () => {
    const sig = buildSignatureText(FULL_AGENCY);
    expect(sig).toContain('Zenara Travel and Tours');
    expect(sig).toContain('Website: https://zenaratravelandtours.com/');
    expect(sig).toContain('Landline: +63 906 376 9898');
    expect(sig).toContain('WhatsApp: +639063769898');
    expect(sig).toContain('Facebook: https://www.facebook.com/zenaratravelandtours');
    expect(sig).toContain('Instagram: https://www.instagram.com/zenaratravelandtours/');
  });

  it('never repeats the consultant name — they already signed off personally in the message body', () => {
    const sig = buildSignatureText(FULL_AGENCY);
    expect(sig).not.toMatch(/sent by|travel consultant/i);
  });

  it('omits a line entirely rather than showing a blank/null value when a field is missing', () => {
    const sig = buildSignatureText({ ...FULL_AGENCY, phone: null });
    expect(sig).not.toMatch(/landline/i);
    expect(sig).not.toContain('null');
  });
});

describe('buildSignatureHtml', () => {
  it('renders the logo with explicit width/height attributes, not just CSS, so mail clients reserve space before it loads', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).toContain(`src="${FULL_AGENCY.logoUrl}"`);
    expect(html).toContain('width="60"');
    expect(html).toContain('height="60"');
  });

  it('omits the logo entirely when none is set, rather than a broken image tag', () => {
    const html = buildSignatureHtml({ ...FULL_AGENCY, logoUrl: null });
    expect(html).not.toContain('<img');
  });

  it('uses a table layout, not flexbox, for cross-client compatibility', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).toContain('<table');
    expect(html).not.toContain('display:flex');
  });

  it('makes the website, phone, and WhatsApp all genuinely clickable links', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).toContain(`href="${FULL_AGENCY.website}"`);
    expect(html).toContain('href="tel:+639063769898"');
    expect(html).toContain('href="https://wa.me/639063769898"');
  });

  it('includes Facebook and Instagram as clickable links after the primary contact methods, when set', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).toContain(`href="${FULL_AGENCY.facebook}"`);
    expect(html).toContain(`href="${FULL_AGENCY.instagram}"`);
    // Ordering: primary contact methods (website/phone/whatsapp) come before social links
    const whatsappIndex = html.indexOf('WhatsApp:');
    const facebookIndex = html.indexOf('Facebook:');
    expect(whatsappIndex).toBeLessThan(facebookIndex);
  });

  it('omits Facebook/Instagram entirely when not set, never rendering an empty link', () => {
    const html = buildSignatureHtml({ ...FULL_AGENCY, facebook: null, instagram: null });
    expect(html).not.toMatch(/facebook/i);
    expect(html).not.toMatch(/instagram/i);
  });

  it('never repeats the consultant name — the agency name is the only identity line', () => {
    const html = buildSignatureHtml(FULL_AGENCY);
    expect(html).not.toMatch(/sent by|travel consultant/i);
    expect(html).toMatch(/font-weight:bold[^>]*>Zenara Travel and Tours/);
  });

  it('omits a contact line entirely when the field is missing, never rendering a broken/empty link', () => {
    const html = buildSignatureHtml({ ...FULL_AGENCY, phone: null });
    expect(html).not.toContain('tel:');
    expect(html).not.toMatch(/landline/i);
  });
});
