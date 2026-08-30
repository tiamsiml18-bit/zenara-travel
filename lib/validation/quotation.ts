import { z } from 'zod';
import { GUEST_TYPES } from '@/lib/utils/guest-pricing';

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

// One rate per guest type — never a single combined "price per person."
// supplierCostPerPerson is carried in the same input object for convenience
// (the wizard's one form has both), but the service layer writes it to the
// physically separate quotation_guest_pricing_internal table, never the
// client-facing quotation_guest_pricing table.
export const guestRateSchema = z.object({
  guestType: z.enum(GUEST_TYPES),
  pricePerPerson: z.coerce.number().min(0, 'Rate cannot be negative.').default(0),
  supplierCostPerPerson: z.coerce.number().min(0, 'Cost cannot be negative.').default(0),
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
    numSeniors: z.coerce.number().int().min(0).default(0),
    numInfants: z.coerce.number().int().min(0).default(0),
    numPwd: z.coerce.number().int().min(0).default(0),
    hotelName: z.string().trim().max(200).optional().or(z.literal('')),
    numBedrooms: z.coerce.number().int().min(0).optional().nullable(),

    // Total package price is NEVER user-entered — it's always calculated
    // server-side from guestRates × the guest counts above (see
    // lib/utils/guest-pricing.ts, the one function that ever computes it).
    // Kept as a field here only because it's convenient for the wizard to
    // pass its own live-calculated value through so the UI, the stored
    // record, and the PDF all read from a single calculation path — the
    // server recalculates and overwrites this rather than trusting it.
    guestRates: z.array(guestRateSchema).default([]),
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

    // Internal-only cost breakdown for non-per-person costs (airfare, hotel,
    // a shared van transfer) — adds together WITH the per-guest-type
    // supplier costs above into one total supplier_cost, rather than
    // replacing them. Never appears on the client-facing PDF.
    costItems: z.array(costItemSchema).default([]),
    markup: z.coerce.number().default(0),
  })
  .refine((d) => new Date(d.travelEndDate) >= new Date(d.travelStartDate), {
    message: 'Travel end date cannot be before the start date.',
    path: ['travelEndDate'],
  });

export type CostItemInput = z.infer<typeof costItemSchema>;
export type GuestRateInput = z.infer<typeof guestRateSchema>;
export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
