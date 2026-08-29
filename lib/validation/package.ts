import { z } from 'zod';

const itineraryDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().trim().min(1, 'Give each day a title.'),
  description: z.string().trim().optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
  dayDate: z.string().optional().or(z.literal('')), // unused for templates, kept for shared component compatibility
});

export const packageFormSchema = z.object({
  name: z.string().trim().min(2, 'Package name is required.').max(200),
  destination: z.string().trim().min(2, 'Destination is required.').max(200),
  numDays: z.coerce.number().int().positive('Must be at least 1 day.'),
  numNights: z.coerce.number().int().min(0, 'Cannot be negative.'),
  defaultNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  isActive: z.coerce.boolean().default(true),
  itinerary: z.array(itineraryDaySchema).default([]),
  inclusions: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
});

export type PackageFormInput = z.infer<typeof packageFormSchema>;
