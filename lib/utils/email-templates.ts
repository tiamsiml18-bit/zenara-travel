import type { PipelineStage } from '@/lib/services/pipeline';

export interface EmailDraft {
  subject: string;
  body: string;
}

const SIGN_OFF = (consultantFirstName: string) => `Best,\n${consultantFirstName}`;

/**
 * The quotation email -- sent once for the original quote, and again
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

function formatValidUntil(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Payment reminders are their own category, entirely separate from the
 * sales follow-up sequence above — different purpose (a confirmed booking
 * collecting its balance, not a lead deciding whether to book), different
 * trigger (24 hours before the actual payment due date, not a follow-up
 * schedule), and it must never be confused with Follow-up #1/#2/#3 or any
 * pipeline stage. Always uses the REAL remaining balance and due date from
 * the booking record — never assumes the default 50/50 split, since the
 * actual recorded payment arrangement always takes priority.
 */
export function generatePaymentReminderEmail(params: {
  clientFirstName: string;
  destination: string;
  consultantFirstName: string;
  remainingBalance: number;
  dueDate: string;
}): EmailDraft {
  const dest = titleCase(params.destination);
  const dueDateFormatted = formatValidUntil(params.dueDate);
  const balanceFormatted = `PHP ${params.remainingBalance.toLocaleString('en-PH')}`;

  return {
    subject: `A quick reminder about your ${dest} trip`,
    body: `Hi ${params.clientFirstName},

Just a quick reminder regarding the remaining balance for your upcoming ${dest} trip, which is due on ${dueDateFormatted}.

The remaining balance is ${balanceFormatted}.

If you've already settled this, please disregard this message.

If you need anything from us before your trip, feel free to let me know.

${SIGN_OFF(params.consultantFirstName)}`,
  };
}

/**
 * Follow-up emails vary by two things, and CRITICALLY, both dimensions
 * apply together, not one-or-the-other:
 *
 * 1. The lead's current pipeline stage, when it's one that reflects an
 *    actual client signal (Still Thinking, Requested Changes, Interested)
 *    -- a real conversation already happened, so the email should
 *    acknowledge that specifically rather than sound like a form reminder.
 * 2. The follow-up NUMBER (1/2/3+) -- ALWAYS varies the wording within
 *    whichever stage applies. A lead can sit in "Still Thinking" for
 *    several follow-up cycles in a row; if the stage-specific email never
 *    also changed with the follow-up number, the exact same email would
 *    go out verbatim every single time that stage persisted -- a worse
 *    version of the generic "Hope you're doing well" problem this
 *    feature exists to solve. So every stage below has its own 1/2/3+
 *    progression, same as the no-signal-yet sequence does:
 *
 *    #1 Review and offer help -- simple, friendly, just checking they saw it.
 *    #2 Customization and decision support -- names the specific things
 *       that can still be adjusted (hotel, tours, itinerary, dates, guest
 *       arrangements), using the real hotel name on file when there is one.
 *    #3+ Timing and final check-in -- uses the quotation's actual validity
 *       date when it's set, never an invented sense of urgency or scarcity.
 *
 * No two of the three share an opening line or structure -- a generic
 * "Hope you're doing well" (or any other identical opener) on every
 * message is exactly the kind of form-letter tell this feature exists to
 * avoid. Every variant only ever references real CRM data (client name,
 * destination, hotel, validity date, consultant name) -- nothing about
 * prices, availability, or conversation content the CRM doesn't actually
 * have, since inventing that is explicitly disallowed.
 */
export function generateFollowUpEmail(params: {
  clientFirstName: string;
  destination: string;
  consultantFirstName: string;
  followUpNumber: number;
  pipelineStage: PipelineStage | null;
  hotelName?: string | null;
  validUntil?: string | null;
}): EmailDraft {
  const dest = titleCase(params.destination);
  const changeOptions = params.hotelName
    ? `staying somewhere other than ${params.hotelName}, adjusting the tours or itinerary, or changing the travel dates`
    : `the hotel, tours, itinerary, or travel dates`;
  const timingLine = params.validUntil
    ? `This quotation is valid until ${formatValidUntil(params.validUntil)}, so let me know if you'd like to move forward before then`
    : `I'm happy to update the package or check the latest options whenever you're ready`;

  if (params.pipelineStage === 'still_thinking') {
    if (params.followUpNumber <= 1) {
      return {
        subject: `Still deciding on your ${dest} trip?`,
        body: `Hi ${params.clientFirstName},

Just checking in on your ${dest} trip. I know these things take a bit of thought, so no rush at all, just wanted to see where things stand.

If it'd help to talk through any of the options or explore something different, I'm happy to jump on a quick call whenever works for you.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    if (params.followUpNumber === 2) {
      return {
        subject: `A different take on your ${dest} trip?`,
        body: `Hi ${params.clientFirstName},

Wanted to check back in on the ${dest} trip. If it would help to see a different option, we can look at ${changeOptions}.

Happy to put a revised version together whenever that's useful.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    return {
      subject: `Your ${dest} trip, whenever you're ready`,
      body: `Hi ${params.clientFirstName},

Just a quick note in case you're still weighing the ${dest} trip. ${timingLine}.

No pressure at all, feel free to reach out whenever the timing works for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'requested_changes') {
    if (params.followUpNumber <= 1) {
      return {
        subject: `Your updated ${dest} option`,
        body: `Hi ${params.clientFirstName},

Following up on the ${dest} package, I remember you were looking at a few changes to the itinerary.

Let me know if you'd like me to put together the updated version, happy to get that over to you whenever you're ready.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    if (params.followUpNumber === 2) {
      return {
        subject: `Ready for the updated ${dest} package?`,
        body: `Hi ${params.clientFirstName},

Just checking back on the changes you mentioned for your ${dest} trip. Whenever you're ready, I can put the updated version together and send it straight over.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    return {
      subject: `Checking in on your ${dest} package`,
      body: `Hi ${params.clientFirstName},

Wanted to check in one more time about the updates to your ${dest} package. ${timingLine}.

If you're still interested, happy to put that together whenever works for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.pipelineStage === 'interested') {
    if (params.followUpNumber <= 1) {
      return {
        subject: `Ready to lock in your ${dest} trip?`,
        body: `Hi ${params.clientFirstName},

Glad to hear you're interested in the ${dest} trip. Just wanted to check where things stand, let me know if you're ready to move forward, or if there's anything you'd like adjusted first.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    if (params.followUpNumber === 2) {
      return {
        subject: `Finalizing your ${dest} trip`,
        body: `Hi ${params.clientFirstName},

Just following up since you mentioned you were interested in the ${dest} trip. Happy to help finalize the details whenever you're ready to move forward.

${SIGN_OFF(params.consultantFirstName)}`,
      };
    }
    return {
      subject: `Your ${dest} trip, ready when you are`,
      body: `Hi ${params.clientFirstName},

Wanted to check in one more time on the ${dest} trip. ${timingLine}.

If you're ready to move forward, just let me know and I'll take care of the next steps.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  // No specific stage signal yet -- the three-part conversation: review,
  // then customization/decision support, then a final timing-based
  // check-in using real data when it's available.
  if (params.followUpNumber <= 1) {
    return {
      subject: `Your ${dest} trip`,
      body: `Hi ${params.clientFirstName},

I wanted to follow up on the ${dest} package we sent over and see if you had a chance to look through the details.

If you'd like to change anything in the package, feel free to let me know and I'll be happy to check the options for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  if (params.followUpNumber === 2) {
    return {
      subject: `A few changes to your ${dest} package?`,
      body: `Hi ${params.clientFirstName},

I wanted to check in regarding your ${dest} trip. If you're still considering the package, we can also look at ${changeOptions} if you'd like to make any changes.

Let me know what you'd prefer and I'll check the available options for you.

${SIGN_OFF(params.consultantFirstName)}`,
    };
  }

  return {
    subject: `Your ${dest} travel plans`,
    body: `Hi ${params.clientFirstName},

I wanted to touch base one more time regarding your ${dest} trip. ${timingLine}.

If you're not ready yet, no worries, you can always message us when you're ready to continue.

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
