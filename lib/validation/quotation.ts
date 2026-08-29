import { z } from 'zod';

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  dayDate: z.string().optional().or(z.literal('')),
  title: z.string().trim().min(1, 'Give this day a title.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
});

export const costItemSchema = z.object({
  label: z.string().trim().min(1, 'Give this cost item a label.').max(120),
  amount: z.coerce.number().min(0, 'Cost cannot be negative.'),
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

    // Which named consultant prepared this quote — see agency_consultants;
    // decoupled from the authenticated login since the agency uses one
    // shared account across three people.
    consultantId: z.string().uuid().optional().or(z.literal('')),

    inclusions: z.array(z.string().trim().min(1)).default([]),
    exclusions: z.array(z.string().trim().min(1)).default([]),
    itinerary: z.array(itineraryDaySchema).default([]),

    // Client-facing additional fees / taxes — shown on the PDF as its own
    // section (terminal fee, environmental fee, VAT, whatever comes up).
    // Optional and empty by default; purely there for when it's needed.
    feeItems: z.array(costItemSchema).default([]),

    // Internal-only cost breakdown — airfare, hotel, transfers, sleeper bus,
    // any client-specific add-on the agent needs to price out. Persisted to
    // quotation_items (tied 1:1 with this version) so it survives a revise
    // for editing later, and summed server-side into supplier_cost on
    // quotation_pricing_internal. Never appears on the client-facing PDF —
    // that path only ever reads price_per_person/total_price from
    // quotation_versions, which never joins quotation_items or
    // quotation_pricing_internal (see lib/services/pdf-data.ts).
    costItems: z.array(costItemSchema).default([]),
    markup: z.coerce.number().default(0),
  })
  .refine((d) => new Date(d.travelEndDate) >= new Date(d.travelStartDate), {
    message: 'Travel end date cannot be before the start date.',
    path: ['travelEndDate'],
  });

export type CostItemInput = z.infer<typeof costItemSchema>;
export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
