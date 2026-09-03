import { describe, it, expect } from 'vitest';
import { generateSuggestedInclusions, generateSuggestedExclusions, type InclusionsExclusionsInput } from '@/lib/utils/quotation-inclusions';

const EMPTY: InclusionsExclusionsInput = {
  packageType: null,
  hasAirfare: false,
  hasHotel: false,
  hotelName: '',
  hasTransfer: false,
  transferLabels: [],
  tourNames: [],
  otherCostLabels: [],
};

describe('generateSuggestedInclusions', () => {
  it('produces nothing when no part of the quotation has been filled in yet — never invents an item', () => {
    expect(generateSuggestedInclusions(EMPTY)).toEqual([]);
  });

  it('includes airfare only for an All-In package with a filled Airfare section — never for Land Arrangement Only', () => {
    const allIn = generateSuggestedInclusions({ ...EMPTY, packageType: 'all_in', hasAirfare: true });
    expect(allIn).toContain('Roundtrip airfare');

    const landOnly = generateSuggestedInclusions({ ...EMPTY, packageType: 'land_arrangement', hasAirfare: true });
    expect(landOnly).not.toContain('Roundtrip airfare');
  });

  it('names the actual hotel when one is set, rather than a generic line', () => {
    const named = generateSuggestedInclusions({ ...EMPTY, hasHotel: true, hotelName: 'Shangri-La Hanoi' });
    expect(named).toContain('Hotel accommodation at Shangri-La Hanoi');

    const unnamed = generateSuggestedInclusions({ ...EMPTY, hasHotel: true, hotelName: '' });
    expect(unnamed).toContain('Hotel accommodation');
  });

  it('lists each labeled Transfer segment separately for a multi-destination itinerary', () => {
    const result = generateSuggestedInclusions({
      ...EMPTY,
      hasTransfer: true,
      transferLabels: ['Hanoi Airport Transfer', 'Hanoi to Sapa Transfer'],
    });
    expect(result).toEqual(['Hanoi Airport Transfer', 'Hanoi to Sapa Transfer']);
  });

  it('falls back to a generic term when Transfer has no labeled segments', () => {
    const result = generateSuggestedInclusions({ ...EMPTY, hasTransfer: true, transferLabels: [] });
    expect(result).toContain('Airport transfers');
  });

  it('includes each actual tour and other-cost item by its real name, never a placeholder', () => {
    const result = generateSuggestedInclusions({
      ...EMPTY,
      tourNames: ['Island Hopping Tour', 'City Tour'],
      otherCostLabels: ['Visa Fee'],
    });
    expect(result).toEqual(['Island Hopping Tour', 'City Tour', 'Visa Fee']);
  });

  it('combines every filled-in component into one list, reflecting exactly what is actually in this quotation', () => {
    const result = generateSuggestedInclusions({
      packageType: 'all_in',
      hasAirfare: true,
      hasHotel: true,
      hotelName: 'Sapa Hotel',
      hasTransfer: true,
      transferLabels: [],
      tourNames: ['Island Hopping Tour'],
      otherCostLabels: [],
    });
    expect(result).toEqual(['Roundtrip airfare', 'Hotel accommodation at Sapa Hotel', 'Airport transfers', 'Island Hopping Tour']);
  });
});

describe('generateSuggestedExclusions', () => {
  it('flags airfare as excluded specifically for Land Arrangement Only', () => {
    const landOnly = generateSuggestedExclusions({ ...EMPTY, packageType: 'land_arrangement' });
    expect(landOnly).toContain('Airfare');

    const allIn = generateSuggestedExclusions({ ...EMPTY, packageType: 'all_in' });
    expect(allIn).not.toContain('Airfare');
  });

  it('always includes the standard travel-industry exclusions regardless of package contents', () => {
    const result = generateSuggestedExclusions(EMPTY);
    expect(result).toEqual(['Personal expenses', 'Travel insurance', 'Items not mentioned in the inclusions']);
  });
});
