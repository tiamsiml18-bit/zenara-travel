import type { PipelineStage } from '@/lib/services/pipeline';

export interface EmailDraft {
  subject: string;
  body: string;
}

const SIGN_OFF = (consultantFirstName: string) => `Best,\n${consultantFirstName}`;

/**
 * The quotation email — sent once for the original quote, and again
 * (with different, revision-aware wording) whenever a revised version
 * goes out after the client asked for changes. Deliberately doesn't
 * restate pricing or itinerary details either way: the PDF attachment
 * already has all of that, and repeating it here would make the email
 * read like a form letter instead of a short personal note.
 */
export function generateQuotationEmail(params: {
  clientFirstName: string;
  destination: string;
  consultantFirstName: string;
  isRevision?: boolean;
}): EmailDraft {
  const dest = titleCase(params.destination);

  if (params.isRevision) {
    return {
      subject: `Updated ${dest} Travel Quotation`,
      body: `Hi ${params.clientFirstName},

Hope you're doing well.

I've updated the quotation for your ${dest} trip based on the changes you requested. I've attached the revised package details and pricing for your reference.

Please let me know what you think, and if you'd like any further adjustments, I'll be happy to help.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  return {
    subject: `Your ${dest} Travel Quotation`,
    body: `Hi ${params.clientFirstName},

Hope you're doing well.

I'm sending over the quotation for your ${dest} trip. I've attached the full package details and pricing for your reference.

Please let me know what you think, and if you'd like us to adjust anything, I'll be happy to help.

${SIGN_OFF(params.consultantFirstName)}`,
  };
}

/**
 * Follow-up emails vary by two things, in this priority order:
 *
 * 1. The lead's current pipeline stage, when it's one that reflects an
 *    actual client signal (Still Thinking, Requested Changes, Interested)
 *    — a real conversation already happened, so the email should
 *    acknowledge that specifically rather than sound like a form reminder.
 * 2. Otherwise, the follow-up NUMBER (1/2/3) — no signal yet, so the
 *    message escalates gently from a friendly first check-in to a final
 *    polite one, per spec.
 *
 * Every variant only ever references client name, destination, and
 * consultant name — nothing about specific prices, activities, or
 * conversation content the CRM doesn't actually have, since inventing that
 * is explicitly disallowed.
 */
export function generateFollowUpEmail(params: {
  clientFirstName: string;
  destination: string;
  consultantFirstName: string;
  followUpNumber: number;
  pipelineStage: PipelineStage | null;
}): EmailDraft {
  const dest = titleCase(params.destination);
  const subject = `Following Up: Your ${dest} Trip`;

  if (params.pipelineStage === 'still_thinking') {
    return {
      subject,
      body: `Hi ${params.clientFirstName},

Hope all is well.

Just checking in regarding your ${dest} trip. I wanted to see if you've had a chance to decide on the package.

If you'd like to change anything or explore another option, feel free to message me anytime.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'requested_changes') {
    return {
      subject,
      body: `Hi ${params.clientFirstName},

Hope you're doing well.

I'm following up regarding your ${dest} package. I remember you were looking at some changes to the itinerary.

Let me know if you'd like me to prepare the updated option for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'interested') {
    return {
      subject,
      body: `Hi ${params.clientFirstName},

Hope you're doing well.

Just wanted to follow up since you mentioned you were interested in the ${dest} trip. Let me know if you'd like to move forward, or if there's anything you'd like adjusted first.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  // No specific stage signal yet — vary by how many times we've already
  // followed up, per spec: friendly (1) -> reminder + offer to help (2) ->
  // final polite check-in (3+), never sounding pushy at any point.
  if (params.followUpNumber <= 1) {
    return {
      subject,
      body: `Hi ${params.clientFirstName},

Hope you're doing well.

Just wanted to check if you had a chance to look over the ${dest} package we sent.

If you have any questions or would like to adjust anything in the itinerary, feel free to let me know.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.followUpNumber === 2) {
    return {
      subject,
      body: `Hi ${params.clientFirstName},

Hope you're doing well.

Just checking in regarding your upcoming ${dest} trip. I wanted to see if you had a chance to review the package we sent.

If you'd like to change the hotel, activities, or dates, feel free to let me know.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  return {
    subject,
    body: `Hi ${params.clientFirstName},

Hope you're doing well.

Just wanted to reach out one more time about the ${dest} trip in case it's still something you're considering. No pressure at all, I'm happy to help whenever the timing works for you.

${SIGN_OFF(params.consultantFirstName)}`,
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}
