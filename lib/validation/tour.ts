import { z } from 'zod';

export const tourSchema = z.object({
  name: z.string().trim().min(1, 'Tour name is required.').max(200),
  destination: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  activities: z.array(z.string().trim().min(1)).default([]),
  defaultInclusions: z.array(z.string().trim().min(1)).default([]),
  defaultExclusions: z.array(z.string().trim().min(1)).default([]),
  priceSenior: z.coerce.number().min(0).optional().nullable(),
  priceAdult: z.coerce.number().min(0).optional().nullable(),
  priceChild: z.coerce.number().min(0).optional().nullable(),
  priceInfant: z.coerce.number().min(0).optional().nullable(),
  pricePwd: z.coerce.number().min(0).optional().nullable(),
  groupCost: z.coerce.number().min(0).optional().nullable(),
});

export type TourFormInput = z.infer<typeof tourSchema>;
