import { describe, it, expect } from 'vitest';
import { quotationDraftSchema, itineraryDaySchema } from '@/lib/validation/quotation';

const validDraft = {
  clientId: '11111111-1111-1111-1111-111111111111',
  packageId: '',
  destination: 'Hanoi, Vietnam',
  travelStartDate: '2026-09-01',
  travelEndDate: '2026-09-05',
  numAdults: 2,
  numChildren: 0,
  hotelName: 'Hanoi Old Quarter Hotel',
  numBedrooms: 1,
  pricePerPerson: 15000,
  totalPrice: 30000,
  notes: '',
  inclusions: [],
  exclusions: [],
  itinerary: [],
  supplierCost: 10000,
  markup: 5000,
};

describe('quotationDraftSchema — price calculations and required fields', () => {
  it('accepts a fully valid draft', () => {
    const result = quotationDraftSchema.safeParse(validDraft);
    expect(result.success).toBe(true);
  });

  it('rejects a missing client selection', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, clientId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects zero adults', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, numAdults: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative total price', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, totalPrice: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative supplier cost', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, supplierCost: -500 });
    expect(result.success).toBe(false);
  });

  it('allows a negative markup (a discounted/loss-leader quote is a legitimate business decision, not a data error)', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, markup: -1000 });
    expect(result.success).toBe(true);
  });

  it('rejects a travel end date before the start date', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      travelStartDate: '2026-09-10',
      travelEndDate: '2026-09-01',
    });
    expect(result.success).toBe(false);
  });

  it('accepts totalPrice of exactly zero (e.g. a fully complimentary trip)', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, totalPrice: 0 });
    expect(result.success).toBe(true);
  });

  it('coerces numeric string inputs from form fields', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      numAdults: '3' as unknown as number,
      totalPrice: '45000' as unknown as number,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numAdults).toBe(3);
      expect(result.data.totalPrice).toBe(45000);
    }
  });
});

describe('itineraryDaySchema', () => {
  it('requires a day title', () => {
    const result = itineraryDaySchema.safeParse({ dayNumber: 1, title: '', activities: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a day number below 1', () => {
    const result = itineraryDaySchema.safeParse({ dayNumber: 0, title: 'Arrival', activities: [] });
    expect(result.success).toBe(false);
  });

  it('defaults activities to an empty array when omitted', () => {
    const result = itineraryDaySchema.safeParse({ dayNumber: 1, title: 'Arrival' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.activities).toEqual([]);
  });
});
