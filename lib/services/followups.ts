import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';
import { updateQuotationPipelineStage, FOLLOWUP_OUTCOME_STAGES, type PipelineStage } from './pipeline';

async function getFollowUpScheduleDays(supabase: SupabaseClient): Promise<number[]> {
  const { data } = await supabase.from('quotation_settings').select('followup_schedule_days').limit(1).maybeSingle();
  return data?.followup_schedule_days ?? [1, 3, 7, 14];
}

/**
 * Pure date math, deliberately separated from generateFollowUpSchedule so it
 * can be unit tested without a Supabase client — see
 * lib/services/__tests__/followups.test.ts.
 *
 * Uses UTC arithmetic throughout (Date.UTC plus the getUTC/setUTC accessors) rather than
 * local-time getters — mixing local-time date math with toISOString()'s
 * UTC output is a classic off-by-one-day bug the moment this runs on a
 * server whose timezone isn't UTC. This function is correct regardless of
 * the server's configured timezone.
 */
export function computeFollowUpDueDates(sentAt: Date, scheduleDays: number[]): string[] {
  const baseUtc = Date.UTC(sentAt.getUTCFullYear(), sentAt.getUTCMonth(), sentAt.getUTCDate());
  return scheduleDays.map((offset) => {
    const due = new Date(baseUtc);
    due.setUTCDate(due.getUTCDate() + offset);
    return due.toISOString().slice(0, 10);
  });
}

export async function generateFollowUpSchedule(
  supabase: SupabaseClient,
  params: { quotationId: string; clientId: string; agentId: string | null; sentAt: Date }
) {
  const scheduleDays = await getFollowUpScheduleDays(supabase);
  const dueDates = computeFollowUpDueDates(params.sentAt, scheduleDays);

  const rows = dueDates.map((due_date) => ({
    quotation_id: params.quotationId,
    client_id: params.clientId,
    agent_id: params.agentId,
    due_date,
    status: 'pending' as const,
  }));

  const { error } = await supabase.from('follow_ups').insert(rows);
  if (error) throw new Error(`Failed to generate follow-up schedule: ${error.message}`);
}

export interface FollowUpListFilters {
  bucket: 'due_today' | 'overdue' | 'upcoming' | 'completed';
  agentId?: string;
}

const FOLLOWUP_SELECT = `
  id, due_date, status, outcome, method, notes, completed_at,
  client:clients ( id, full_name, mobile_number, whatsapp_number, messenger_handle, email ),
  quotation:quotations ( id, quotation_number,
    current_version:quotation_versions!quotations_current_version_id_fkey ( destination, travel_start_date, travel_end_date, total_price ) ),
  agent:users ( id, full_name )
`;

export async function listFollowUps(supabase: SupabaseClient, filters: FollowUpListFilters) {
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase.from('follow_ups').select(FOLLOWUP_SELECT);

  if (filters.bucket === 'due_today') query = query.eq('due_date', today).in('status', ['pending', 'due']);
  if (filters.bucket === 'overdue') query = query.lt('due_date', today).in('status', ['pending', 'due', 'overdue']);
  if (filters.bucket === 'upcoming') query = query.gt('due_date', today).in('status', ['pending', 'due']);
  if (filters.bucket === 'completed') query = query.eq('status', 'completed');
  if (filters.agentId) query = query.eq('agent_id', filters.agentId);

  const { data, error } = await query.order('due_date', { ascending: filters.bucket !== 'completed' });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Counts for the four dashboard tab labels, scoped by the same RLS as listFollowUps. */
export async function getFollowUpCounts(supabase: SupabaseClient, agentId?: string) {
  const today = new Date().toISOString().slice(0, 10);

  const baseQuery = () => {
    let q = supabase.from('follow_ups').select('id', { count: 'exact', head: true });
    if (agentId) q = q.eq('agent_id', agentId);
    return q;
  };

  const [dueToday, overdue, upcoming, completed] = await Promise.all([
    baseQuery().eq('due_date', today).in('status', ['pending', 'due']),
    baseQuery().lt('due_date', today).in('status', ['pending', 'due', 'overdue']),
    baseQuery().gt('due_date', today).in('status', ['pending', 'due']),
    baseQuery().eq('status', 'completed'),
  ]);

  return {
    dueToday: dueToday.count ?? 0,
    overdue: overdue.count ?? 0,
    upcoming: upcoming.count ?? 0,
    completed: completed.count ?? 0,
  };
}

export async function completeFollowUp(
  supabase: SupabaseClient,
  followUpId: string,
  params: { outcome: string; method: string; notes?: string },
  actingUserId: string
) {
  const { data: followUp, error: fetchError } = await supabase
    .from('follow_ups')
    .select('client_id, quotation_id, quotation:quotations ( quotation_number )')
    .eq('id', followUpId)
    .single();
  if (fetchError || !followUp) throw new Error('Follow-up not found.');

  const { error } = await supabase
    .from('follow_ups')
    .update({
      status: 'completed',
      outcome: params.outcome,
      method: params.method,
      notes: params.notes || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', followUpId);
  if (error) throw new Error(`Failed to complete follow-up: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: followUp.client_id,
    activity_type: 'followup_completed',
    description: `Follow-up completed via ${params.method}. Outcome: ${params.outcome.replace(/_/g, ' ')}.${
      params.notes ? ` ${params.notes}` : ''
    }`,
    user_id: actingUserId,
    related_quotation_id: followUp.quotation_id,
  });

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'followup.completed',
    entityType: 'follow_up',
    entityId: followUpId,
    metadata: { outcome: params.outcome, method: params.method },
  });

  // "After completing a follow-up, ask the agent for the current lead
  // status" — the outcome IS that status when it's one of the 8 pipeline
  // stages a follow-up can resolve to; updateQuotationPipelineStage handles
  // its own "who moved it / previous / new / when" audit entry.
  if (followUp.quotation_id && FOLLOWUP_OUTCOME_STAGES.includes(params.outcome as PipelineStage)) {
    await updateQuotationPipelineStage(supabase, followUp.quotation_id, params.outcome as PipelineStage, actingUserId);
  }
}

export async function rescheduleFollowUp(
  supabase: SupabaseClient,
  followUpId: string,
  newDueDate: string,
  actingUserId: string
) {
  const { error } = await supabase
    .from('follow_ups')
    .update({ due_date: newDueDate, status: 'pending' })
    .eq('id', followUpId);
  if (error) throw new Error(`Failed to reschedule follow-up: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'followup.rescheduled',
    entityType: 'follow_up',
    entityId: followUpId,
    metadata: { newDueDate },
  });
}

/** Appends a manual note without changing status — for a quick "left a voicemail" style log. */
export async function addFollowUpNote(
  supabase: SupabaseClient,
  followUpId: string,
  note: string,
  actingUserId: string
) {
  const { data: existing, error: fetchError } = await supabase
    .from('follow_ups')
    .select('notes, client_id, quotation_id')
    .eq('id', followUpId)
    .single();
  if (fetchError || !existing) throw new Error('Follow-up not found.');

  const stamp = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const combinedNotes = existing.notes ? `${existing.notes}\n[${stamp}] ${note}` : `[${stamp}] ${note}`;

  const { error } = await supabase.from('follow_ups').update({ notes: combinedNotes }).eq('id', followUpId);
  if (error) throw new Error(`Failed to add note: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: existing.client_id,
    activity_type: 'note_added',
    description: `Follow-up note: ${note.length > 140 ? `${note.slice(0, 140)}…` : note}`,
    user_id: actingUserId,
    related_quotation_id: existing.quotation_id,
  });
}

/**
 * Generates the copy-paste follow-up message text. Deliberately plain and
 * short — an agent pastes this into Messenger/WhatsApp themselves; nothing
 * here is sent automatically, per spec (no Messenger automation in v1).
 * Re-exported from the shared, framework-free utility so both server code
 * and client components use one implementation.
 */
export { buildFollowUpMessage } from '@/lib/utils/followup-message';
