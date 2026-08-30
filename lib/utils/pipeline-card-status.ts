import type { PipelineStage } from '@/lib/services/pipeline';
import { CLOSED_PIPELINE_STAGES } from '@/lib/services/pipeline';

export type CardStatusKind = 'needs_attention' | 'upcoming' | 'active' | 'waiting';

export interface CardStatus {
  kind: CardStatusKind;
  progressLabel: string; // "Follow-up 1 of 3"
  detail: string; // "Due today" / "Overdue by 2 days" / "Due Sep 5, 2026" / "Next: Sep 5, 2026" / "Waiting for client"
}

export interface LatestFollowUp {
  due_date: string;
  status: string; // 'pending' | 'due' | 'overdue' | 'completed' | 'skipped'
  sequence_number: number;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Whole-day difference (due minus today), using UTC calendar days so this can't be thrown off by a mid-day server timezone. */
function daysUntil(dueDateIso: string, todayIso: string): number {
  const due = Date.UTC(...(dueDateIso.split('-').map(Number) as [number, number, number]));
  const today = Date.UTC(...(todayIso.split('-').map(Number) as [number, number, number]));
  return Math.round((due - today) / 86400000);
}

/**
 * The single place a pipeline card's status badge gets decided — reusing
 * exactly the follow_ups data the notification bell and Follow-ups list
 * already read (never a second, parallel status system), per spec. A
 * quotation in a closed stage (Confirmed / Not Interested / Lost / No
 * Response) never gets a badge here — the sequence has already stopped for
 * it, and the Kanban column itself already shows that.
 *
 * "Upcoming" (orange) vs "Active" (green) is a genuine interpretation call
 * on my part — the spec describes them almost identically and its own
 * examples reuse the same date for both. I split them by proximity: due
 * within 3 days is "coming up soon" (orange), further out is comfortably
 * "active" (green). Worth confirming this matches what you actually want.
 */
export function computeCardStatus(
  stage: PipelineStage,
  latestFollowUp: LatestFollowUp | null,
  scheduleLength: number,
  todayIso: string
): CardStatus | null {
  if (CLOSED_PIPELINE_STAGES.includes(stage)) return null;

  // No follow-up at all, or the most recent one is completed/skipped with
  // nothing newer generated after it (schedule exhausted, or manually
  // stopped) — nothing is automatically scheduled right now, but the lead
  // isn't closed either. Per spec: never show a follow-up count once the
  // sequence has ended.
  if (!latestFollowUp || latestFollowUp.status === 'completed' || latestFollowUp.status === 'skipped') {
    return { kind: 'waiting', progressLabel: '', detail: 'Waiting for client' };
  }

  const progressLabel = `Follow-up ${latestFollowUp.sequence_number} of ${scheduleLength}`;
  const diff = daysUntil(latestFollowUp.due_date, todayIso);

  if (diff < 0) {
    const days = Math.abs(diff);
    return { kind: 'needs_attention', progressLabel, detail: `Overdue by ${days} day${days === 1 ? '' : 's'}` };
  }
  if (diff === 0) {
    return { kind: 'needs_attention', progressLabel, detail: 'Due today' };
  }
  if (diff <= 3) {
    return { kind: 'upcoming', progressLabel, detail: `Due ${formatDateShort(latestFollowUp.due_date)}` };
  }
  return { kind: 'active', progressLabel, detail: `Next: ${formatDateShort(latestFollowUp.due_date)}` };
}
