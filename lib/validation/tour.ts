import { z } from 'zod';

export const tourSchema = z.object({
  name: z.string().trim().min(1, 'Tour name is required.').max(200),
  destination: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
  defaultInclusions: z.array(z.string().trim().min(1)).default([]),
  defaultExclusions: z.array(z.string().trim().min(1)).default([]),
  // Nullable, not defaulted to 0 or coerced — a genuinely unconfigured rate
  // (the admin never touched this field) must stay null ("not applicable"),
  // distinct from an explicitly-entered 0 ("FREE"). z.coerce here would
  // silently turn "" into 0, erasing that distinction.
  priceSenior: z.number().min(0).optional().nullable(),
  priceAdult: z.number().min(0).optional().nullable(),
  priceChild: z.number().min(0).optional().nullable(),
  priceInfant: z.number().min(0).optional().nullable(),
  pricePwd: z.number().min(0).optional().nullable(),
  groupCost: z.number().min(0).optional().nullable(),
  // Purely descriptive labels (e.g. "3-11 years") — never used in any
  // calculation, just shown next to the rate so it's clear what this tour
  // means by "Child" or "Infant."
  ageRangeSenior: z.string().trim().max(60).optional().or(z.literal('')),
  ageRangeAdult: z.string().trim().max(60).optional().or(z.literal('')),
  ageRangeChild: z.string().trim().max(60).optional().or(z.literal('')),
  ageRangeInfant: z.string().trim().max(60).optional().or(z.literal('')),
  ageRangePwd: z.string().trim().max(60).optional().or(z.literal('')),
  // Purely a categorization label for filtering the Tours library — never
  // used in pricing, Package integration, or Quotation integration. An
  // array so a tour can be tagged as both types at once.
  tourTypes: z.array(z.enum(['all_in', 'land_arrangement'])).optional(),
});

export type TourFormInput = z.infer<typeof tourSchema>;
