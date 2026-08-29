import { describe, it, expect } from 'vitest';
import { convertQuotationToBooking } from '../bookings';
import { createFakeSupabaseClient } from './test-utils/fake-supabase';

describe('convertQuotationToBooking — the "only a confirmed quotation converts" rule', () => {
  it('refuses to convert a draft quotation', async () => {
    const supabase = createFakeSupabaseClient({
      singleResult: { data: { id: 'q1', status: 'draft', client_id: 'c1', current_version: null }, error: null },
    });
    await expect(convertQuotationToBooking(supabase, 'q1', 'user1')).rejects.toThrow(
      /only a confirmed quotation/i
    );
  });

  it('refuses to convert a sent-but-not-yet-confirmed quotation', async () => {
    const supabase = createFakeSupabaseClient({
      singleResult: { data: { id: 'q1', status: 'sent', client_id: 'c1', current_version: null }, error: null },
    });
    await expect(convertQuotationToBooking(supabase, 'q1', 'user1')).rejects.toThrow(
      /only a confirmed quotation/i
    );
  });

  it('refuses to convert a quotation that does not exist', async () => {
    const supabase = createFakeSupabaseClient({ singleResult: { data: null, error: { message: 'not found' } } });
    await expect(convertQuotationToBooking(supabase, 'missing', 'user1')).rejects.toThrow(/not found/i);
  });

  it('proceeds past the status guard for a confirmed quotation with a version', async () => {
    const supabase = createFakeSupabaseClient({
      singleResult: {
        data: {
          id: 'q1',
          status: 'confirmed',
          client_id: 'c1',
          quotation_number: 'QT-2026-00001',
          assigned_agent_id: 'agent1',
          current_version: {
            id: 'v1',
            destination: 'Boracay',
            travel_start_date: '2026-06-01',
            travel_end_date: '2026-06-04',
            total_price: 50000,
          },
        },
        error: null,
      },
      rpcResult: { data: 'BK-2026-00001', error: null },
      insertResult: { data: { id: 'booking1' }, error: null },
    });
    // Should not throw the status-guard error — it may still fail later in a
    // real run (this fake doesn't model every downstream call), but reaching
    // past the guard for a confirmed quotation is the behavior under test.
    await expect(convertQuotationToBooking(supabase, 'q1', 'user1')).resolves.toBeDefined();
  });
});
