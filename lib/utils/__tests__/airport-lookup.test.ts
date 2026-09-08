import { describe, it, expect } from 'vitest';
import { searchAirports, resolveUnambiguousAirport, getAirportByCode, formatAirportLabel } from '@/lib/utils/airport-lookup';

describe('resolveUnambiguousAirport — spec examples resolve to the correct IATA code', () => {
  const cases: [string, string][] = [
    ['Manila', 'MNL'],
    ['Caticlan', 'MPH'],
    ['Cebu', 'CEB'],
    ['Singapore', 'SIN'],
    ['Kuala Lumpur', 'KUL'],
    ['Bangkok', 'BKK'],
    ['Hong Kong', 'HKG'],
    ['Dubai', 'DXB'],
    ['Doha', 'DOH'],
    ['Los Angeles', 'LAX'],
  ];

  for (const [query, expectedCode] of cases) {
    it(`"${query}" resolves to ${expectedCode}`, () => {
      const result = resolveUnambiguousAirport(query);
      expect(result?.code).toBe(expectedCode);
    });
  }

  it('resolves directly by IATA code too, e.g. "MNL"', () => {
    expect(resolveUnambiguousAirport('MNL')?.code).toBe('MNL');
  });

  it('is case-insensitive', () => {
    expect(resolveUnambiguousAirport('manila')?.code).toBe('MNL');
    expect(resolveUnambiguousAirport('mnl')?.code).toBe('MNL');
  });
});

describe('resolveUnambiguousAirport — never guesses when a city has multiple airports', () => {
  it('does not auto-resolve "Tokyo" (both Narita/NRT and Haneda/HND serve it)', () => {
    expect(resolveUnambiguousAirport('Tokyo')).toBeUndefined();
  });

  it('does not auto-resolve "Seoul" (both Incheon/ICN and Gimpo/GMP serve it)', () => {
    expect(resolveUnambiguousAirport('Seoul')).toBeUndefined();
  });

  it('searchAirports surfaces both Tokyo airports, for the agent to pick from', () => {
    const results = searchAirports('Tokyo');
    const codes = results.map((a) => a.code);
    expect(codes).toContain('NRT');
    expect(codes).toContain('HND');
  });

  it('searchAirports surfaces both Seoul airports too', () => {
    const results = searchAirports('Seoul');
    const codes = results.map((a) => a.code);
    expect(codes).toContain('ICN');
    expect(codes).toContain('GMP');
  });
});

describe('searchAirports — finds specific named international terminals from the spec', () => {
  it('finds Tokyo Narita by name', () => {
    const narita = searchAirports('Narita');
    expect(narita.some((a) => a.code === 'NRT')).toBe(true);
  });

  it('finds London Heathrow and Paris Charles de Gaulle by name', () => {
    expect(searchAirports('Heathrow').some((a) => a.code === 'LHR')).toBe(true);
    expect(searchAirports('Charles de Gaulle').some((a) => a.code === 'CDG')).toBe(true);
  });

  it('finds New York JFK', () => {
    expect(searchAirports('JFK').some((a) => a.code === 'JFK')).toBe(true);
  });

  it('returns nothing for a too-short query rather than dumping the whole dataset', () => {
    expect(searchAirports('a')).toHaveLength(0);
  });

  it('is not limited to Philippine airports — covers multiple continents in one dataset', () => {
    expect(getAirportByCode('LAX')?.country).toBe('US');
    expect(getAirportByCode('LHR')?.country).toBe('GB');
    expect(getAirportByCode('DXB')?.country).toBe('AE');
    expect(getAirportByCode('SIN')?.country).toBe('SG');
    expect(getAirportByCode('MNL')?.country).toBe('PH');
  });
});

describe('formatAirportLabel', () => {
  it('formats as "City (CODE)"', () => {
    const mnl = getAirportByCode('MNL')!;
    expect(formatAirportLabel(mnl)).toBe('Manila (MNL)');
  });
});
