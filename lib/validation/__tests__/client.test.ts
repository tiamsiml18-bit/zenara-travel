import { describe, it, expect } from 'vitest';
import { clientSchema } from '@/lib/validation/client';

// sourceId/statusId/assignedAgentId are required by design: every real call
// site (the full client form and the quotation wizard's quick-create) always
// supplies them — the form renders them as required <select> dropdowns, and
// quickCreateClientAction defaults status to "New Lead" and the agent to the
// current user rather than ever leaving them blank. A client with no source,
// status, or owner would be invisible in most of the app's RLS-scoped views,
// so the schema deliberately doesn't allow that state.
const validBase = {
  fullName: 'Maria Santos',
  mobileNumber: '',
  email: '',
  messengerHandle: '',
  instagramHandle: '',
  whatsappNumber: '',
  sourceId: '11111111-1111-1111-1111-111111111111',
  destination: '',
  travelStartDate: '',
  travelEndDate: '',
  numAdults: 2,
  numChildren: 0,
  quotedPrice: null,
  statusId: '22222222-2222-2222-2222-222222222222',
  assignedAgentId: '33333333-3333-3333-3333-333333333333',
  notes: '',
};

describe('clientSchema — client creation validation', () => {
  it('accepts a fully-populated valid client', () => {
    const result = clientSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects a missing lead source', () => {
    const result = clientSchema.safeParse({ ...validBase, sourceId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing status', () => {
    const result = clientSchema.safeParse({ ...validBase, statusId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing assigned agent', () => {
    const result = clientSchema.safeParse({ ...validBase, assignedAgentId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing full name', () => {
    const result = clientSchema.safeParse({ ...validBase, fullName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a single-character full name', () => {
    const result = clientSchema.safeParse({ ...validBase, fullName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = clientSchema.safeParse({ ...validBase, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid email', () => {
    const result = clientSchema.safeParse({ ...validBase, email: 'maria@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects a negative quoted price', () => {
    const result = clientSchema.safeParse({ ...validBase, quotedPrice: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts a zero quoted price', () => {
    const result = clientSchema.safeParse({ ...validBase, quotedPrice: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects a negative number of adults', () => {
    const result = clientSchema.safeParse({ ...validBase, numAdults: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a travel end date before the start date', () => {
    const result = clientSchema.safeParse({
      ...validBase,
      travelStartDate: '2026-06-10',
      travelEndDate: '2026-06-05',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a travel end date on the same day as the start date', () => {
    const result = clientSchema.safeParse({
      ...validBase,
      travelStartDate: '2026-06-10',
      travelEndDate: '2026-06-10',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a travel end date after the start date', () => {
    const result = clientSchema.safeParse({
      ...validBase,
      travelStartDate: '2026-06-10',
      travelEndDate: '2026-06-15',
    });
    expect(result.success).toBe(true);
  });
});
