import { z } from 'zod';

export const EXPENSE_PAYMENT_STATUSES = ['paid', 'pending', 'partially_paid'] as const;
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];
export const EXPENSE_PAYMENT_STATUS_LABELS: Record<ExpensePaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  partially_paid: 'Partially Paid',
};

export const EXPENSE_PAYMENT_METHODS = ['cash', 'bank_transfer', 'credit_card', 'other'] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];
export const EXPENSE_PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  other: 'Other',
};

/**
 * Customer/quotation/booking are all optional by design (spec: "not
 * every expense belongs to a customer") -- clientId is intentionally
 * never entered independently by the UI (only auto-filled after picking
 * a quotation), but the schema itself doesn't need to enforce that
 * ordering; it just accepts whatever the form already resolved.
 */
export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  expenseDate: z.string().min(1, 'Expense date is required.'),
  description: z.string().trim().min(1, 'Description is required.').max(300),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  amount: z.coerce.number().min(0),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUSES).default('pending'),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).default('cash'),
  creditCardId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  clientId: z.string().uuid().optional().or(z.literal('')),
  quotationId: z.string().uuid().optional().or(z.literal('')),
  bookingId: z.string().uuid().optional().or(z.literal('')),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const creditCardSchema = z.object({
  id: z.string().uuid().optional(),
  cardName: z.string().trim().min(1, 'Card name is required.').max(100),
  lastFour: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter exactly 4 digits.'),
  cardType: z.string().trim().max(50).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});
export type CreditCardInput = z.infer<typeof creditCardSchema>;

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(80),
});
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

export const RECURRING_FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];
export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const RECURRING_STATUSES = ['active', 'paused', 'ended'] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];
export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

/**
 * Reuses every field the existing Add Expense form already collects
 * (spec: "do not create a separate expense-entry system") plus the three
 * recurrence-specific fields. dueDate here is used once, at creation, to
 * derive a relative day-offset stored on the schedule — not re-asked for
 * every future occurrence.
 */
export const recurringExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Description is required.').max(300),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  amount: z.coerce.number().min(0),
  paymentStatus: z.enum(EXPENSE_PAYMENT_STATUSES).default('pending'),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).default('cash'),
  creditCardId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
  clientId: z.string().uuid().optional().or(z.literal('')),
  quotationId: z.string().uuid().optional().or(z.literal('')),
  bookingId: z.string().uuid().optional().or(z.literal('')),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().optional().or(z.literal('')),
});
export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>;

export const recurringStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(RECURRING_STATUSES),
});
export type RecurringStatusUpdateInput = z.infer<typeof recurringStatusUpdateSchema>;

export const COST_SOURCES = ['manual', 'linked_expenses'] as const;
export type CostSource = (typeof COST_SOURCES)[number];
export const costSourceUpdateSchema = z.object({
  bookingId: z.string().uuid(),
  costSource: z.enum(COST_SOURCES),
});
export type CostSourceUpdateInput = z.infer<typeof costSourceUpdateSchema>;
