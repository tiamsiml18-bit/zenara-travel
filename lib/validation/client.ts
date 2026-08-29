import { z } from 'zod';

// Shared across the client form (client component) and the server action that
// persists it — the server action re-parses this so a tampered client
// request can never skip validation.
export const clientSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the client\u2019s full name.').max(200),
    mobileNumber: z.string().trim().max(30).optional().or(z.literal('')),
    email: z.string().trim().email('Enter a valid email address.').max(200).optional().or(z.literal('')),
    messengerHandle: z.string().trim().max(120).optional().or(z.literal('')),
    instagramHandle: z.string().trim().max(120).optional().or(z.literal('')),
    whatsappNumber: z.string().trim().max(30).optional().or(z.literal('')),
    sourceId: z.string().uuid('Select a lead source.'),
    destination: z.string().trim().max(200).optional().or(z.literal('')),
    travelStartDate: z.string().optional().or(z.literal('')),
    travelEndDate: z.string().optional().or(z.literal('')),
    numAdults: z.coerce.number().int().min(0).default(1),
    numChildren: z.coerce.number().int().min(0).default(0),
    quotedPrice: z.coerce.number().min(0, 'Price cannot be negative.').optional().nullable(),
    statusId: z.string().uuid('Select a status.'),
    assignedAgentId: z.string().uuid('Assign an agent.'),
    notes: z.string().trim().max(4000).optional().or(z.literal('')),
  })
  .refine(
    (data) =>
      !data.travelStartDate ||
      !data.travelEndDate ||
      new Date(data.travelEndDate) >= new Date(data.travelStartDate),
    { message: 'Travel end date cannot be before the start date.', path: ['travelEndDate'] }
  );

export type ClientInput = z.infer<typeof clientSchema>;

export const clientNoteSchema = z.object({
  clientId: z.string().uuid(),
  note: z.string().trim().min(1, 'Note cannot be empty.').max(4000),
});
