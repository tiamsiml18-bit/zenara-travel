import { z } from 'zod';
import { FOLLOWUP_OUTCOME_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/services/pipeline';

// The options offered when completing a follow-up — the current 6 pipeline
// stages a follow-up can resolve to (Interested, Requested Changes,
// Proceeding, Confirmed, Lost, No Response), so "ask the agent for the
// current lead status" and "record the follow-up outcome" are the same
// single choice, not two separate ones.
export const FOLLOWUP_OUTCOMES = FOLLOWUP_OUTCOME_STAGES;

export const FOLLOWUP_METHODS = ['Messenger', 'WhatsApp', 'Email', 'Call', 'Instagram', 'In person'] as const;

// Covers the current pipeline-stage vocabulary plus every older outcome
// value this app has ever offered (still_thinking and not_interested
// existed briefly before the pipeline was simplified to 8 then 6 stages;
// negotiating/follow_up_later/bare no_response predate the pipeline
// entirely) so historical follow-ups always render a real label instead of
// a raw enum value. None of these older values are offered as new
// selections anymore — this is a display-only fallback.
export const OUTCOME_LABELS: Record<string, string> = {
  ...PIPELINE_STAGE_LABELS,
  no_response: 'No response',
  negotiating: 'Negotiating',
  follow_up_later: 'Follow up later',
  still_thinking: 'Still thinking',
  not_interested: 'Not interested',
  no_response_dormant: 'No response / Dormant',
};

export const completeFollowUpSchema = z.object({
  followUpId: z.string().uuid(),
  outcome: z.string().min(1, 'Select the current status.'),
  method: z.enum(FOLLOWUP_METHODS),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const rescheduleFollowUpSchema = z.object({
  followUpId: z.string().uuid(),
  newDueDate: z.string().min(1, 'Pick a new date.'),
});

export const followUpNoteSchema = z.object({
  followUpId: z.string().uuid(),
  note: z.string().trim().min(1, 'Note cannot be empty.').max(2000),
});
