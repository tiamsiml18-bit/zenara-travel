import { describe, it, expect } from 'vitest';
import { quotationDraftSchema, itineraryDaySchema, guestRateSchema } from '@/lib/validation/quotation';

const validDraft = {
  clientId: '11111111-1111-1111-1111-111111111111',
  packageId: '',
  destination: 'Hanoi, Vietnam',
  travelStartDate: '2026-09-01',
  travelEndDate: '2026-09-05',
  numAdults: 2,
  numChildren: 0,
  numSeniors: 0,
  numInfants: 0,
  numPwd: 0,
  hotelName: 'Hanoi Old Quarter Hotel',
  numBedrooms: 1,
  guestRates: [{ guestType: 'adult' as const, pricePerPerson: 15000, supplierCostPerPerson: 10000 }],
  notes: '',
  inclusions: [],
  exclusions: [],
  itinerary: [],
  costItems: [{ label: 'Airfare', amount: 10000 }],
  feeItems: [],
  markup: 5000,
};

describe('quotationDraftSchema — guest-type pricing and required fields', () => {
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

  it('rejects a negative guest rate', () => {
    const result = guestRateSchema.safeParse({ guestType: 'adult', pricePerPerson: -500, supplierCostPerPerson: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative supplier cost per person', () => {
    const result = guestRateSchema.safeParse({ guestType: 'adult', pricePerPerson: 500, supplierCostPerPerson: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown guest type', () => {
    const result = guestRateSchema.safeParse({ guestType: 'teen', pricePerPerson: 500, supplierCostPerPerson: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts all 5 guest types, each with their own rate', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      numSeniors: 1,
      numChildren: 1,
      numInfants: 1,
      numPwd: 1,
      guestRates: [
        { guestType: 'senior', pricePerPerson: 40000, supplierCostPerPerson: 30000 },
        { guestType: 'adult', pricePerPerson: 45000, supplierCostPerPerson: 35000 },
        { guestType: 'child', pricePerPerson: 35000, supplierCostPerPerson: 25000 },
        { guestType: 'infant', pricePerPerson: 10000, supplierCostPerPerson: 5000 },
        { guestType: 'pwd', pricePerPerson: 38000, supplierCostPerPerson: 28000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative cost item amount', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      costItems: [{ label: 'Airfare', amount: -500 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a cost item with an empty label', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      costItems: [{ label: '', amount: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty cost breakdown (not every quotation needs one)', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, costItems: [] });
    expect(result.success).toBe(true);
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

  it('accepts an empty guestRates array (total will simply calculate to zero)', () => {
    const result = quotationDraftSchema.safeParse({ ...validDraft, guestRates: [] });
    expect(result.success).toBe(true);
  });

  it('coerces numeric string inputs from form fields', () => {
    const result = quotationDraftSchema.safeParse({
      ...validDraft,
      numAdults: '3' as unknown as number,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numAdults).toBe(3);
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
