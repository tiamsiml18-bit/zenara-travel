/**
 * Pure, framework-free helper — safe to import from both client components
 * and server code. Kept separate from lib/services/followups.ts so client
 * components never need to pull in that file's Supabase-calling exports.
 */
export function buildFollowUpMessage(params: {
  clientFirstName: string;
  destination: string;
  quotationNumber: string;
  agentFirstName?: string;
}): string {
  const { clientFirstName, destination, quotationNumber, agentFirstName } = params;
  const signOff = agentFirstName ? `\n\n- ${agentFirstName}, Zenara Travel and Tours` : '\n\n- Zenara Travel and Tours';
  return `Hi ${clientFirstName}! Just following up on your ${destination} quotation (${quotationNumber}) — let me know if you have any questions or if you'd like to move forward. 😊${signOff}`;
}
