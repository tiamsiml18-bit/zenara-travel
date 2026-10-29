import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyPdfSections, renderQuotationPdf, EmptyPdfSelectionError } from '@/lib/services/pdf';
import { getQuotationPdfData } from '@/lib/services/pdf-data';

vi.mock('@/lib/services/pdf-data', () => ({
  getQuotationPdfData: vi.fn(),
  getDetailedItineraryPdfData: vi.fn(),
}));
// The guard is what's under test here, not the layout — the layout is covered by rendering real PDFs.
vi.mock('@/pdf/quotation-pdf-document', () => ({ QuotationPdfDocument: vi.fn(() => null) }));
vi.mock('@react-pdf/renderer', async (orig) => ({
  ...(await orig<typeof import('@react-pdf/renderer')>()),
  renderToBuffer: vi.fn(async () => Buffer.from('%PDF-stub')),
}));
import { FULL_SECTIONS, sectionsForMode } from '@/lib/utils/pdf-sections';
import type { QuotationPdfData } from '@/lib/services/pdf-data';

// Minimal data cast: only the fields applyPdfSections reads matter here.
const data = {
  validUntil: '2026-12-15',
  pricing: { totalPrice: 213000, guestLines: [{ label: 'Adult', count: 2, rate: 45000, subtotal: 90000 }] },
  fees: [{ label: 'Environmental fee', amount: 500 }],
  itinerary: [{ day: 1 }],
  flightSegments: [{ flightNumber: '5J 391' }],
  inclusions: ['Airfare'],
  exclusions: ['Tips'],
  agency: { name: 'Zenara', termsAndConditions: 'T&C text', paymentInstructions: 'Pay by GCash' },
} as unknown as QuotationPdfData;

describe('applyPdfSections', () => {
  it('returns the very same data for the Full Quotation', () => {
    expect(applyPdfSections(data, FULL_SECTIONS)).toBe(data);
  });

  it('Itinerary Only strips every price, fee, validity, inclusion, exclusion and term before rendering', () => {
    const out = applyPdfSections(data, sectionsForMode('itinerary'));
    expect(out.pricing.totalPrice).toBe(0);
    expect(out.pricing.guestLines).toEqual([]);
    expect(out.fees).toEqual([]);
    expect(out.validUntil).toBe('');
    expect(out.inclusions).toEqual([]);
    expect(out.exclusions).toEqual([]);
    expect(out.agency.termsAndConditions).toBe('');
    expect(out.agency.paymentInstructions).toBeNull();
    expect(out.itinerary).toHaveLength(1);
    expect(out.flightSegments).toHaveLength(1);
  });

  it('Without Itinerary keeps everything but the itinerary', () => {
    const out = applyPdfSections(data, sectionsForMode('no-itinerary'));
    expect(out.itinerary).toEqual([]);
    expect(out.pricing.totalPrice).toBe(213000);
    expect(out.fees).toHaveLength(1);
    expect(out.inclusions).toHaveLength(1);
  });

  it('fees only travel with the pricing total; rates and total are independent', () => {
    const ratesOnly = applyPdfSections(data, sectionsForMode('custom', { perPersonRates: true }));
    expect(ratesOnly.fees).toEqual([]);
    expect(ratesOnly.pricing.totalPrice).toBe(0);
    expect(ratesOnly.pricing.guestLines).toHaveLength(1);
    const totalOnly = applyPdfSections(data, sectionsForMode('custom', { pricingTotal: true }));
    expect(totalOnly.fees).toHaveLength(1);
    expect(totalOnly.pricing.totalPrice).toBe(213000);
    expect(totalOnly.pricing.guestLines).toEqual([]);
  });

  it('does not mutate the input', () => {
    applyPdfSections(data, sectionsForMode('itinerary'));
    expect(data.pricing.totalPrice).toBe(213000);
    expect(data.fees).toHaveLength(1);
  });
});

describe('Validity only appears with real pricing content', () => {
  it('Per-person Rates selected but no guest pricing rows: no Validity on its own', () => {
    const legacy = { ...data, pricing: { ...data.pricing, guestLines: [] } } as unknown as QuotationPdfData;
    const out = applyPdfSections(legacy, sectionsForMode('custom', { itinerary: true, perPersonRates: true }));
    expect(out.validUntil).toBe('');
  });

  it('Per-person Rates with rows keeps Validity', () => {
    expect(applyPdfSections(data, sectionsForMode('custom', { itinerary: true, perPersonRates: true })).validUntil).toBe('2026-12-15');
  });

  it('Pricing Total keeps Validity even with no per-person rows', () => {
    const legacy = { ...data, pricing: { ...data.pricing, guestLines: [] } } as unknown as QuotationPdfData;
    expect(applyPdfSections(legacy, sectionsForMode('custom', { pricingTotal: true })).validUntil).toBe('2026-12-15');
  });
});

describe('renderQuotationPdf refuses an empty selection', () => {
  const empty = { ...data, itinerary: [], flightSegments: [], inclusions: [], exclusions: [] } as unknown as QuotationPdfData;
  beforeEach(() => vi.mocked(getQuotationPdfData).mockReset());

  it('throws instead of producing a bare header', async () => {
    vi.mocked(getQuotationPdfData).mockResolvedValue(empty);
    await expect(renderQuotationPdf(null as never, 'q', sectionsForMode('itinerary'))).rejects.toBeInstanceOf(EmptyPdfSelectionError);
  });

  it('renders when a selected section has content', async () => {
    vi.mocked(getQuotationPdfData).mockResolvedValue({ ...empty, flightSegments: [{ flightNumber: '5J 1' }] } as unknown as QuotationPdfData);
    await expect(renderQuotationPdf(null as never, 'q', sectionsForMode('itinerary'))).resolves.toBeInstanceOf(Buffer);
  });

  it('never blocks the Full Quotation or the no-option (email) path, even with no optional content', async () => {
    vi.mocked(getQuotationPdfData).mockResolvedValue(empty);
    await expect(renderQuotationPdf(null as never, 'q')).resolves.toBeInstanceOf(Buffer);
    await expect(renderQuotationPdf(null as never, 'q', FULL_SECTIONS)).resolves.toBeInstanceOf(Buffer);
  });
});
