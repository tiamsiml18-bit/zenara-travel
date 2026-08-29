import { z } from 'zod';

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  dayDate: z.string().optional().or(z.literal('')),
  title: z.string().trim().min(1, 'Give this day a title.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
});

export const quotationDraftSchema = z
  .object({
    clientId: z.string().uuid('Select a client.'),
    packageId: z.string().uuid().optional().or(z.literal('')),
    destination: z.string().trim().min(1, 'Destination is required.').max(200),
    travelStartDate: z.string().min(1, 'Start date is required.'),
    travelEndDate: z.string().min(1, 'End date is required.'),
    numAdults: z.coerce.number().int().min(1, 'At least one adult is required.'),
    numChildren: z.coerce.number().int().min(0).default(0),
    hotelName: z.string().trim().max(200).optional().or(z.literal('')),
    numBedrooms: z.coerce.number().int().min(0).optional().nullable(),
    pricePerPerson: z.coerce.number().min(0).optional().nullable(),
    totalPrice: z.coerce.number().min(0, 'Total price cannot be negative.'),
    notes: z.string().trim().max(4000).optional().or(z.literal('')),

    inclusions: z.array(z.string().trim().min(1)).default([]),
    exclusions: z.array(z.string().trim().min(1)).default([]),
    itinerary: z.array(itineraryDaySchema).default([]),

    // Internal-only pricing — kept in a separate table, never sent to client-facing views.
    supplierCost: z.coerce.number().min(0).default(0),
    markup: z.coerce.number().default(0),
  })
  .refine((d) => new Date(d.travelEndDate) >= new Date(d.travelStartDate), {
    message: 'Travel end date cannot be before the start date.',
    path: ['travelEndDate'],
  });

export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
