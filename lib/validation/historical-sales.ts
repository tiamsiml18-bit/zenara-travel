import { z } from 'zod';

export const HISTORICAL_PAYMENT_STATUSES = ['pending_payment', 'partially_paid', 'paid', 'confirmed'] as const;
export type HistoricalPaymentStatus = (typeof HISTORICAL_PAYMENT_STATUSES)[number];

export const HISTORICAL_PAYMENT_STATUS_LABELS: Record<HistoricalPaymentStatus, string> = {
  pending_payment: 'Pending Payment',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  confirmed: 'Confirmed',
};

/**
 * A historical sale never requires a linked quotation or client — the
 * whole point is recording an old transaction that predates this CRM.
 * quotationRef/customerName are free text; linkedClientId is an optional,
 * explicit opt-in to associate an existing client without duplicating one.
 */
export const historicalSaleSchema = z.object({
  id: z.string().uuid().optional(),
  quotationRef: z.string().trim().max(100).optional().or(z.literal('')),
  linkedClientId: z.string().uuid().optional().or(z.literal('')),
  customerName: z.string().trim().min(1, 'Customer name is required.').max(200),
  invoiceDate: z.string().optional().or(z.literal('')),
  travelDate: z.string().optional().or(z.literal('')),
  totalSale: z.coerce.number().min(0).default(0),
  amountPaid: z.coerce.number().min(0).default(0),
  paymentStatus: z.enum(HISTORICAL_PAYMENT_STATUSES).default('pending_payment'),
  paymentDueDate: z.string().optional().or(z.literal('')),
  airfareCost: z.coerce.number().min(0).default(0),
  hotelCost: z.coerce.number().min(0).default(0),
  transferCost: z.coerce.number().min(0).default(0),
  tourCost: z.coerce.number().min(0).default(0),
  bankCharge: z.coerce.number().min(0).default(0),
  refund: z.coerce.number().min(0).default(0),
  agentName: z.string().trim().max(200).optional().or(z.literal('')),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
});

export type HistoricalSaleInput = z.infer<typeof historicalSaleSchema>;
