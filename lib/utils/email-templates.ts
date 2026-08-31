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

I've updated the quotation for your ${dest} trip based on the changes you requested. I've attached the revised package details and pricing for your reference.

Please let me know what you think, and if you'd like any further adjustments, I'll be happy to help.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  return {
    subject: `Your ${dest} Travel Quotation`,
    body: `Hi ${params.clientFirstName},

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
 *    -- a real conversation already happened, so the email should
 *    acknowledge that specifically rather than sound like a form reminder.
 * 2. Otherwise, the follow-up NUMBER (1/2/3) -- no signal yet, so the tone
 *    deliberately escalates using the same sequence sales/marketing teams
 *    use for a cold quote: a friendly open-ended check-in first, a gentle
 *    urgency nudge second, and a short, low-pressure "breakup" email last
 *    that offers an easy next step (a quick call) rather than just
 *    repeating the ask. No two variants share an opening line -- a
 *    generic "Hope you're doing well" on every message is exactly the
 *    kind of form-letter tell this whole feature exists to avoid.
 *
 * Every variant only ever references client name, destination, and
 * consultant name -- nothing about specific prices, activities, or
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

  if (params.pipelineStage === 'still_thinking') {
    return {
      subject: `Still deciding on ${dest}?`,
      body: `Hi ${params.clientFirstName},

Just checking in on your ${dest} trip. I know these things take a bit of thought, so no rush at all, just wanted to see where things stand.

If it'd help to talk through any of the options or explore something different, I'm happy to jump on a quick call whenever works for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'requested_changes') {
    return {
      subject: `Your updated ${dest} option`,
      body: `Hi ${params.clientFirstName},

Following up on the ${dest} package, I remember you were looking at a few changes to the itinerary.

Let me know if you'd like me to put together the updated version, happy to get that over to you whenever you're ready.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'interested') {
    return {
      subject: `Ready to lock in your ${dest} trip?`,
      body: `Hi ${params.clientFirstName},

Glad to hear you're interested in the ${dest} trip! Just wanted to check where things stand, let me know if you're ready to move forward, or if there's anything you'd like adjusted first.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  // No specific stage signal yet -- the standard three-touch sequence:
  // open-ended check-in, then gentle urgency, then a short low-pressure
  // final note with an easy next step (a call).
  if (params.followUpNumber <= 1) {
    return {
      subject: `Any questions on your ${dest} package?`,
      body: `Hi ${params.clientFirstName},

Wanted to check if you had a chance to look over the ${dest} package I sent.

Happy to answer any questions or make adjustments to the itinerary if there's anything you'd like changed, just let me know.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.followUpNumber === 2) {
    return {
      subject: `Don't miss out on your ${dest} trip`,
      body: `Hi ${params.clientFirstName},

Circling back on your ${dest} trip, rates and availability for this package can shift, so if you're still considering it, now's a good time to lock it in.

Happy to adjust the hotel, activities, or dates if that helps too. Just let me know how you'd like to proceed.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  return {
    subject: `Closing the loop on your ${dest} trip`,
    body: `Hi ${params.clientFirstName},

Haven't heard back on the ${dest} trip, so I'll go ahead and set this aside for now.

If you're still interested, happy to hop on a quick call or pick things back up anytime, no pressure at all.

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
