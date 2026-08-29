import { describe, it, expect } from 'vitest';
import { suggestFieldForHeader, autoMapHeaders, validateMappedRow } from '@/lib/validation/import';

describe('suggestFieldForHeader — column auto-mapping', () => {
  it('matches exact synonyms case-insensitively', () => {
    expect(suggestFieldForHeader('Full Name')).toBe('fullName');
    expect(suggestFieldForHeader('full name')).toBe('fullName');
    expect(suggestFieldForHeader('EMAIL')).toBe('email');
  });

  it('matches the spec-listed header variants', () => {
    expect(suggestFieldForHeader('Name')).toBe('fullName');
    expect(suggestFieldForHeader('Phone')).toBe('mobileNumber');
    expect(suggestFieldForHeader('Mobile')).toBe('mobileNumber');
    expect(suggestFieldForHeader('Destination')).toBe('destination');
    expect(suggestFieldForHeader('Travel Date')).toBe('travelStartDate');
    expect(suggestFieldForHeader('Quoted Price')).toBe('quotedPrice');
    expect(suggestFieldForHeader('Status')).toBe('statusName');
    expect(suggestFieldForHeader('Agent')).toBe('agentName');
    expect(suggestFieldForHeader('Source')).toBe('sourceName');
    expect(suggestFieldForHeader('Notes')).toBe('notes');
  });

  it('handles underscore/hyphen-separated headers', () => {
    expect(suggestFieldForHeader('full_name')).toBe('fullName');
    expect(suggestFieldForHeader('lead-source')).toBe('sourceName');
  });

  it('returns null for a completely unrecognized header', () => {
    expect(suggestFieldForHeader('xyz123')).toBeNull();
  });

  it('returns null for an empty header', () => {
    expect(suggestFieldForHeader('')).toBeNull();
  });
});

describe('autoMapHeaders', () => {
  it('maps each header to its best field and never double-assigns a field', () => {
    const mapping = autoMapHeaders(['Full Name', 'Name', 'Email']);
    // "Name" and "Full Name" both suggest fullName — only the first should claim it.
    const assigned = Object.values(mapping).filter((v) => v === 'fullName');
    expect(assigned.length).toBe(1);
    expect(mapping['Email']).toBe('email');
  });

  it('leaves unrecognized headers unmapped', () => {
    const mapping = autoMapHeaders(['Full Name', 'Some Random Column']);
    expect(mapping['Some Random Column']).toBe('');
  });
});

describe('validateMappedRow', () => {
  const lookups = {
    statusNames: new Set(['New Lead', 'Contacted']),
    agentNames: new Set(['Leo', 'Anne']),
    sourceNames: new Set(['Facebook Ads', 'Referral']),
  };

  it('accepts a fully valid row', () => {
    const result = validateMappedRow(
      {
        __rowNumber: 2,
        fullName: 'Juan Dela Cruz',
        email: 'juan@example.com',
        mobileNumber: '09171234567',
        quotedPrice: '25,000',
        travelStartDate: '2026-10-01',
        travelEndDate: '2026-10-05',
        statusName: 'New Lead',
        agentName: 'Leo',
        sourceName: 'Facebook Ads',
      },
      lookups
    );
    expect(result.errors).toEqual([]);
    expect(result.row).not.toBeNull();
    expect(result.row?.fullName).toBe('Juan Dela Cruz');
    expect(result.row?.quotedPrice).toBe(25000);
  });

  it('rejects a row with no name', () => {
    const result = validateMappedRow({ __rowNumber: 3, fullName: '' }, lookups);
    expect(result.row).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid email', () => {
    const result = validateMappedRow({ __rowNumber: 4, fullName: 'Ana Reyes', email: 'not-an-email' }, lookups);
    expect(result.row).toBeNull();
    expect(result.errors.some((e) => e.includes('email'))).toBe(true);
  });

  it('rejects a negative quoted price', () => {
    const result = validateMappedRow({ __rowNumber: 5, fullName: 'Ben Cruz', quotedPrice: '-500' }, lookups);
    expect(result.row).toBeNull();
  });

  it('parses currency-formatted prices (commas, currency symbols)', () => {
    const result = validateMappedRow({ __rowNumber: 6, fullName: 'Cara Lim', quotedPrice: 'PHP 12,500.00' }, lookups);
    expect(result.row?.quotedPrice).toBe(12500);
  });

  it('rejects an unparseable travel date', () => {
    const result = validateMappedRow({ __rowNumber: 7, fullName: 'Dan Reyes', travelStartDate: 'not a date' }, lookups);
    expect(result.row).toBeNull();
  });

  it('rejects a travel end date before the start date', () => {
    const result = validateMappedRow(
      { __rowNumber: 8, fullName: 'Ella Santos', travelStartDate: '2026-10-10', travelEndDate: '2026-10-01' },
      lookups
    );
    expect(result.row).toBeNull();
  });

  it('warns (but still imports) when status/agent/source is unrecognized', () => {
    const result = validateMappedRow(
      { __rowNumber: 9, fullName: 'Finn Cruz', statusName: 'Not A Real Status', agentName: 'Nobody', sourceName: 'Unknown' },
      lookups
    );
    expect(result.row).not.toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBe(3);
    expect(result.row?.statusName).toBeNull();
    expect(result.row?.agentName).toBeNull();
    expect(result.row?.sourceName).toBeNull();
  });

  it('matches status/agent/source case-insensitively', () => {
    const result = validateMappedRow(
      { __rowNumber: 10, fullName: 'Gia Reyes', statusName: 'new lead', agentName: 'LEO', sourceName: 'facebook ads' },
      lookups
    );
    expect(result.warnings).toEqual([]);
    expect(result.row?.statusName).toBe('New Lead');
    expect(result.row?.agentName).toBe('Leo');
    expect(result.row?.sourceName).toBe('Facebook Ads');
  });

  it('treats an empty/omitted optional field as valid, not a warning', () => {
    const result = validateMappedRow({ __rowNumber: 11, fullName: 'Hugo Cruz' }, lookups);
    expect(result.row).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });
});
