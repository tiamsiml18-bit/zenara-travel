import { describe, it, expect } from 'vitest';
import { generateQuotationEmail, generateFollowUpEmail } from '@/lib/utils/email-templates';

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
});

describe('generateFollowUpEmail', () => {
  it('follow-up #1 with no stage signal is a friendly generic check-in', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 1,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('chance to look over the Hanoi package');
  });

  it('follow-up #2 with no stage signal offers to help with changes', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Boracay',
      consultantFirstName: 'Leo',
      followUpNumber: 2,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('change the hotel, activities, or dates');
  });

  it('follow-up #3+ is a final, non-pushy check-in', () => {
    const draft = generateFollowUpEmail({
      clientFirstName: 'Maria',
      destination: 'Hanoi',
      consultantFirstName: 'Leo',
      followUpNumber: 3,
      pipelineStage: 'follow_up',
    });
    expect(draft.body).toContain('No pressure');
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
    expect(draftAt1.body).toContain("chance to decide on the package");
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
    expect(draft.body).toContain('some changes to the itinerary');
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
});
