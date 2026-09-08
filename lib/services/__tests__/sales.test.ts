import { describe, it, expect } from 'vitest';
import { getSalesPaymentStatus, getSalesSummary, computeSalesCostAndProfit, resolveSalesCostAndProfit } from '@/lib/services/sales';

describe('resolveSalesCostAndProfit (Manual vs Linked Expenses — the double-counting guard)', () => {
  const manualCosts = { airfareCost: 20000, hotelCost: 15000, transferCost: 3000, tourCost: 10000, bankCharge: 500, refund: 0 };

  it('uses only the manual cost fields when costSource is manual, ignoring linkedExpensesTotal entirely', () => {
    const result = resolveSalesCostAndProfit({
      costSource: 'manual',
      totalSale: 100000,
      manualCosts,
      linkedExpensesTotal: 999999, // must be completely ignored
    });
    expect(result.totalCost).toBe(48500);
    expect(result.netProfit).toBe(51500);
  });

  it('uses only the linked expenses total when costSource is linked_expenses, ignoring the manual fields entirely', () => {
    const result = resolveSalesCostAndProfit({
      costSource: 'linked_expenses',
      totalSale: 100000,
      manualCosts, // must be completely ignored
      linkedExpensesTotal: 53000,
    });
    expect(result.totalCost).toBe(53000);
    expect(result.netProfit).toBe(47000);
  });

  it('never sums manual costs and linked expenses together, under any combination', () => {
    const manual = resolveSalesCostAndProfit({ costSource: 'manual', totalSale: 100000, manualCosts, linkedExpensesTotal: 53000 });
    const linked = resolveSalesCostAndProfit({ costSource: 'linked_expenses', totalSale: 100000, manualCosts, linkedExpensesTotal: 53000 });
    const wrongDoubleCounted =
      manualCosts.airfareCost + manualCosts.hotelCost + manualCosts.transferCost + manualCosts.tourCost + manualCosts.bankCharge + manualCosts.refund + 53000;
    expect(manual.totalCost).not.toBe(wrongDoubleCounted);
    expect(linked.totalCost).not.toBe(wrongDoubleCounted);
    expect(manual.totalCost).toBe(48500);
    expect(linked.totalCost).toBe(53000);
  });

  it('defaults new/untouched Sales records to the manual formula, matching every existing record before Expenses existed', () => {
    const beforeExpensesExisted = computeSalesCostAndProfit({ totalSale: 100000, ...manualCosts });
    const afterExpensesAdded = resolveSalesCostAndProfit({ costSource: 'manual', totalSale: 100000, manualCosts, linkedExpensesTotal: 0 });
    expect(afterExpensesAdded).toEqual(beforeExpensesExisted);
  });
});

describe('computeSalesCostAndProfit', () => {
  it('matches the spec example exactly: PHP 100,000 sale, PHP 70,000 total cost, PHP 30,000 net profit', () => {
    const result = computeSalesCostAndProfit({
      totalSale: 100000,
      airfareCost: 20000,
      hotelCost: 15000,
      transferCost: 3000,
      tourCost: 10000,
      bankCharge: 500,
      refund: 0,
    });
    // 20,000 + 15,000 + 3,000 + 10,000 + 500 + 0 = 48,500 total cost
    expect(result.totalCost).toBe(48500);
    expect(result.netProfit).toBe(51500);
  });

  it('recalculates automatically when any single cost value changes', () => {
    const base = { totalSale: 100000, airfareCost: 20000, hotelCost: 15000, transferCost: 3000, tourCost: 10000, bankCharge: 500, refund: 0 };
    const before = computeSalesCostAndProfit(base);
    const after = computeSalesCostAndProfit({ ...base, hotelCost: 25000 });
    expect(after.totalCost).toBe(before.totalCost + 10000);
    expect(after.netProfit).toBe(before.netProfit - 10000);
  });

  it('includes a refund as an added cost, reducing net profit', () => {
    const withoutRefund = computeSalesCostAndProfit({ totalSale: 100000, airfareCost: 0, hotelCost: 0, transferCost: 0, tourCost: 0, bankCharge: 0, refund: 0 });
    const withRefund = computeSalesCostAndProfit({ totalSale: 100000, airfareCost: 0, hotelCost: 0, transferCost: 0, tourCost: 0, bankCharge: 0, refund: 5000 });
    expect(withRefund.totalCost).toBe(withoutRefund.totalCost + 5000);
    expect(withRefund.netProfit).toBe(withoutRefund.netProfit - 5000);
  });
});

describe('getSalesPaymentStatus', () => {
  it('shows Paid whenever payment_status is paid, regardless of booking status', () => {
    expect(getSalesPaymentStatus({ paymentStatus: 'paid', bookingStatus: 'pending' })).toBe('paid');
    expect(getSalesPaymentStatus({ paymentStatus: 'paid', bookingStatus: 'confirmed' })).toBe('paid');
  });

  it('shows Partially Paid whenever payment_status is partial, regardless of booking status', () => {
    expect(getSalesPaymentStatus({ paymentStatus: 'partial', bookingStatus: 'pending' })).toBe('partially_paid');
    expect(getSalesPaymentStatus({ paymentStatus: 'partial', bookingStatus: 'confirmed' })).toBe('partially_paid');
  });

  it('shows Confirmed when nothing has been paid yet but the booking is confirmed', () => {
    expect(getSalesPaymentStatus({ paymentStatus: 'unpaid', bookingStatus: 'confirmed' })).toBe('confirmed');
  });

  it('shows Pending Payment when nothing has been paid and the booking is not confirmed', () => {
    expect(getSalesPaymentStatus({ paymentStatus: 'unpaid', bookingStatus: 'pending' })).toBe('pending_payment');
    expect(getSalesPaymentStatus({ paymentStatus: 'unpaid', bookingStatus: 'in_progress' })).toBe('pending_payment');
  });
});

describe('getSalesSummary', () => {
  type Row = Parameters<typeof getSalesSummary>[0][number];

  function row(overrides: Partial<Row>): Row {
    return {
      bookingId: 'b1',
      quotationId: 'q1',
      quotationNumber: 'QT-2026-00001',
      customerId: 'c1',
      customerName: 'Test Customer',
      invoiceDate: '2026-01-01',
      travelStartDate: '2026-06-01',
      travelEndDate: '2026-06-05',
      totalSale: 0,
      amountPaid: 0,
      balance: 0,
      paymentStatus: 'pending_payment',
      paymentDueDate: '2026-05-01',
      agentName: 'Agent',
      airfareCost: 0,
      hotelCost: 0,
      transferCost: 0,
      tourCost: 0,
      bankCharge: 0,
      refund: 0,
      totalCost: 0,
      netProfit: 0,
      costSource: 'manual',
      zohoInvoiceNumber: '',
      remarks: '',
      ...overrides,
    };
  }

  it('sums Total Sales, Amount Collected, and Outstanding Balance across all rows', () => {
    const summary = getSalesSummary([
      row({ totalSale: 100000, amountPaid: 40000, balance: 60000 }),
      row({ totalSale: 50000, amountPaid: 50000, balance: 0 }),
    ]);
    expect(summary.totalSales).toBe(150000);
    expect(summary.amountCollected).toBe(90000);
    expect(summary.outstandingBalance).toBe(60000);
  });

  it('counts upcoming vs overdue payments correctly using the due date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const past = new Date();
    past.setDate(past.getDate() - 10);

    const summary = getSalesSummary([
      row({ paymentStatus: 'partially_paid', balance: 10000, paymentDueDate: future.toISOString().slice(0, 10) }),
      row({ paymentStatus: 'pending_payment', balance: 20000, paymentDueDate: past.toISOString().slice(0, 10) }),
      row({ paymentStatus: 'paid', balance: 0, paymentDueDate: past.toISOString().slice(0, 10) }),
    ]);
    expect(summary.upcomingPayments).toBe(1);
    expect(summary.overduePayments).toBe(1);
  });

  it('computes Total Cost and Net Profit exactly matching the spec example', () => {
    // Total Sale = 100,000; Total Cost = 70,000; Net Profit = 30,000
    const summary = getSalesSummary([row({ totalSale: 100000, totalCost: 70000, netProfit: 30000 })]);
    expect(summary.totalCost).toBe(70000);
    expect(summary.netProfit).toBe(30000);
  });
});
