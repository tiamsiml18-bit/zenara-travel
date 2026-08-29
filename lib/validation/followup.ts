import { z } from 'zod';
import { FOLLOWUP_OUTCOME_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/services/pipeline';

// The options offered when completing a follow-up — the same 8 pipeline
// stages a follow-up can resolve to (Interested, Requested Changes, Still
// Thinking, Proceeding, Confirmed, Not Interested, Lost, No Response /
// Dormant), so "ask the agent for the current lead status" and "record the
// follow-up outcome" are the same single choice, not two separate ones.
export const FOLLOWUP_OUTCOMES = FOLLOWUP_OUTCOME_STAGES;

export const FOLLOWUP_METHODS = ['Messenger', 'WhatsApp', 'Email', 'Call', 'Instagram', 'In person'] as const;

// Covers both the current pipeline-stage vocabulary and the older outcome
// values (negotiating, follow_up_later, bare no_response) so historical
// follow-ups completed before this change still render a real label
// instead of a raw enum value — those older values are no longer offered
// as new selections, just still displayable.
export const OUTCOME_LABELS: Record<string, string> = {
  ...PIPELINE_STAGE_LABELS,
  no_response: 'No response',
  negotiating: 'Negotiating',
  follow_up_later: 'Follow up later',
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
