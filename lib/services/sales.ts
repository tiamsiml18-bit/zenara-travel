import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import { getEffectivePaymentDueDate } from './payments';
import { getLinkedExpenseTotalsByQuotation } from './expenses';

/**
 * The Sales section's own display status — deliberately distinct from the
 * existing 4-value getPaymentDisplayStatus (deposit_pending/partially_paid/
 * balance_due/paid_in_full), which drives the Bookings page and payment
 * reminders. The spec here asks for a different label set (Pending
 * Payment/Partially Paid/Paid/Confirmed), so this is its own small mapping
 * — but it's still derived entirely from the same existing payment_status
 * and booking status fields, never a new stored value.
 */
export type SalesPaymentStatus = 'pending_payment' | 'partially_paid' | 'paid' | 'confirmed';

export const SALES_PAYMENT_STATUS_LABELS: Record<SalesPaymentStatus, string> = {
  pending_payment: 'Pending Payment',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  confirmed: 'Confirmed',
};

/**
 * Paid takes priority regardless of booking status (a fully paid booking
 * is fully paid). Otherwise, a confirmed booking that hasn't started
 * collecting payment yet shows as Confirmed rather than Pending Payment —
 * "the trip is locked in" is more useful information than "nothing's been
 * paid" for a booking the agent has already confirmed. Once any payment
 * has been recorded, the payment-progress label takes over.
 */
export function getSalesPaymentStatus(params: { paymentStatus: string; bookingStatus: string }): SalesPaymentStatus {
  if (params.paymentStatus === 'paid') return 'paid';
  if (params.paymentStatus === 'partial') return 'partially_paid';
  if (params.bookingStatus === 'confirmed') return 'confirmed';
  return 'pending_payment';
}

export interface SalesListFilters {
  search?: string;
  paymentStatus?: SalesPaymentStatus;
  agentId?: string;
  clientId?: string;
  travelDateFrom?: string;
  travelDateTo?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
}

const SALES_SELECT = `
  id, booking_number, travel_start_date, travel_end_date, created_at,
  payment_status, status, payment_due_date,
  client:clients ( id, full_name ),
  agent:users!bookings_assigned_agent_id_fkey ( id, full_name ),
  quotation:quotations (
    id, quotation_number,
    current_version:quotation_versions!quotations_current_version_id_fkey ( total_price )
  ),
  cost_entry:sales_cost_entries ( airfare_cost, hotel_cost, transfer_cost, tour_cost, bank_charge, refund, remarks, cost_source )
`;

/**
 * One Sales row per booking, joined against each booking's OWN latest
 * finalized quotation revision (via quotations.current_version_id) rather
 * than the booking's own total_amount snapshot — total_amount is fixed at
 * the moment a quotation is converted into a booking and does not update
 * if the quotation is later revised, but Total Sale must always reflect
 * the latest revision per spec. Amount Paid/Balance/Payment Status all
 * come from the existing payments ledger and recomputePaymentStatus
 * (lib/services/payments.ts) — nothing here recomputes or duplicates
 * that logic, it's read directly.
 */
export async function listSalesRecords(supabase: SupabaseClient, filters: SalesListFilters = {}) {
  let query = supabase.from('bookings').select(SALES_SELECT).is('deleted_at', null).order('created_at', { ascending: false });

  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);
  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.travelDateFrom) query = query.gte('travel_start_date', filters.travelDateFrom);
  if (filters.travelDateTo) query = query.lte('travel_start_date', filters.travelDateTo);
  if (filters.invoiceDateFrom) query = query.gte('created_at', filters.invoiceDateFrom);
  if (filters.invoiceDateTo) query = query.lte('created_at', `${filters.invoiceDateTo}T23:59:59`);

  const { data: bookingRows, error } = await query;
  if (error) throw new Error(`Failed to load sales records: ${error.message}`);

  const bookingIds = (bookingRows ?? []).map((b) => b.id);
  const paidByBooking = await sumPaymentsByBooking(supabase, bookingIds);
  // Only fetched for rows that could possibly need it (cost_source ===
  // 'linked_expenses') — a plain 'manual' Sales record (the default for
  // every existing row) never even looks at this map, so nothing about
  // the existing calculation path changes unless the agent has
  // explicitly switched a row to Linked Expenses.
  const quotationIdsNeedingLinkedTotal = (bookingRows ?? [])
    .filter((b) => unwrapToOne(b.cost_entry)?.cost_source === 'linked_expenses')
    .map((b) => unwrapToOne(b.quotation) as { id?: string } | null)
    .map((q) => q?.id)
    .filter((id): id is string => Boolean(id));
  const linkedExpenseTotals = await getLinkedExpenseTotalsByQuotation(supabase, quotationIdsNeedingLinkedTotal);

  let rows = (bookingRows ?? []).map((b) => {
    const client = unwrapToOne(b.client);
    const agent = unwrapToOne(b.agent);
    const quotation = unwrapToOne(b.quotation);
    const currentVersion = quotation ? unwrapToOne((quotation as { current_version: unknown }).current_version) : null;
    const costEntry = unwrapToOne(b.cost_entry);
    const totalSale = Number((currentVersion as { total_price?: number } | null)?.total_price ?? 0);
    const amountPaid = paidByBooking.get(b.id) ?? 0;
    const balance = Math.max(0, totalSale - amountPaid);
    const salesStatus = getSalesPaymentStatus({ paymentStatus: b.payment_status, bookingStatus: b.status });

    const airfareCost = Number(costEntry?.airfare_cost ?? 0);
    const hotelCost = Number(costEntry?.hotel_cost ?? 0);
    const transferCost = Number(costEntry?.transfer_cost ?? 0);
    const tourCost = Number(costEntry?.tour_cost ?? 0);
    const bankCharge = Number(costEntry?.bank_charge ?? 0);
    const refund = Number(costEntry?.refund ?? 0);
    const costSource = (costEntry?.cost_source as 'manual' | 'linked_expenses' | undefined) ?? 'manual';
    const quotationIdForRow = (quotation as { id?: string } | null)?.id ?? null;

    const { totalCost, netProfit } = resolveSalesCostAndProfit({
      costSource,
      totalSale,
      manualCosts: { airfareCost, hotelCost, transferCost, tourCost, bankCharge, refund },
      linkedExpensesTotal: quotationIdForRow ? (linkedExpenseTotals.get(quotationIdForRow) ?? 0) : 0,
    });

    return {
      bookingId: b.id,
      quotationId: quotationIdForRow,
      quotationNumber: (quotation as { quotation_number?: string } | null)?.quotation_number ?? '—',
      customerId: (client as { id?: string } | null)?.id ?? null,
      customerName: (client as { full_name?: string } | null)?.full_name ?? '—',
      invoiceDate: b.created_at,
      travelStartDate: b.travel_start_date,
      travelEndDate: b.travel_end_date,
      totalSale,
      amountPaid,
      balance,
      paymentStatus: salesStatus,
      paymentDueDate: getEffectivePaymentDueDate({ payment_due_date: b.payment_due_date, travel_start_date: b.travel_start_date }),
      agentName: (agent as { full_name?: string } | null)?.full_name ?? '—',
      airfareCost,
      hotelCost,
      transferCost,
      tourCost,
      bankCharge,
      refund,
      totalCost,
      netProfit,
      costSource,
      remarks: costEntry?.remarks ?? '',
    };
  });

  if (filters.paymentStatus) rows = rows.filter((r) => r.paymentStatus === filters.paymentStatus);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter((r) => r.customerName.toLowerCase().includes(q) || r.quotationNumber.toLowerCase().includes(q));
  }

  return rows;
}

/**
 * Total Cost = Airfare + Hotel + Transfer + Tour + Bank Charge + Refund
 * (all agent-entered). Net Profit = Total Sale - Total Cost. Extracted as
 * its own pure function so the exact formula from the spec is directly
 * unit-tested, independent of the surrounding database query.
 */
export function computeSalesCostAndProfit(params: {
  totalSale: number;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
}) {
  const totalCost = params.airfareCost + params.hotelCost + params.transferCost + params.tourCost + params.bankCharge + params.refund;
  return { totalCost, netProfit: params.totalSale - totalCost };
}

/**
 * The one branch point for a Sales row's Total Cost/Net Profit: Manual
 * (the default, and the only option that ever existed before Expenses)
 * keeps the exact same sum-of-6-fields formula as always. Linked
 * Expenses substitutes the sum of that quotation's actual linked
 * expenses instead — never both added together, which is what prevents
 * double counting. Extracted as its own pure function specifically so
 * this critical distinction is directly unit-tested, not just exercised
 * incidentally inside a database query.
 */
export function resolveSalesCostAndProfit(params: {
  costSource: 'manual' | 'linked_expenses';
  totalSale: number;
  manualCosts: { airfareCost: number; hotelCost: number; transferCost: number; tourCost: number; bankCharge: number; refund: number };
  linkedExpensesTotal: number;
}) {
  if (params.costSource === 'linked_expenses') {
    return { totalCost: params.linkedExpensesTotal, netProfit: params.totalSale - params.linkedExpensesTotal };
  }
  return computeSalesCostAndProfit({ totalSale: params.totalSale, ...params.manualCosts });
}

async function sumPaymentsByBooking(supabase: SupabaseClient, bookingIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (bookingIds.length === 0) return totals;
  const { data, error } = await supabase.from('payments').select('booking_id, amount').in('booking_id', bookingIds);
  if (error) throw new Error(`Failed to load payments for sales: ${error.message}`);
  for (const p of data ?? []) {
    totals.set(p.booking_id, (totals.get(p.booking_id) ?? 0) + Number(p.amount));
  }
  return totals;
}

export interface SalesCostUpdate {
  airfareCost?: number;
  hotelCost?: number;
  transferCost?: number;
  tourCost?: number;
  bankCharge?: number;
  refund?: number;
  remarks?: string;
}

/**
 * Upserts the agent-entered internal cost fields for one booking. These
 * are Sales-only values with no equivalent in the quotation itself — the
 * agent's whole point in asking for them is to record an internal cost
 * breakdown without touching the client-facing quotation, so this never
 * writes to quotations/quotation_versions/quotation_pricing_internal.
 */
export async function updateSalesCosts(supabase: SupabaseClient, bookingId: string, updates: SalesCostUpdate, actingUserId: string) {
  const patch: Record<string, unknown> = { booking_id: bookingId, updated_by: actingUserId, updated_at: new Date().toISOString() };
  if (updates.airfareCost !== undefined) patch.airfare_cost = updates.airfareCost;
  if (updates.hotelCost !== undefined) patch.hotel_cost = updates.hotelCost;
  if (updates.transferCost !== undefined) patch.transfer_cost = updates.transferCost;
  if (updates.tourCost !== undefined) patch.tour_cost = updates.tourCost;
  if (updates.bankCharge !== undefined) patch.bank_charge = updates.bankCharge;
  if (updates.refund !== undefined) patch.refund = updates.refund;
  if (updates.remarks !== undefined) patch.remarks = updates.remarks || null;

  const { error } = await supabase.from('sales_cost_entries').upsert(patch, { onConflict: 'booking_id' });
  if (error) throw new Error(`Failed to save sales costs: ${error.message}`);
}

/**
 * Switches a Sales record between the two cost sources described above.
 * Never touches the manual cost fields themselves — an agent can flip
 * back to Manual later and find their previously entered values exactly
 * as they left them.
 */
export async function updateCostSource(supabase: SupabaseClient, bookingId: string, costSource: 'manual' | 'linked_expenses', actingUserId: string) {
  const { error } = await supabase
    .from('sales_cost_entries')
    .upsert({ booking_id: bookingId, cost_source: costSource, updated_by: actingUserId, updated_at: new Date().toISOString() }, { onConflict: 'booking_id' });
  if (error) throw new Error(`Failed to update cost source: ${error.message}`);
}

/**
 * Upcoming Payments — every booking not yet fully paid, sorted by its
 * existing effective payment due date (manual override or the standard
 * 14-days-before-travel default, same helper the Bookings/reminder system
 * already uses). Deliberately a subset of the same listSalesRecords rows,
 * not a second query against a different due-date concept.
 */
export async function listUpcomingPayments(supabase: SupabaseClient) {
  const rows = await listSalesRecords(supabase);
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((r) => r.paymentStatus !== 'paid' && r.balance > 0)
    .map((r) => ({
      ...r,
      daysRemaining: Math.round((new Date(r.paymentDueDate).getTime() - new Date(today).getTime()) / 86400000),
    }))
    .sort((a, b) => (a.paymentDueDate < b.paymentDueDate ? -1 : a.paymentDueDate > b.paymentDueDate ? 1 : 0));
}

/** One row of listSalesRecords' return shape — named and exported so other modules (e.g. report export) can reference it without repeating the Awaited<ReturnType<...>> pattern. */
export type SalesRecord = Awaited<ReturnType<typeof listSalesRecords>>[number];

export function getSalesSummary(rows: Awaited<ReturnType<typeof listSalesRecords>>) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalSales: rows.reduce((sum, r) => sum + r.totalSale, 0),
    amountCollected: rows.reduce((sum, r) => sum + r.amountPaid, 0),
    outstandingBalance: rows.reduce((sum, r) => sum + r.balance, 0),
    upcomingPayments: rows.filter((r) => r.paymentStatus !== 'paid' && r.balance > 0 && r.paymentDueDate >= today).length,
    overduePayments: rows.filter((r) => r.paymentStatus !== 'paid' && r.balance > 0 && r.paymentDueDate < today).length,
    totalCost: rows.reduce((sum, r) => sum + r.totalCost, 0),
    netProfit: rows.reduce((sum, r) => sum + r.netProfit, 0),
  };
}
