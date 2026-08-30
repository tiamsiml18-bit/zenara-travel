import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedClientRow } from '@/lib/validation/import';
import { writeAudit } from './audit';

/**
 * Cross-references the emails/mobile numbers in an uploaded batch against
 * existing (non-deleted) clients. Done as two `IN (...)` queries rather than
 * one row at a time — for a sheet with a few thousand rows this is two round
 * trips total instead of thousands, which is the whole point given the
 * spec's "support thousands of rows without freezing" requirement.
 */
export async function findExistingContacts(
  supabase: SupabaseClient,
  emails: string[],
  mobileNumbers: string[]
): Promise<{ emails: Set<string>; mobiles: Set<string> }> {
  const uniqueEmails = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  const uniqueMobiles = [...new Set(mobileNumbers.filter(Boolean))];

  const [emailResult, mobileResult] = await Promise.all([
    uniqueEmails.length > 0
      ? supabase.from('clients').select('email').is('deleted_at', null).in('email', uniqueEmails)
      : Promise.resolve({ data: [] as { email: string }[] }),
    uniqueMobiles.length > 0
      ? supabase.from('clients').select('mobile_number').is('deleted_at', null).in('mobile_number', uniqueMobiles)
      : Promise.resolve({ data: [] as { mobile_number: string }[] }),
  ]);

  return {
    emails: new Set((emailResult.data ?? []).map((r) => (r.email ?? '').toLowerCase())),
    mobiles: new Set((mobileResult.data ?? []).map((r) => r.mobile_number ?? '')),
  };
}

export interface LookupMaps {
  statusIdByName: Map<string, string>;
  sourceIdByName: Map<string, string>;
  agentIdByName: Map<string, string>;
}

export async function getImportLookupMaps(supabase: SupabaseClient): Promise<LookupMaps> {
  const [{ data: statuses }, { data: sources }, { data: agents }] = await Promise.all([
    supabase.from('client_statuses').select('id, name'),
    supabase.from('client_sources').select('id, name'),
    supabase.from('users').select('id, full_name').eq('is_active', true),
  ]);

  return {
    statusIdByName: new Map((statuses ?? []).map((s) => [s.name.toLowerCase(), s.id])),
    sourceIdByName: new Map((sources ?? []).map((s) => [s.name.toLowerCase(), s.id])),
    agentIdByName: new Map((agents ?? []).map((a) => [a.full_name.toLowerCase(), a.id])),
  };
}

const BATCH_SIZE = 500;

/**
 * Inserts already-validated, already-deduplicated rows in batches. The
 * caller (the commit server action) is responsible for having already
 * excluded invalid and duplicate rows — this function trusts its input and
 * focuses purely on writing efficiently at thousands-of-rows scale.
 */
export async function bulkImportClients(
  supabase: SupabaseClient,
  rows: NormalizedClientRow[],
  lookups: LookupMaps,
  actingUserId: string
): Promise<{ imported: number }> {
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data: inserted, error } = await supabase
      .from('clients')
      .insert(
        batch.map((row) => ({
          full_name: row.fullName,
          mobile_number: row.mobileNumber,
          email: row.email,
          destination: row.destination,
          travel_start_date: row.travelStartDate,
          travel_end_date: row.travelEndDate,
          quoted_price: row.quotedPrice,
          status_id: row.statusName ? lookups.statusIdByName.get(row.statusName.toLowerCase()) ?? null : null,
          source_id: row.sourceName ? lookups.sourceIdByName.get(row.sourceName.toLowerCase()) ?? null : null,
          assigned_agent_id: row.agentName ? lookups.agentIdByName.get(row.agentName.toLowerCase()) ?? null : null,
          notes: row.notes,
        }))
      )
      .select('id');

    if (error) throw new Error(`Import failed on rows ${i + 1}–${i + batch.length}: ${error.message}`);

    // Seed each new client's timeline, same as a manually-created client would get.
    if (inserted && inserted.length > 0) {
      await supabase.from('client_activities').insert(
        inserted.map((c) => ({
          client_id: c.id,
          activity_type: 'client_created' as const,
          description: 'Client created via Excel import.',
          user_id: actingUserId,
        }))
      );
    }

    imported += inserted?.length ?? 0;
  }

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'clients.imported',
    entityType: 'client',
    metadata: { count: imported },
  });

  return { imported };
}
