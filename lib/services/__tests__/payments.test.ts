import { describe, it, expect } from 'vitest';
import {
  addPayment,
  computeDefaultPaymentDueDate,
  computeSettlement,
  getEffectivePaymentDueDate,
  getLatestWaivedAmount,
  getPaymentDisplayStatus,
  isFullySettled,
  toCentavos,
} from '@/lib/services/payments';

describe('rounding & waiver policy — computeSettlement (integer centavos)', () => {
  const total = toCentavos(1000);
  // Remaining balance -> expected outcome. 0.50 is waived (inclusive); 0.51 is not.
  const cases: Array<[number, 'paid' | 'partial', number]> = [
    [0.01, 'paid', 1],
    [0.45, 'paid', 45],
    [0.5, 'paid', 50],
    [0.51, 'partial', 0],
    [1.0, 'partial', 0],
  ];

  it.each(cases)('PHP %s remaining -> %s, waived %s centavos', (remaining, status, waived) => {
    const result = computeSettlement(toCentavos(1000 - remaining), total);
    expect(result.status).toBe(status);
    expect(result.waivedCentavos).toBe(waived);
  });

  it('an exact payment is paid with nothing waived', () => {
    expect(computeSettlement(total, total)).toMatchObject({ status: 'paid', waivedCentavos: 0 });
  });

  it('an overpayment is paid with nothing waived', () => {
    expect(computeSettlement(toCentavos(1000.2), total)).toMatchObject({ status: 'paid', waivedCentavos: 0 });
  });

  it('nothing paid is unpaid — even a tiny total is never waived without a payment', () => {
    expect(computeSettlement(0, total).status).toBe('unpaid');
    expect(computeSettlement(0, toCentavos(0.3)).status).toBe('unpaid');
  });

  it('uses exact centavos: float noise cannot tip the 0.50 boundary', () => {
    expect(toCentavos(50072.45)).toBe(5007245);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
    // 0.1 + 0.7 = 0.7999999999999999 in floats; exactly 50 centavos short of 1.30 — still waived.
    expect(computeSettlement(toCentavos(0.1 + 0.7), toCentavos(1.3)).status).toBe('paid');
    expect(computeSettlement(toCentavos(0.1 + 0.69), toCentavos(1.3)).status).toBe('partial'); // 51 centavos
  });

  it('matches the real bookings: 0.47 and 0.45 settle, BK-2026-00008 stays partial', () => {
    expect(isFullySettled(211549, 211549.47)).toBe(true);
    expect(isFullySettled(50072, 50072.45)).toBe(true);
    expect(isFullySettled(182055, 365400.2)).toBe(false);
  });
});

describe('getLatestWaivedAmount', () => {
  it('returns the newest administrative waiver amount, ignoring other entries', () => {
    const history = [
      { metadata: { changes: [] } },
      { metadata: { type: 'administrative_waiver', waivedAmount: 0.35 } },
      { metadata: { type: 'administrative_waiver', waivedAmount: 0.45 } },
    ];
    expect(getLatestWaivedAmount(history)).toBe(0.35);
  });

  it('is 0 when there is no waiver', () => {
    expect(getLatestWaivedAmount([{ metadata: { amount: 50 } }, { metadata: null }])).toBe(0);
  });
});

// A recording in-memory stand-in for the Supabase client — just enough to run
// addPayment end to end and see exactly what it writes.
function makeRecordingClient(opts: { totalAmount: number; existingPayments: number[]; priorWaivers?: unknown[] }) {
  const calls: Array<{ table: string; op: string; payload: any }> = [];
  const singles: Record<string, unknown> = {
    bookings: { total_amount: opts.totalAmount, client_id: 'client-1', quotation_id: 'quote-1' },
    client_statuses: { id: 'status-paid' },
    quotations: { pipeline_stage: 'confirmed' },
  };
  const lists: Record<string, unknown[]> = {
    payments: opts.existingPayments.map((amount) => ({ amount })),
    audit_logs: opts.priorWaivers ?? [],
  };
  const from = (table: string) => {
    let op = 'select';
    const q: any = {
      select: () => q,
      eq: () => q,
      is: () => q,
      order: () => q,
      limit: () => q,
      single: async () => ({ data: singles[table] ?? null, error: null }),
      insert: (payload: unknown) => {
        calls.push({ table, op: 'insert', payload });
        return Promise.resolve({ data: null, error: null });
      },
      update: (payload: unknown) => {
        op = 'update';
        calls.push({ table, op, payload });
        return q;
      },
      then: (resolve: (v: unknown) => unknown) => resolve({ data: op === 'select' ? lists[table] ?? [] : null, error: null }),
    };
    return q;
  };
  const client = { from } as unknown as import('@supabase/supabase-js').SupabaseClient;
  return { client, calls };
}

describe('addPayment — automatic administrative waiver', () => {
  const input = (amount: number) => ({
    bookingId: 'booking-1',
    amount,
    paymentDate: '2026-11-15',
    method: 'Bank transfer',
    notes: '',
  });

  // [remaining, shouldWaive]
  const cases: Array<[number, boolean]> = [
    [0.01, true],
    [0.45, true],
    [0.5, true],
    [0.51, false],
    [1.0, false],
  ];

  it.each(cases)('PHP %s remaining', async (remaining, shouldWaive) => {
    const { client, calls } = makeRecordingClient({ totalAmount: 1000 + remaining, existingPayments: [1000] });
    const result = await addPayment(client, input(1000), 'user-1');

    const bookingUpdate = calls.find((c) => c.table === 'bookings' && c.op === 'update');
    const waiver = calls.find((c) => c.table === 'audit_logs' && c.payload?.metadata?.type === 'administrative_waiver');
    const paymentInserts = calls.filter((c) => c.table === 'payments' && c.op === 'insert');
    const clientPaid = calls.find((c) => c.table === 'clients' && c.op === 'update');
    const stageChange = calls.find((c) => c.table === 'quotations' && c.op === 'update');

    // Never a fake payment: only the one real payment row is ever inserted, at its real amount.
    expect(paymentInserts).toHaveLength(1);
    expect(paymentInserts[0]!.payload.amount).toBe(1000);

    if (shouldWaive) {
      expect(bookingUpdate!.payload.payment_status).toBe('paid');
      expect(result!.balance).toBe(0);
      expect(waiver).toBeDefined();
      expect(waiver!.payload).toMatchObject({ action: 'booking.updated', entity_type: 'booking', entity_id: 'booking-1', user_id: 'user-1' });
      expect(waiver!.payload.metadata).toMatchObject({
        type: 'administrative_waiver',
        waivedAmount: remaining,
        currency: 'PHP',
        totalAmount: 1000 + remaining,
        totalPaid: 1000,
        appliedBy: 'system',
      });
      expect(typeof waiver!.payload.metadata.waivedAt).toBe('string');
      // Client and quotation stay in sync with the booking.
      expect(clientPaid!.payload).toEqual({ status_id: 'status-paid' });
      expect(stageChange!.payload).toEqual({ pipeline_stage: 'paid' });
    } else {
      expect(bookingUpdate!.payload.payment_status).toBe('partial');
      expect(result!.balance).toBeCloseTo(remaining, 2);
      expect(waiver).toBeUndefined();
      expect(clientPaid).toBeUndefined();
      expect(stageChange).toBeUndefined();
    }
  });

  it('an exact payment is paid with no waiver entry', async () => {
    const { client, calls } = makeRecordingClient({ totalAmount: 1000, existingPayments: [1000] });
    await addPayment(client, input(1000), 'user-1');
    expect(calls.find((c) => c.table === 'bookings' && c.op === 'update')!.payload.payment_status).toBe('paid');
    expect(calls.find((c) => c.payload?.metadata?.type === 'administrative_waiver')).toBeUndefined();
  });

  it('does not write a duplicate waiver when the latest one already covers the same amount', async () => {
    const { client, calls } = makeRecordingClient({
      totalAmount: 1000.45,
      existingPayments: [1000],
      priorWaivers: [{ metadata: { type: 'administrative_waiver', waivedAmount: 0.45 } }],
    });
    await addPayment(client, input(1000), 'user-1');
    expect(calls.find((c) => c.payload?.metadata?.type === 'administrative_waiver')).toBeUndefined();
  });
});

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
