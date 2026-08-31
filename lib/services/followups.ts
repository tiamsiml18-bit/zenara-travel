import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';
import { updateQuotationPipelineStage, FOLLOWUP_OUTCOME_STAGES, CLOSED_PIPELINE_STAGES, type PipelineStage } from './pipeline';

async function getFollowUpScheduleDays(supabase: SupabaseClient): Promise<number[]> {
  const { data } = await supabase.from('quotation_settings').select('followup_schedule_days').limit(1).maybeSingle();
  return data?.followup_schedule_days ?? [2, 3, 5];
}

/** For the admin settings page — the raw settings row, not just the schedule array, so its id is available for the update call. */
export async function getQuotationSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('quotation_settings').select('id, followup_schedule_days').limit(1).maybeSingle();
  if (error) throw new Error(`Failed to load quotation settings: ${error.message}`);
  return data ?? { id: null, followup_schedule_days: [2, 3, 5] };
}

/**
 * Admin-configurable follow-up cadence — never hardcoded. `days` is read as
 * gaps between consecutive follow-ups (days[0] = after send, days[1] =
 * after Follow-up 1's completion, etc.), matching the agency's own example
 * ("Follow-up 2: 3 days after Follow-up 1"). The array length also
 * determines how many follow-ups exist in the sequence — three entries
 * means three follow-ups, four means four, and so on.
 */
export async function updateFollowUpSchedule(supabase: SupabaseClient, settingsId: string | null, days: number[]) {
  if (settingsId) {
    const { error } = await supabase.from('quotation_settings').update({ followup_schedule_days: days }).eq('id', settingsId);
    if (error) throw new Error(`Failed to update follow-up schedule: ${error.message}`);
  } else {
    const { error } = await supabase.from('quotation_settings').insert({ followup_schedule_days: days });
    if (error) throw new Error(`Failed to save follow-up schedule: ${error.message}`);
  }
}

/**
 * Pure date math, deliberately separated from the generate functions so it
 * can be unit tested without a Supabase client — see
 * lib/services/__tests__/followups.test.ts.
 *
 * Uses UTC arithmetic throughout (Date.UTC plus the getUTC/setUTC
 * accessors) rather than local-time getters -- mixing local-time date math
 * with toISOString()'s UTC output is a classic off-by-one-day bug the
 * moment this runs on a server whose timezone isn't UTC. This function is
 * correct regardless of the server's configured timezone.
 */
export function addDaysUtc(base: Date, days: number): string {
  const baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const due = new Date(baseUtc);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString().slice(0, 10);
}

/**
 * Only ever creates Follow-up #1, due schedule[0] days after the quotation
 * was sent. Later follow-ups are never generated upfront -- see
 * generateNextFollowUp, called from completeFollowUp/skipFollowUp below --
 * so the cadence stays sensible even when an agent completes a follow-up
 * late; a batch-generated schedule would otherwise let #2 and #3 fall due
 * before #1 was even handled.
 */
export async function generateFirstFollowUp(
  supabase: SupabaseClient,
  params: { quotationId: string; clientId: string; agentId: string | null; sentAt: Date }
) {
  const scheduleDays = await getFollowUpScheduleDays(supabase);
  const gap = scheduleDays[0] ?? 2;

  const { error } = await supabase.from('follow_ups').insert({
    quotation_id: params.quotationId,
    client_id: params.clientId,
    agent_id: params.agentId,
    due_date: addDaysUtc(params.sentAt, gap),
    status: 'pending' as const,
    sequence_number: 1,
  });
  if (error) throw new Error(`Failed to generate follow-up: ${error.message}`);
}

/**
 * Creates the next follow-up in sequence, due schedule[previousSequenceNumber]
 * days after `baseDate` (the previous follow-up's completion time, not the
 * original send date -- see addDaysUtc's doc comment on why that matters).
 * Silently does nothing once the configured schedule is exhausted (no more
 * entries past the previous sequence number) -- at that point it's up to
 * the agent to record a final outcome (e.g. "No Response / Dormant") the
 * next time they complete a follow-up, rather than the system inventing an
 * interval nobody configured.
 */
export async function generateNextFollowUp(
  supabase: SupabaseClient,
  params: { quotationId: string; clientId: string; agentId: string | null; previousSequenceNumber: number; baseDate: Date }
) {
  const scheduleDays = await getFollowUpScheduleDays(supabase);
  const gap = scheduleDays[params.previousSequenceNumber];
  if (gap === undefined) return; // schedule exhausted -- no more configured follow-ups

  const { error } = await supabase.from('follow_ups').insert({
    quotation_id: params.quotationId,
    client_id: params.clientId,
    agent_id: params.agentId,
    due_date: addDaysUtc(params.baseDate, gap),
    status: 'pending' as const,
    sequence_number: params.previousSequenceNumber + 1,
  });
  if (error) throw new Error(`Failed to schedule the next follow-up: ${error.message}`);
}

export interface FollowUpListFilters {
  bucket: 'due_today' | 'overdue' | 'upcoming' | 'completed';
  agentId?: string;
}

const FOLLOWUP_SELECT = `
  id, due_date, status, outcome, method, notes, completed_at, sequence_number,
  client:clients ( id, full_name, mobile_number, whatsapp_number, messenger_handle, email ),
  quotation:quotations ( id, quotation_number, pipeline_stage,
    current_version:quotation_versions!quotations_current_version_id_fkey ( destination, travel_start_date, travel_end_date, total_price, consultant_name_snapshot ) ),
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

/**
 * The notification bell's data source -- every due-today or overdue
 * follow-up, across every agent (the shared-login model means there's no
 * per-agent inbox to narrow this to; everyone sees the same team-wide
 * list). Kept as its own small query rather than reusing listFollowUps
 * twice, since the bell needs both buckets at once, pre-sorted with
 * overdue first.
 */
export async function listAttentionNeededFollowUps(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('follow_ups')
    .select(FOLLOWUP_SELECT)
    .lte('due_date', today)
    .in('status', ['pending', 'due', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function completeFollowUp(
  supabase: SupabaseClient,
  followUpId: string,
  params: { outcome: string; method: string; notes?: string },
  actingUserId: string
) {
  const { data: followUp, error: fetchError } = await supabase
    .from('follow_ups')
    .select('client_id, quotation_id, agent_id, sequence_number, quotation:quotations ( quotation_number )')
    .eq('id', followUpId)
    .single();
  if (fetchError || !followUp) throw new Error('Follow-up not found.');

  const completedAt = new Date();
  const { error } = await supabase
    .from('follow_ups')
    .update({
      status: 'completed',
      outcome: params.outcome,
      method: params.method,
      notes: params.notes || null,
      completed_at: completedAt.toISOString(),
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
  // status" -- the outcome IS that status when it's one of the pipeline
  // stages a follow-up can resolve to; updateQuotationPipelineStage handles
  // its own "who moved it / previous / new / when" audit entry.
  let newStage: PipelineStage | null = null;
  if (followUp.quotation_id && FOLLOWUP_OUTCOME_STAGES.includes(params.outcome as PipelineStage)) {
    newStage = params.outcome as PipelineStage;
    await updateQuotationPipelineStage(supabase, followUp.quotation_id, newStage, actingUserId);
  }

  // A closed stage (Confirmed / Lost / Not Interested / No Response) stops
  // the sequence for good -- the lead and quotation stay in the system for
  // historical tracking, but no further follow-up gets scheduled. Anything
  // else (Interested, Requested Changes, Still Thinking, Proceeding, or no
  // stage-mapped outcome at all) continues the configured cadence
  // automatically; the agent never has to create the next one by hand.
  const isClosed = newStage !== null && CLOSED_PIPELINE_STAGES.includes(newStage);
  if (!isClosed && followUp.quotation_id) {
    await generateNextFollowUp(supabase, {
      quotationId: followUp.quotation_id,
      clientId: followUp.client_id,
      agentId: followUp.agent_id,
      previousSequenceNumber: followUp.sequence_number ?? 1,
      baseDate: completedAt,
    });
  }
}

/**
 * "Skip Follow-up" -- the agent isn't doing this particular one (couldn't
 * reach the client, wrong timing, whatever), but the sequence itself
 * should continue rather than stop, unlike "Stop Follow-up" below.
 */
export async function skipFollowUp(supabase: SupabaseClient, followUpId: string, actingUserId: string) {
  const { data: followUp, error: fetchError } = await supabase
    .from('follow_ups')
    .select('client_id, quotation_id, agent_id, sequence_number')
    .eq('id', followUpId)
    .single();
  if (fetchError || !followUp) throw new Error('Follow-up not found.');

  const { error } = await supabase.from('follow_ups').update({ status: 'skipped' }).eq('id', followUpId);
  if (error) throw new Error(`Failed to skip follow-up: ${error.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'followup.skipped', entityType: 'follow_up', entityId: followUpId });

  if (followUp.quotation_id) {
    await generateNextFollowUp(supabase, {
      quotationId: followUp.quotation_id,
      clientId: followUp.client_id,
      agentId: followUp.agent_id,
      previousSequenceNumber: followUp.sequence_number ?? 1,
      baseDate: new Date(),
    });
  }
}

/**
 * "Stop Follow-up" -- an explicit agent decision to halt the sequence
 * entirely without necessarily recording a closed pipeline stage (e.g. the
 * client asked not to be contacted again for now, but nothing's formally
 * lost or confirmed yet). Unlike skipFollowUp, this never schedules a next
 * one.
 */
export async function stopFollowUp(supabase: SupabaseClient, followUpId: string, actingUserId: string) {
  const { error } = await supabase.from('follow_ups').update({ status: 'skipped' }).eq('id', followUpId);
  if (error) throw new Error(`Failed to stop follow-up: ${error.message}`);

  await writeAudit(supabase, { userId: actingUserId, action: 'followup.stopped', entityType: 'follow_up', entityId: followUpId });
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

/** Appends a manual note without changing status -- for a quick "left a voicemail" style log. */
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
 * short -- an agent pastes this into Messenger/WhatsApp themselves; nothing
 * here is sent automatically, per spec (no Messenger automation in v1).
 * Re-exported from the shared, framework-free utility so both server code
 * and client components use one implementation.
 */
export { buildFollowUpMessage } from '@/lib/utils/followup-message';
