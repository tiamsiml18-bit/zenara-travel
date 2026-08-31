import { z } from 'zod';
import { GUEST_TYPES } from '@/lib/utils/guest-pricing';

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  dayDate: z.string().optional().or(z.literal('')),
  title: z.string().trim().min(1, 'Give this day a title.').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
  // Traceability only — which tour/free-time preset this day was seeded
  // from, if any. Never read back live; the fields above are the actual
  // snapshot the agent can freely edit afterward.
  sourceTourId: z.string().uuid().optional().nullable(),
});

export const costItemSchema = z.object({
  label: z.string().trim().min(1, 'Give this cost item a label.').max(120),
  amount: z.coerce.number().min(0, 'Cost cannot be negative.'),
});

/** One "Other Supplier Cost" item — its own per-person rates by guest type, same structure as Tours. Reserved for costs genuinely outside Airfare/Hotel/Transfer/Tours (a visa fee, a permit, a one-off request) — never a duplicate of those dedicated sections. */
export const otherSupplierCostItemSchema = z.object({
  label: z.string().trim().min(1, 'Cost item name is required.'),
  rateSenior: z.coerce.number().min(0).optional().nullable(),
  rateAdult: z.coerce.number().min(0).optional().nullable(),
  rateChild: z.coerce.number().min(0).optional().nullable(),
  rateInfant: z.coerce.number().min(0).optional().nullable(),
  ratePwd: z.coerce.number().min(0).optional().nullable(),
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

/** One selected Tour's own editable per-person rates for THIS quotation only — never read from or written back to the Tours library. */
export const tourPricingItemSchema = z.object({
  sourceTourId: z.string().uuid().optional().or(z.literal('')),
  tourName: z.string().trim().min(1),
  rateSenior: z.coerce.number().min(0).optional().nullable(),
  rateAdult: z.coerce.number().min(0).optional().nullable(),
  rateChild: z.coerce.number().min(0).optional().nullable(),
  rateInfant: z.coerce.number().min(0).optional().nullable(),
  ratePwd: z.coerce.number().min(0).optional().nullable(),
});

export const quotationDraftSchema = z
  .object({
    clientId: z.string().uuid('Select a client.'),
    packageId: z.string().uuid().optional().or(z.literal('')),
    destination: z.string().trim().min(1, 'Destination is required.').max(200),
    travelStartDate: z.string().min(1, 'Start date is required.'),
    travelEndDate: z.string().min(1, 'End date is required.'),
    // Real, stored, editable — never computed on the fly at PDF-render time.
    validUntil: z.string().min(1, 'Validity date is required.'),
    numAdults: z.coerce.number().int().min(1, 'At least one adult is required.'),
    numChildren: z.coerce.number().int().min(0).default(0),
    numSeniors: z.coerce.number().int().min(0).default(0),
    numInfants: z.coerce.number().int().min(0).default(0),
    numPwd: z.coerce.number().int().min(0).default(0),
    hotelName: z.string().trim().max(200).optional().or(z.literal('')),
    numBedrooms: z.coerce.number().int().min(0).optional().nullable(),

    // Structured supplier-cost inputs — every rate is entered PER PERSON
    // directly by the agent, never a group total the system has to divide
    // across headcount. Each of Airfare/Hotel/Transfer applies its own
    // (editable) markup percentage directly to the entered rate. See
    // lib/utils/guest-pricing.ts for the calculation these feed.
    airfareAdultRate: z.coerce.number().min(0).default(0),
    airfareSeniorRate: z.coerce.number().min(0).default(0),
    airfareChildRate: z.coerce.number().min(0).default(0),
    airfareInfantRate: z.coerce.number().min(0).default(0),
    airfarePwdRate: z.coerce.number().min(0).default(0),
    airfareMarkupPct: z.coerce.number().min(0).max(1).default(0.1),

    hotelSeniorRate: z.coerce.number().min(0).default(0),
    hotelAdultRate: z.coerce.number().min(0).default(0),
    hotelChildRate: z.coerce.number().min(0).default(0),
    hotelInfantRate: z.coerce.number().min(0).default(0),
    hotelPwdRate: z.coerce.number().min(0).default(0),
    hotelMarkupPct: z.coerce.number().min(0).max(1).default(0.1),

    transferSeniorRate: z.coerce.number().min(0).default(0),
    transferAdultRate: z.coerce.number().min(0).default(0),
    transferChildRate: z.coerce.number().min(0).default(0),
    transferInfantRate: z.coerce.number().min(0).default(0),
    transferPwdRate: z.coerce.number().min(0).default(0),
    transferMarkupPct: z.coerce.number().min(0).max(1).default(0.2),

    // Determines which admin-configurable fee % (agency_settings) applies —
    // never a hardcoded percentage in application code.
    paymentMethod: z.enum(['credit_card', 'paypal', 'none']).default('credit_card'),

    // Tour contribution only — client rate and supplier cost accumulated
    // as tours are picked in the itinerary step (see handleTourSelected in
    // the wizard). Combined server-side with the Airfare/Hotel/Transfer
    // inputs above into the final per-guest-type numbers; never entered
    // directly by the agent, and never the same amount counted twice.
    guestRates: z.array(guestRateSchema).default([]),
    // Each selected Tour's own editable per-person rates for this
    // quotation — one entry per unique Tour, defaulting from the Tours
    // library when first selected but freely editable afterward without
    // ever writing back to the library. This is the source guestRates'
    // tour contribution above is summed from.
    tourPricing: z.array(tourPricingItemSchema).default([]),
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

    // "Other Supplier Costs" — for anything genuinely outside Airfare,
    // Hotel, Transfer, and Tours (a visa fee, a permit, a one-off request).
    // Never a place to re-enter a cost that already has its own structured
    // field above — duplicating a cost between here and Airfare/Hotel/
    // Transfer/Tours is exactly what this restructuring exists to prevent.
    costItems: z.array(otherSupplierCostItemSchema).default([]),
    // The flat Zenara markup — one agent-entered amount, applied identically
    // to every guest type (Excel: E27=F27=G27=H27, always the same number).
    markup: z.coerce.number().default(0),
  })
  .refine((d) => new Date(d.travelEndDate) >= new Date(d.travelStartDate), {
    message: 'Travel end date cannot be before the start date.',
    path: ['travelEndDate'],
  });

export type CostItemInput = z.infer<typeof costItemSchema>;
export type OtherSupplierCostItemInput = z.infer<typeof otherSupplierCostItemSchema>;
export type GuestRateInput = z.infer<typeof guestRateSchema>;
export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
