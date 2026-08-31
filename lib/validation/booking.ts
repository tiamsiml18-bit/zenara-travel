import { z } from 'zod';

export const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
export const PAYMENT_METHODS = ['Bank transfer', 'GCash', 'Cash', 'Credit card', 'Other'] as const;

export const paymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero.'),
  paymentDate: z.string().min(1, 'Pick a payment date.'),
  method: z.string().trim().min(1, 'Select a payment method.'),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const bookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(BOOKING_STATUSES),
});

export const paymentDetailsSchema = z.object({
  bookingId: z.string().uuid(),
  paymentNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  paymentDueDate: z.string().optional().or(z.literal('')),
  reminderStopped: z.boolean().optional(),
});

export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;
