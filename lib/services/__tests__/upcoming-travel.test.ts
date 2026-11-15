import { describe, it, expect, vi, afterEach } from 'vitest';
import { getUpcomingConfirmedTravel } from '@/lib/services/reports';

type Row = Record<string, any>;

// An in-memory stand-in that really applies eq / is / gte / order / limit, so
// the test proves which bookings the query's filters let through.
function makeBookingsClient(rows: Row[]) {
  const filters: Array<(r: Row) => boolean> = [];
  let orderBy: { col: string; asc: boolean } | null = null;
  let max = Infinity;
  const q: any = {
    select: () => q,
    eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
    is: (col: string, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), q),
    gte: (col: string, v: string) => (filters.push((r) => r[col] >= v), q),
    order: (col: string, o: { ascending: boolean }) => ((orderBy = { col, asc: o.ascending }), q),
    limit: (n: number) => ((max = n), q),
    then: (resolve: (v: unknown) => unknown) => {
      let out = rows.filter((r) => filters.every((f) => f(r)));
      if (orderBy) out = [...out].sort((a, b) => (orderBy!.asc ? 1 : -1) * String(a[orderBy!.col]).localeCompare(String(b[orderBy!.col])));
      resolve({ data: out.slice(0, max), error: null });
    },
  };
  return { from: (t: string) => (t === 'bookings' ? q : (() => { throw new Error(`unexpected table ${t}`); })()) } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const booking = (over: Row): Row => ({
  id: 'b', quotation_id: 'q', destination: 'Somewhere', travel_start_date: '2026-12-10', travel_end_date: '2026-12-14',
  status: 'confirmed', payment_status: 'paid', deleted_at: null,
  client: { full_name: 'Client' }, quotation: { quotation_number: 'QT-1' }, ...over,
});

describe('getUpcomingConfirmedTravel', () => {
  afterEach(() => vi.useRealTimers());

  const today = () => vi.useFakeTimers().setSystemTime(new Date('2026-11-16T00:00:00Z'));

  it('shows confirmed + fully paid upcoming bookings (Irabon, Joe Marie) and hides Romeo (partial), earliest first', async () => {
    today();
    const rows = [
      booking({ id: 'joe', quotation_id: 'qt-1505', client: { full_name: 'Joe Marie Bautista-Schiffner' }, destination: 'Boracay', travel_start_date: '2026-12-19' }),
      booking({ id: 'romeo', quotation_id: 'qt-1220', client: { full_name: 'Romeo Tambua' }, payment_status: 'partial', travel_start_date: '2026-12-12' }),
      // Irabon's quotation status is null after a revision — irrelevant now, the booking is what counts.
      booking({ id: 'irabon', quotation_id: 'qt-1506', client: { full_name: 'Dr. Ma. Jeniffer Irabon' }, quotation: { quotation_number: 'QT-2026-01506' }, destination: 'Da Nang, Vietnam', travel_start_date: '2026-12-02' }),
    ];
    const result = await getUpcomingConfirmedTravel(makeBookingsClient(rows));
    expect(result.map((r) => r.clientName)).toEqual(['Dr. Ma. Jeniffer Irabon', 'Joe Marie Bautista-Schiffner']);
    expect(result[0]).toEqual({
      quotationId: 'qt-1506',
      quotationNumber: 'QT-2026-01506',
      clientName: 'Dr. Ma. Jeniffer Irabon',
      destination: 'Da Nang, Vietnam',
      travelStartDate: '2026-12-02',
      travelEndDate: '2026-12-14',
    });
  });

  it('excludes unpaid, partial, cancelled, pending, soft-deleted and past-dated bookings', async () => {
    today();
    const rows = [
      booking({ id: 'ok', client: { full_name: 'Eligible' } }),
      booking({ id: 'unpaid', payment_status: 'unpaid' }),
      booking({ id: 'partial', payment_status: 'partial' }),
      booking({ id: 'cancelled', status: 'cancelled' }),
      booking({ id: 'pending', status: 'pending' }),
      booking({ id: 'deleted', deleted_at: '2026-11-01T00:00:00Z' }),
      booking({ id: 'past', travel_start_date: '2026-10-04' }),
    ];
    const result = await getUpcomingConfirmedTravel(makeBookingsClient(rows));
    expect(result.map((r) => r.clientName)).toEqual(['Eligible']);
  });

  it('includes a trip departing today and sorts strictly by earliest travel date', async () => {
    today();
    const rows = [
      booking({ id: 'c', client: { full_name: 'C' }, travel_start_date: '2027-01-05' }),
      booking({ id: 'a', client: { full_name: 'A' }, travel_start_date: '2026-11-16' }),
      booking({ id: 'b', client: { full_name: 'B' }, travel_start_date: '2026-12-01' }),
    ];
    const result = await getUpcomingConfirmedTravel(makeBookingsClient(rows));
    expect(result.map((r) => r.clientName)).toEqual(['A', 'B', 'C']);
  });

  it('keeps the existing cap of 8 (earliest 8 kept)', async () => {
    today();
    const rows = Array.from({ length: 10 }, (_, i) => booking({ id: `b${i}`, client: { full_name: `C${i}` }, travel_start_date: `2026-12-${String(10 + i).padStart(2, '0')}` }));
    const result = await getUpcomingConfirmedTravel(makeBookingsClient(rows));
    expect(result).toHaveLength(8);
    expect(result[0]!.clientName).toBe('C0');
  });

  it('handles an array-shaped embed and a missing client', async () => {
    today();
    const rows = [booking({ client: [{ full_name: 'Arr' }], quotation: [{ quotation_number: 'QT-9' }] }), booking({ id: 'x', client: null, travel_start_date: '2026-12-20' })];
    const result = await getUpcomingConfirmedTravel(makeBookingsClient(rows));
    expect(result[0]).toMatchObject({ clientName: 'Arr', quotationNumber: 'QT-9' });
    expect(result[1]!.clientName).toBe('Unknown');
  });
});
