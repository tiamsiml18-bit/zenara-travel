import { z } from 'zod';

export const FOLLOWUP_OUTCOMES = [
  'no_response',
  'interested',
  'requested_changes',
  'negotiating',
  'confirmed',
  'lost',
  'follow_up_later',
] as const;

export const FOLLOWUP_METHODS = ['Messenger', 'WhatsApp', 'Email', 'Call', 'Instagram', 'In person'] as const;

export const OUTCOME_LABELS: Record<(typeof FOLLOWUP_OUTCOMES)[number], string> = {
  no_response: 'No response',
  interested: 'Interested',
  requested_changes: 'Requested changes',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  lost: 'Lost',
  follow_up_later: 'Follow up later',
};

export const completeFollowUpSchema = z.object({
  followUpId: z.string().uuid(),
  outcome: z.enum(FOLLOWUP_OUTCOMES),
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
