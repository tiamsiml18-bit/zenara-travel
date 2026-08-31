import { describe, it, expect } from 'vitest';
import { generateQuotationEmail, generateFollowUpEmail } from '@/lib/utils/email-templates';
import type { PipelineStage } from '@/lib/services/pipeline';

describe('generateQuotationEmail', () => {
  it('matches the spec example structure for a first-send quotation email', () => {
    const draft = generateQuotationEmail({ clientFirstName: 'Maria', destination: 'hanoi', consultantFirstName: 'Leo' });
    expect(draft.subject).toBe('Your Hanoi Travel Quotation');
    expect(draft.body).toContain('Hi Maria,');
    expect(draft.body).toContain('Hanoi trip');
    expect(draft.body).toContain('Best,\nLeo');
  });

  it('never restates pricing or itinerary specifics — the PDF already has that', () => {
    const draft = generateQuotationEmail({ clientFirstName: 'Maria', destination: 'Boracay', consultantFirstName: 'Leo' });
    expect(draft.body).not.toMatch(/PHP|\$|adult|child|itinerary/i);
  });

  it('a revised quotation gets different, revision-aware wording, not the generic first-send text', () => {
    const original = generateQuotationEmail({ clientFirstName: 'Maria', destination: 'Boracay', consultantFirstName: 'Leo' });
    const revised = generateQuotationEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      isRevision: true,
    });
    expect(revised.subject).toBe('Updated Boracay Travel Quotation');
    expect(revised.body).toContain('updated the quotation');
    expect(revised.body).toContain('changes you requested');
    expect(revised.body).not.toBe(original.body);
  });

  it('never uses an em dash anywhere in the generated text', () => {
    const original = generateQuotationEmail({ clientFirstName: 'Maria', destination: 'Boracay', consultantFirstName: 'Leo' });
    const revised = generateQuotationEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      isRevision: true,
    });
    expect(original.subject + original.body).not.toContain('—');
    expect(revised.subject + revised.body).not.toContain('—');
  });
});

describe('generateFollowUpEmail', () => {
  it('follow-up #1 is a simple, friendly review-and-offer-help check-in', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('chance to look through the details');
    expect(draft.body).toMatch(/change anything|check the options/i);
  });

  it('follow-up #2 offers concrete customization areas (hotel, tours, itinerary, dates) generically when no hotel is on file', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('the hotel, tours, itinerary, or travel dates');
  });

  it('follow-up #2 names the actual hotel on file instead of a generic mention, when one is available', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
      pipelineStage: 'follow_up',
      hotelName: 'Shangri-La Boracay',
    });
    expect(draft.body).toContain('Shangri-La Boracay');
  });

  it('follow-up #3 uses the real quotation validity date when one is set, never an invented urgency claim', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 3,
      pipelineStage: 'follow_up',
      validUntil: '2026-09-15',
    });
    expect(draft.body).toContain('valid until September 15, 2026');
  });

  it('follow-up #3 falls back to a genuine, non-urgent check-in when no validity date is on file', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 3,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).not.toMatch(/valid until|expires|limited/i);
    expect(draft.body).toContain('no worries');
  });

  it('none of the three follow-up numbers share the same opening line or structure', () => {
    const bodies = [1, 2, 3].map(
      (n) =>
        generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Boracay',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: 'follow_up',
        }).body
    );
    const openingLines = bodies.map((b) => b.split('\n\n')[1]); // the line right after "Hi Maria,"
    expect(new Set(openingLines).size).toBe(3); // all three genuinely different
    expect(openingLines.every((line) => !/^hope (you're|all is)/i.test(line!))).toBe(true);
  });

  it('each follow-up stays within the 50-120 word target length', () => {
    for (let n = 1; n <= 3; n++) {
      const draft = generateFollowUpEmail({
        clientFirstName: 'Maria',
        destination: 'Boracay',
        consultantFirstName: 'Leo',
        followUpNumber: n,
        pipelineStage: 'follow_up',
        hotelName: 'Shangri-La Boracay',
        validUntil: '2026-09-15',
      });
      const wordCount = draft.body.trim().split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(50);
      expect(wordCount).toBeLessThanOrEqual(120);
    }
  });

  it('never uses any of the banned corporate/robotic phrases', () => {
    const banned = [
      'dear valued customer',
      'please be advised',
      'kindly be informed',
      'we hope this email finds you well',
      'at your earliest convenience',
      'please do not hesitate',
      'final attempt',
      'last chance',
    ];
    const stages: (PipelineStage | null)[] = ['still_thinking', 'requested_changes', 'interested', 'follow_up', null];
    for (const stage of stages) {
      for (let n = 1; n <= 3; n++) {
        const draft = generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Boracay',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: stage,
        });
        const lower = (draft.subject + ' ' + draft.body).toLowerCase();
        for (const phrase of banned) {
          expect(lower).not.toContain(phrase);
        }
      }
    }
  });

  it('never uses excessive exclamation marks', () => {
    const stages: (PipelineStage | null)[] = ['still_thinking', 'requested_changes', 'interested', 'follow_up', null];
    for (const stage of stages) {
      for (let n = 1; n <= 3; n++) {
        const draft = generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Boracay',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: stage,
        });
        expect((draft.body.match(/!/g) || []).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('"still thinking" stage varies by follow-up number instead of repeating the same email every time', () => {
    const draftAt1 = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: 'still_thinking',
    });
    const draftAt2 = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
      pipelineStage: 'still_thinking',
    });
    const draftAt3 = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 3,
      pipelineStage: 'still_thinking',
    });
    expect(draftAt1.body).toContain('a bit of thought');
    // Regression guard: a lead can sit in "Still Thinking" across several
    // follow-up cycles — if the stage-specific email never varied with the
    // follow-up number, the exact same email would go out verbatim every
    // time, which is worse than the original "Hope you're doing well"
    // problem this feature exists to fix.
    expect(draftAt1.body).not.toBe(draftAt2.body);
    expect(draftAt2.body).not.toBe(draftAt3.body);
    expect(draftAt1.body).not.toBe(draftAt3.body);
  });

  it('"requested changes" stage also varies by follow-up number', () => {
    const bodies = [1, 2, 3].map(
      (n) =>
        generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Hanoi',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: 'requested_changes',
        }).body
    );
    expect(new Set(bodies).size).toBe(3);
  });

  it('"interested" stage also varies by follow-up number', () => {
    const bodies = [1, 2, 3].map(
      (n) =>
        generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Hanoi',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: 'interested',
        }).body
    );
    expect(new Set(bodies).size).toBe(3);
  });

  it('every stage x follow-up-number combination (12 total across the 3 real signal stages) produces a unique email', () => {
    const stages: PipelineStage[] = ['still_thinking', 'requested_changes', 'interested'];
    const bodies = new Set<string>();
    for (const stage of stages) {
      for (let n = 1; n <= 3; n++) {
        bodies.add(
          generateFollowUpEmail({
            clientFirstName: 'Maria',
            destination: 'Hanoi',
            consultantFirstName: 'Leo',
            followUpNumber: n,
            pipelineStage: stage,
          }).body
        );
      }
    }
    expect(bodies.size).toBe(9);
  });

  it('every stage-based #3 email uses the real validity date when set, and starts the sentence capitalized correctly', () => {
    const stages: PipelineStage[] = ['still_thinking', 'requested_changes', 'interested'];
    for (const stage of stages) {
      const draft = generateFollowUpEmail({
        clientFirstName: 'Maria',
        destination: 'Hanoi',
        consultantFirstName: 'Leo',
        followUpNumber: 3,
        pipelineStage: stage,
        validUntil: '2026-09-15',
      });
      expect(draft.body).toContain('This quotation is valid until September 15, 2026');
      // Never a lowercase sentence start (a grammar regression this fix specifically had to avoid)
      expect(draft.body).not.toMatch(/\.\s+this quotation/);
    }
  });

  it('"requested changes" stage references that specifically, using only real CRM data', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: 'requested_changes',
    });
    expect(draft.body).toContain('a few changes to the itinerary');
    // Never invents specifics about WHAT changed, since the CRM doesn't have that detail
    expect(draft.body).not.toMatch(/\bhotel\b|\bprice\b|\bdate\b|\bflight\b/i);
  });

  it('never mentions another destination, guest type, or price the CRM does not have', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Japan',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: null,
    });
    expect(draft.body).not.toMatch(/PHP|adult|child|infant|senior/i);
  });

  it('never uses an em dash in any follow-up variant', () => {
    const stages: (PipelineStage | null)[] = ['still_thinking', 'requested_changes', 'interested', 'follow_up', null];
    for (const stage of stages) {
      for (let n = 1; n <= 3; n++) {
        const draft = generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Boracay',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: stage,
        });
        expect(draft.subject + draft.body).not.toContain('—');
      }
    }
  });

  it('subjects differ across all three follow-up numbers and are destination-specific', () => {
    const subjects = [1, 2, 3].map(
      (n) =>
        generateFollowUpEmail({
          clientFirstName: 'Maria',
          destination: 'Hong Kong',
          consultantFirstName: 'Leo',
          followUpNumber: n,
          pipelineStage: 'follow_up',
        }).subject
    );
    expect(new Set(subjects).size).toBe(3);
    for (const s of subjects) expect(s).toContain('Hong Kong');
  });
});
