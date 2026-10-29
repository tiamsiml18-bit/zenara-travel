import { describe, it, expect } from 'vitest';
import {
  FULL_SECTIONS,
  PDF_SECTION_KEYS,
  hasAnySection,
  isFullSections,
  parsePdfOptions,
  pdfFileSuffix,
  sectionsForMode,
  serializePdfOptions,
  availabilityFromData,
  emptySelectionMessage,
  hasMeaningfulContent,
  hasPricingContent,
} from '@/lib/utils/pdf-sections';

const parse = (qs: string) => parsePdfOptions(new URLSearchParams(qs));

describe('pdf-sections presets', () => {
  it('Full has every section on', () => {
    expect(isFullSections(sectionsForMode('full'))).toBe(true);
  });

  it('Itinerary Only is itinerary + flights and nothing else (no pricing, inclusions, exclusions or terms)', () => {
    expect(sectionsForMode('itinerary')).toEqual({
      itinerary: true,
      flights: true,
      inclusions: false,
      exclusions: false,
      pricingTotal: false,
      perPersonRates: false,
      terms: false,
    });
  });

  it('Quotation Without Itinerary is everything except the itinerary', () => {
    const s = sectionsForMode('no-itinerary');
    expect(s.itinerary).toBe(false);
    for (const k of PDF_SECTION_KEYS.filter((k) => k !== 'itinerary')) expect(s[k]).toBe(true);
  });

  it('presets return copies, never the shared constant', () => {
    const a = sectionsForMode('full');
    a.itinerary = false;
    expect(FULL_SECTIONS.itinerary).toBe(true);
  });

});

describe('hasPricingContent (Validity rule)', () => {
  const itin = sectionsForMode('itinerary');
  it('is false with no pricing flag, whatever the quotation holds', () => {
    expect(hasPricingContent(itin, 5)).toBe(false);
  });
  it('Pricing Total always counts, even with no per-person rows', () => {
    expect(hasPricingContent({ ...itin, pricingTotal: true }, 0)).toBe(true);
  });
  it('Per-person Rates counts only when guest pricing rows exist', () => {
    expect(hasPricingContent({ ...itin, perPersonRates: true }, 3)).toBe(true);
    expect(hasPricingContent({ ...itin, perPersonRates: true }, 0)).toBe(false);
  });
  it('the Full Quotation always has pricing content', () => {
    expect(hasPricingContent(sectionsForMode('full'), 0)).toBe(true);
  });
});

const avail = (over: Partial<Record<string, number>> = {}) =>
  availabilityFromData({
    itinerary: new Array(over.itinerary ?? 2),
    flightSegments: new Array(over.flights ?? 1),
    inclusions: new Array(over.inclusions ?? 3),
    exclusions: new Array(over.exclusions ?? 3),
    pricing: { guestLines: new Array(over.guestLines ?? 2) },
  });

describe('availability and empty selections', () => {
  it('pricing total and terms are always available; the rest need real content', () => {
    expect(avail({ itinerary: 0, flights: 0, inclusions: 0, exclusions: 0, guestLines: 0 })).toEqual({
      itinerary: false,
      flights: false,
      inclusions: false,
      exclusions: false,
      pricingTotal: true,
      perPersonRates: false,
      terms: true,
    });
  });

  it('Full and Without Itinerary are never empty (pricing total and terms always exist)', () => {
    const nothing = avail({ itinerary: 0, flights: 0, inclusions: 0, exclusions: 0, guestLines: 0 });
    expect(hasMeaningfulContent(sectionsForMode('full'), nothing)).toBe(true);
    expect(hasMeaningfulContent(sectionsForMode('no-itinerary'), nothing)).toBe(true);
  });

  it('Itinerary Only is empty when there is neither an itinerary nor flights', () => {
    const none = avail({ itinerary: 0, flights: 0 });
    expect(hasMeaningfulContent(sectionsForMode('itinerary'), none)).toBe(false);
    expect(emptySelectionMessage(sectionsForMode('itinerary'), none)).toBe(
      'This quotation has no itinerary or flight schedule to show, so this document would be empty. Choose other sections.'
    );
  });

  it('a missing optional section does not block when another selected section has content', () => {
    expect(emptySelectionMessage(sectionsForMode('itinerary'), avail({ flights: 0 }))).toBeNull();
    expect(emptySelectionMessage(sectionsForMode('itinerary'), avail({ itinerary: 0 }))).toBeNull();
  });

  it('Custom: blocked only when every selected section is empty', () => {
    const noFlights = avail({ flights: 0, inclusions: 0 });
    expect(emptySelectionMessage(sectionsForMode('custom', { flights: true, inclusions: true }), noFlights)).toMatch(
      /no flight schedule or inclusions/
    );
    expect(emptySelectionMessage(sectionsForMode('custom', { flights: true, terms: true }), noFlights)).toBeNull();
    expect(emptySelectionMessage(sectionsForMode('custom', { perPersonRates: true }), avail({ guestLines: 0 }))).toMatch(
      /no per-person rates/
    );
  });

  it('nothing selected keeps its own message', () => {
    expect(emptySelectionMessage(sectionsForMode('custom', {}), avail())).toBe('Select at least one section.');
  });
});

describe('parsePdfOptions', () => {
  it('no option at all means the Full Quotation (existing behavior)', () => {
    const r = parse('');
    expect(r).toEqual({ ok: true, mode: 'full', sections: FULL_SECTIONS });
    expect(parse('preview=1')).toEqual({ ok: true, mode: 'full', sections: FULL_SECTIONS });
  });

  it('parses each preset', () => {
    expect(parse('doc=itinerary')).toMatchObject({ ok: true, mode: 'itinerary' });
    expect(parse('doc=no-itinerary')).toMatchObject({ ok: true, mode: 'no-itinerary' });
    expect(parse('doc=full')).toMatchObject({ ok: true, mode: 'full' });
  });

  it('custom takes exactly the listed sections, in any combination', () => {
    const r = parse('doc=custom&sections=itinerary,pricingTotal');
    expect(r).toMatchObject({ ok: true, mode: 'custom' });
    if (r.ok) {
      expect(r.sections.itinerary).toBe(true);
      expect(r.sections.pricingTotal).toBe(true);
      expect(r.sections.inclusions).toBe(false);
      expect(r.sections.perPersonRates).toBe(false);
      expect(r.sections.terms).toBe(false);
    }
  });

  it('pricing total and per-person rates are independent', () => {
    const onlyRates = parse('doc=custom&sections=perPersonRates');
    const onlyTotal = parse('doc=custom&sections=pricingTotal');
    expect(onlyRates.ok && onlyRates.sections.perPersonRates && !onlyRates.sections.pricingTotal).toBe(true);
    expect(onlyTotal.ok && onlyTotal.sections.pricingTotal && !onlyTotal.sections.perPersonRates).toBe(true);
  });

  it('rejects custom with nothing selected', () => {
    expect(parse('doc=custom')).toEqual({ ok: false, error: 'Select at least one section.' });
    expect(parse('doc=custom&sections=')).toMatchObject({ ok: false });
  });

  it('rejects unknown documents and unknown sections', () => {
    expect(parse('doc=bogus')).toMatchObject({ ok: false });
    expect(parse('doc=custom&sections=itinerary,secret')).toMatchObject({ ok: false });
  });
});

describe('serializePdfOptions', () => {
  it('Full serializes to an empty string so the existing URLs are unchanged', () => {
    expect(serializePdfOptions('full', FULL_SECTIONS)).toBe('');
  });

  it('presets and custom round-trip through parse', () => {
    for (const mode of ['itinerary', 'no-itinerary'] as const) {
      const qs = serializePdfOptions(mode, sectionsForMode(mode));
      expect(parse(qs)).toMatchObject({ ok: true, mode });
    }
    const custom = sectionsForMode('custom', { itinerary: true, flights: true, perPersonRates: true });
    const qs = serializePdfOptions('custom', custom);
    expect(qs).toBe('doc=custom&sections=itinerary,flights,perPersonRates');
    const back = parse(qs);
    expect(back.ok && back.sections).toEqual(custom);
  });

  it('knows when nothing is selected', () => {
    expect(hasAnySection(sectionsForMode('custom', {}))).toBe(false);
    expect(hasAnySection(sectionsForMode('custom', { terms: true }))).toBe(true);
  });
});

describe('pdfFileSuffix', () => {
  it('leaves the Full Quotation file name alone and tags the others', () => {
    expect(pdfFileSuffix('full')).toBe('');
    expect(pdfFileSuffix('itinerary')).toBe('-itinerary');
    expect(pdfFileSuffix('no-itinerary')).toBe('-no-itinerary');
    expect(pdfFileSuffix('custom')).toBe('-custom');
  });
});
