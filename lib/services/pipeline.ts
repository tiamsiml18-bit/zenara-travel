import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

export const PIPELINE_STAGES = [
  'new_lead',
  'quotation_in_progress',
  'quotation_sent',
  'follow_up',
  'interested',
  'requested_changes',
  'still_thinking',
  'proceeding',
  'confirmed',
  'not_interested',
  'lost',
  'no_response_dormant',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new_lead: 'New Lead',
  quotation_in_progress: 'Quotation in Progress',
  quotation_sent: 'Quotation Sent',
  follow_up: 'Follow-up',
  interested: 'Interested',
  requested_changes: 'Requested Changes',
  still_thinking: 'Still Thinking',
  proceeding: 'Proceeding',
  confirmed: 'Confirmed',
  not_interested: 'Not Interested',
  lost: 'Lost',
  no_response_dormant: 'No Response / Dormant',
};

/** The 8 outcomes offered after completing a follow-up — deliberately a subset of PIPELINE_STAGES. */
export const FOLLOWUP_OUTCOME_STAGES: PipelineStage[] = [
  'interested',
  'requested_changes',
  'still_thinking',
  'proceeding',
  'confirmed',
  'not_interested',
  'lost',
  'no_response_dormant',
];

/**
 * The one function that ever writes `quotations.pipeline_stage` — every
 * caller (drag on the Kanban board, completing a follow-up, sending a
 * quotation) goes through this, so "record who moved it, previous stage,
 * new stage, when" is guaranteed rather than something each call site has
 * to remember to do itself.
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

  const previousStage = current.pipeline_stage as PipelineStage;
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
      previousStageLabel: PIPELINE_STAGE_LABELS[previousStage],
      newStageLabel: PIPELINE_STAGE_LABELS[newStage],
    },
  });
}

/**
 * Cards for the Kanban board — deliberately minimal per spec ("Do not show
 * quotation number, quoted price, assigned agent... on the card"). RLS on
 * `quotations` already scopes this to the caller's own/team quotations, same
 * as every other quotation query in the app.
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

  const closedStages = new Set<PipelineStage>(['confirmed', 'not_interested', 'lost']);
  const totalActiveLeads = rows.filter((r) => !closedStages.has(r.pipeline_stage as PipelineStage)).length;
  const countOf = (stage: PipelineStage) => rows.filter((r) => r.pipeline_stage === stage).length;

  return {
    totalActiveLeads,
    proceeding: countOf('proceeding'),
    confirmed: countOf('confirmed'),
    lost: countOf('lost'),
    noResponse: countOf('no_response_dormant'),
  };
}
