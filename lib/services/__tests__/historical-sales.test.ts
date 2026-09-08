import { describe, it, expect } from 'vitest';
import { computeHistoricalCostAndProfit, fingerprint } from '@/lib/services/historical-sales';
import {
  validateHistoricalMappedRow,
  autoMapHistoricalHeaders,
  type HistoricalMappedRow,
} from '@/lib/validation/historical-sales-import';

describe('computeHistoricalCostAndProfit', () => {
  it('matches the spec example: PHP 100,000 sale, costs summing to 70,000, profit 30,000', () => {
    const result = computeHistoricalCostAndProfit({
      totalSale: 100000,
      airfareCost: 20000,
      hotelCost: 30000,
      transferCost: 5000,
      tourCost: 10000,
      bankCharge: 5000,
      refund: 0,
    });
    expect(result.totalCost).toBe(70000);
    expect(result.netProfit).toBe(30000);
  });

  it('recalculates automatically when a cost value changes, same as CRM Sales', () => {
    const base = { totalSale: 100000, airfareCost: 20000, hotelCost: 30000, transferCost: 5000, tourCost: 10000, bankCharge: 5000, refund: 0 };
    const before = computeHistoricalCostAndProfit(base);
    const after = computeHistoricalCostAndProfit({ ...base, hotelCost: 40000 });
    expect(after.totalCost).toBe(before.totalCost + 10000);
    expect(after.netProfit).toBe(before.netProfit - 10000);
  });
});

describe('fingerprint (duplicate detection)', () => {
  it('produces the same fingerprint regardless of case or surrounding whitespace', () => {
    const a = fingerprint('Juan Dela Cruz', '2024-01-01', 'INV-001');
    const b = fingerprint('  juan dela cruz  ', '2024-01-01', 'inv-001');
    expect(a).toBe(b);
  });

  it('treats different customers, dates, or refs as distinct', () => {
    const a = fingerprint('Juan Dela Cruz', '2024-01-01', 'INV-001');
    const b = fingerprint('Maria Santos', '2024-01-01', 'INV-001');
    const c = fingerprint('Juan Dela Cruz', '2024-02-01', 'INV-001');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('autoMapHistoricalHeaders', () => {
  it('maps every old-tracker column correctly, including "Invoice in Zoho" to quotationRef', () => {
    const mapping = autoMapHistoricalHeaders([
      'SN',
      'Customer Name',
      'Invoice Date',
      'Travel Date',
      'Invoice in Zoho',
      'Invoice Amount',
      'Airfare Cost',
      'Hotel Accommodation Cost',
      'Airport Transfer',
      'Tour Package',
      'Bank Charge',
      'Refund',
      'Total Cost',
      'Net Profit',
      'Remarks',
    ]);
    expect(mapping['SN']).toBe(''); // not mappable, carries no needed information
    expect(mapping['Customer Name']).toBe('customerName');
    expect(mapping['Invoice in Zoho']).toBe('quotationRef');
    expect(mapping['Invoice Amount']).toBe('totalSale');
    expect(mapping['Airfare Cost']).toBe('airfareCost');
    expect(mapping['Hotel Accommodation Cost']).toBe('hotelCost');
    expect(mapping['Airport Transfer']).toBe('transferCost');
    expect(mapping['Tour Package']).toBe('tourCost');
    expect(mapping['Bank Charge']).toBe('bankCharge');
    expect(mapping['Refund']).toBe('refund');
    expect(mapping['Total Cost']).toBe('totalCost');
    expect(mapping['Net Profit']).toBe('netProfit');
    expect(mapping['Remarks']).toBe('remarks');
  });
});

describe('validateHistoricalMappedRow', () => {
  function row(overrides: Partial<HistoricalMappedRow>): HistoricalMappedRow {
    return { __rowNumber: 2, customerName: 'Juan Dela Cruz', ...overrides };
  }

  it('requires a customer name', () => {
    const result = validateHistoricalMappedRow(row({ customerName: '' }));
    expect(result.row).toBeNull();
    expect(result.errors).toContain('Customer name is required.');
  });

  it('preserves the sheet\'s own Total Cost and Net Profit exactly, without recalculating them from the cost columns', () => {
    // Sheet cost columns sum to 50,000, but the old tracker's own Total Cost/Net Profit say otherwise --
    // per spec, the sheet's own values must be preserved as-is on import.
    const result = validateHistoricalMappedRow(
      row({
        totalSale: '100000',
        airfareCost: '20000',
        hotelCost: '30000',
        totalCost: '999999', // deliberately inconsistent with the cost columns
        netProfit: '111111',
      })
    );
    expect(result.row?.totalCost).toBe(999999);
    expect(result.row?.netProfit).toBe(111111);
  });

  it('computes Total Cost and Net Profit from the cost columns only when the sheet has no values of its own', () => {
    const result = validateHistoricalMappedRow(
      row({
        totalSale: '100000',
        airfareCost: '20000',
        hotelCost: '30000',
        transferCost: '5000',
        tourCost: '10000',
        bankCharge: '5000',
        refund: '0',
      })
    );
    expect(result.row?.totalCost).toBe(70000);
    expect(result.row?.netProfit).toBe(30000);
  });

  it('maps "Invoice in Zoho" style quotationRef through to the row, as free text with no quotation required', () => {
    const result = validateHistoricalMappedRow(row({ quotationRef: 'ZOHO-INV-4821' }));
    expect(result.row?.quotationRef).toBe('ZOHO-INV-4821');
  });

  it('derives a sensible payment status from amount paid vs total sale when the sheet has no explicit status column', () => {
    const unpaid = validateHistoricalMappedRow(row({ totalSale: '100000', amountPaid: '0' }));
    const partial = validateHistoricalMappedRow(row({ totalSale: '100000', amountPaid: '40000' }));
    const paid = validateHistoricalMappedRow(row({ totalSale: '100000', amountPaid: '100000' }));
    expect(unpaid.row?.paymentStatus).toBe('pending_payment');
    expect(partial.row?.paymentStatus).toBe('partially_paid');
    expect(paid.row?.paymentStatus).toBe('paid');
  });
});
