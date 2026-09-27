import { z } from 'zod';

const itineraryDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().trim().min(1, 'Give each day a title.'),
  description: z.string().trim().optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
  dayDate: z.string().optional().or(z.literal('')), // unused for templates, kept for shared component compatibility
  sourceTourId: z.string().uuid().optional().nullable(), // traceability only, see tours.ts
});

export const packageFormSchema = z.object({
  name: z.string().trim().min(2, 'Package name is required.').max(200),
  destination: z.string().trim().min(2, 'Destination is required.').max(200),
  numDays: z.coerce.number().int().positive('Must be at least 1 day.'),
  numNights: z.coerce.number().int().min(0, 'Cannot be negative.'),
  defaultNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  isActive: z.coerce.boolean().default(true),
  // Defaults to 'all_in' — every existing package before this field existed
  // was effectively an all-in package (airfare was always part of the
  // calculation), so this default preserves that behavior for the many
  // packages that don't explicitly set it.
  packageType: z.enum(['all_in', 'land_arrangement']).default('all_in'),
  // No .default() here, deliberately — unlike packageType above, this is
  // required for every new/edited package (existing packages saved
  // before this field existed stay NULL in the database until an admin
  // manually classifies them; this schema only governs the create/edit
  // form going forward, it doesn't touch those existing rows). Distinct
  // from "Trip Type" (Round Trip/One Way) in the quotation wizard's
  // Flight Details step — a different, unrelated concept that happens
  // to share a similar-sounding name, which is exactly why this field
  // is called packageCategory rather than tripType.
  packageCategory: z.enum(['domestic', 'international'], { required_error: 'Package category is required.' }),
  itinerary: z.array(itineraryDaySchema).default([]),
  inclusions: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
});

export type PackageFormInput = z.infer<typeof packageFormSchema>;
