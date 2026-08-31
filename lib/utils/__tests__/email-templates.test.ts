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
  it('follow-up #1 with no stage signal invites questions or revisions', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('chance to look over the Hanoi package');
    expect(draft.body).toMatch(/questions|adjust/i);
  });

  it('follow-up #2 with no stage signal creates gentle urgency', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toMatch(/rates and availability|lock it in/i);
  });

  it('follow-up #3+ is a short, low-pressure "breakup" email with an easy next step', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 3,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('set this aside');
    expect(draft.body).toMatch(/quick call/i);
    expect(draft.body).toContain('no pressure');
  });

  it('none of the three follow-up numbers share the same opening line', () => {
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

  it('"still thinking" stage overrides the follow-up number, regardless of which number it is', () => {
    const draftAt1 = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
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
    expect(draftAt3.body).toBe(draftAt1.body); // stage signal wins over follow-up number either way
  });

  it('"requested changes" stage references that specifically, using only real CRM data', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
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
});
