import { z } from 'zod';

export const salesCostUpdateSchema = z.object({
  bookingId: z.string().uuid(),
  airfareCost: z.coerce.number().min(0).optional(),
  hotelCost: z.coerce.number().min(0).optional(),
  transferCost: z.coerce.number().min(0).optional(),
  tourCost: z.coerce.number().min(0).optional(),
  bankCharge: z.coerce.number().min(0).optional(),
  refund: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export type SalesCostUpdateInput = z.infer<typeof salesCostUpdateSchema>;
