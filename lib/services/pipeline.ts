import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

// 8 stages, deliberately starting at "sent" — a draft quotation has no
// pipeline position at all (pipeline_stage is null in the database until
// the quotation is actually sent), matching how the agency actually thinks
// about it: the sales process starts when the client receives something,
// not while it's still being drafted internally.
export const PIPELINE_STAGES = [
  'quotation_sent',
  'follow_up',
  'interested',
  'still_thinking',
  'requested_changes',
  'proceeding',
  'confirmed',
  'not_interested',
  'lost',
  'no_response',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  quotation_sent: 'Quotation Sent',
  follow_up: 'Follow-up',
  interested: 'Interested',
  still_thinking: 'Still Thinking',
  requested_changes: 'Requested Changes',
  proceeding: 'Proceeding',
  confirmed: 'Confirmed',
  not_interested: 'Not Interested',
  lost: 'Lost',
  no_response: 'No Response / Dormant',
};

/** The options offered after completing a follow-up — every stage except the two an agent wouldn't manually pick themselves. */
export const FOLLOWUP_OUTCOME_STAGES: PipelineStage[] = [
  'interested',
  'still_thinking',
  'requested_changes',
  'proceeding',
  'confirmed',
  'not_interested',
  'lost',
  'no_response',
];

/**
 * A lead reaching any of these stages stops the automatic follow-up
 * sequence for good — the lead and quotation stay in the system for
 * historical tracking, but nothing further gets scheduled. Every other
 * stage (Interested, Still Thinking, Requested Changes, Proceeding) keeps
 * the cadence going automatically.
 */
export const CLOSED_PIPELINE_STAGES: PipelineStage[] = ['confirmed', 'not_interested', 'lost', 'no_response'];

/**
 * The one function that ever writes `quotations.pipeline_stage` — every
 * caller (drag on the Kanban board, completing a follow-up, sending a
 * quotation, or a quotation status change syncing the pipeline to match)
 * goes through this, so "record who moved it, previous stage, new stage,
 * when" is guaranteed rather than something each call site has to remember.
 */
export async function updateQuotationPipelineStage(
  supabase: SupabaseClient,
  quotationId: string,
  newStage: PipelineStage,
  actingUserId: string
) {
  const { data: current, error: fetchError } = await supabase
    .from('quotations')
    .select('pipeline_stage')
    .eq('id', quotationId)
    .single();
  if (fetchError || !current) throw new Error('Quotation not found.');

  const previousStage = current.pipeline_stage as PipelineStage | null;
  if (previousStage === newStage) return; // no-op, nothing to record

  const { error } = await supabase.from('quotations').update({ pipeline_stage: newStage }).eq('id', quotationId);
  if (error) throw new Error(`Failed to update pipeline stage: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.pipeline_stage_changed',
    entityType: 'quotation',
    entityId: quotationId,
    metadata: {
      previousStage,
      newStage,
      previousStageLabel: previousStage ? PIPELINE_STAGE_LABELS[previousStage] : null,
      newStageLabel: PIPELINE_STAGE_LABELS[newStage],
    },
  });
}

/**
 * Cards for the Kanban board — deliberately minimal per spec ("Do not show
 * quotation number, quoted price, assigned agent... on the card"). Only
 * quotations that have actually been sent appear (pipeline_stage is null
 * for drafts) — this is not a quotation-management board, drafts stay on
 * the Quotations tab. RLS on `quotations` already scopes this to the
 * caller's own/team quotations, same as every other quotation query.
 */
export async function listQuotationsForPipeline(supabase: SupabaseClient, agentId?: string) {
  let query = supabase
    .from('quotations')
    .select(
      `id, pipeline_stage, pipeline_stage_updated_at,
       client:clients ( full_name ),
       current_version:quotation_versions!quotations_current_version_id_fkey ( destination, travel_start_date )`
    )
    .is('deleted_at', null)
    .not('pipeline_stage', 'is', null)
    .order('pipeline_stage_updated_at', { ascending: false });

  if (agentId) query = query.eq('assigned_agent_id', agentId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load pipeline: ${error.message}`);
  return data ?? [];
}

/** The dashboard's pipeline-specific counts. Follow-ups due/overdue already exist elsewhere (getFollowUpCounts) — not duplicated here. */
export async function getPipelineDashboardCounts(supabase: SupabaseClient) {
  const { data } = await supabase.from('quotations').select('pipeline_stage').is('deleted_at', null);
  const rows = data ?? [];

  const closedStages = new Set<PipelineStage>(['confirmed', 'lost']);
  const totalActiveLeads = rows.filter(
    (r) => r.pipeline_stage && !closedStages.has(r.pipeline_stage as PipelineStage)
  ).length;
  const countOf = (stage: PipelineStage) => rows.filter((r) => r.pipeline_stage === stage).length;

  return {
    totalActiveLeads,
    proceeding: countOf('proceeding'),
    confirmed: countOf('confirmed'),
    lost: countOf('lost'),
    noResponse: countOf('no_response'),
  };
}
