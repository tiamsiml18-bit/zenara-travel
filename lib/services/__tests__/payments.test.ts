import { describe, it, expect } from 'vitest';
import { computeDefaultPaymentDueDate, getEffectivePaymentDueDate, getPaymentDisplayStatus } from '@/lib/services/payments';

describe('computeDefaultPaymentDueDate', () => {
  it('is exactly 14 days before travel', () => {
    expect(computeDefaultPaymentDueDate('2026-10-15')).toBe('2026-10-01');
  });

  it('correctly rolls back across a month boundary', () => {
    expect(computeDefaultPaymentDueDate('2026-10-05')).toBe('2026-09-21');
  });
});

describe('getEffectivePaymentDueDate', () => {
  it('uses the manually recorded due date when one is set — the actual arrangement always takes priority over the default', () => {
    const result = getEffectivePaymentDueDate({ payment_due_date: '2026-09-20', travel_start_date: '2026-10-15' });
    expect(result).toBe('2026-09-20'); // NOT 2026-10-01 (the default) — the manual override wins
  });

  it('falls back to the 14-days-before-travel default when nothing was manually recorded', () => {
    const result = getEffectivePaymentDueDate({ payment_due_date: null, travel_start_date: '2026-10-15' });
    expect(result).toBe('2026-10-01');
  });
});

describe('getPaymentDisplayStatus', () => {
  const TODAY = '2026-08-31';

  it('unpaid is always "Deposit Pending", regardless of due date', () => {
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'unpaid', remainingBalance: 100000, effectiveDueDate: '2026-09-15', todayIso: TODAY })
    ).toBe('deposit_pending');
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'unpaid', remainingBalance: 100000, effectiveDueDate: '2026-08-01', todayIso: TODAY })
    ).toBe('deposit_pending');
  });

  it('partial payment before the due date is "Partially Paid"', () => {
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'partial', remainingBalance: 40000, effectiveDueDate: '2026-09-15', todayIso: TODAY })
    ).toBe('partially_paid');
  });

  it('partial payment on or after the due date is "Balance Due"', () => {
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'partial', remainingBalance: 40000, effectiveDueDate: TODAY, todayIso: TODAY })
    ).toBe('balance_due');
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'partial', remainingBalance: 40000, effectiveDueDate: '2026-08-01', todayIso: TODAY })
    ).toBe('balance_due');
  });

  it('paid status, or a zero/negative remaining balance, is always "Paid in Full"', () => {
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'paid', remainingBalance: 0, effectiveDueDate: '2026-09-15', todayIso: TODAY })
    ).toBe('paid_in_full');
    // Regression guard: even if payment_status hasn't been recomputed yet, a
    // zero balance must never show as still owing.
    expect(
      getPaymentDisplayStatus({ paymentStatus: 'partial', remainingBalance: 0, effectiveDueDate: '2026-09-15', todayIso: TODAY })
    ).toBe('paid_in_full');
  });
});
