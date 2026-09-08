import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapToOne } from '@/lib/utils/unwrap-embed';
import type { HistoricalSaleInput } from '@/lib/validation/historical-sales';
import type { NormalizedHistoricalRow } from '@/lib/validation/historical-sales-import';

const HISTORICAL_SELECT = `
  id, quotation_ref, linked_quotation_id, customer_name, linked_client_id,
  invoice_date, travel_date, total_sale, amount_paid, payment_status, payment_due_date,
  airfare_cost, hotel_cost, transfer_cost, tour_cost, bank_charge, refund, total_cost, net_profit,
  agent_name, remarks, zoho_invoice_number, created_at,
  linked_client:clients ( id, full_name )
`;

export interface HistoricalSalesFilters {
  search?: string;
  paymentStatus?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  travelDateFrom?: string;
  travelDateTo?: string;
}

export async function listHistoricalSales(supabase: SupabaseClient, filters: HistoricalSalesFilters = {}) {
  let query = supabase.from('historical_sales').select(HISTORICAL_SELECT).order('invoice_date', { ascending: false });

  if (filters.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
  if (filters.invoiceDateFrom) query = query.gte('invoice_date', filters.invoiceDateFrom);
  if (filters.invoiceDateTo) query = query.lte('invoice_date', filters.invoiceDateTo);
  if (filters.travelDateFrom) query = query.gte('travel_date', filters.travelDateFrom);
  if (filters.travelDateTo) query = query.lte('travel_date', filters.travelDateTo);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load historical sales: ${error.message}`);

  let rows = (data ?? []).map((r) => {
    const linkedClient = unwrapToOne(r.linked_client) as { id: string; full_name: string } | null;
    return {
      historicalId: r.id as string,
      quotationRef: (r.quotation_ref as string | null) ?? '—',
      linkedQuotationId: r.linked_quotation_id as string | null,
      customerName: linkedClient?.full_name ?? (r.customer_name as string),
      linkedClientId: r.linked_client_id as string | null,
      invoiceDate: r.invoice_date as string | null,
      travelDate: r.travel_date as string | null,
      totalSale: Number(r.total_sale),
      amountPaid: Number(r.amount_paid),
      balance: Math.max(0, Number(r.total_sale) - Number(r.amount_paid)),
      paymentStatus: r.payment_status as string,
      paymentDueDate: r.payment_due_date as string | null,
      airfareCost: Number(r.airfare_cost),
      hotelCost: Number(r.hotel_cost),
      transferCost: Number(r.transfer_cost),
      tourCost: Number(r.tour_cost),
      bankCharge: Number(r.bank_charge),
      refund: Number(r.refund),
      totalCost: Number(r.total_cost),
      netProfit: Number(r.net_profit),
      agentName: (r.agent_name as string | null) ?? '—',
      zohoInvoiceNumber: (r.zoho_invoice_number as string | null) ?? '',
      remarks: (r.remarks as string | null) ?? '',
    };
  });

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter((r) => r.customerName.toLowerCase().includes(q) || r.quotationRef.toLowerCase().includes(q));
  }

  return rows;
}

export function computeHistoricalCostAndProfit(input: {
  totalSale: number;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
}) {
  const totalCost = input.airfareCost + input.hotelCost + input.transferCost + input.tourCost + input.bankCharge + input.refund;
  return { totalCost, netProfit: input.totalSale - totalCost };
}

/**
 * Manual add/edit always recalculates Total Cost and Net Profit from the
 * entered cost fields (per spec: "for newly created or manually edited
 * historical records, use the normal calculations") — this is the one
 * path that's allowed to overwrite those two fields; the import path
 * below deliberately is not.
 */
export async function upsertHistoricalSale(supabase: SupabaseClient, input: HistoricalSaleInput, actingUserId: string) {
  const { totalCost, netProfit } = computeHistoricalCostAndProfit(input);
  const patch = {
    quotation_ref: input.quotationRef || null,
    linked_client_id: input.linkedClientId || null,
    customer_name: input.customerName,
    invoice_date: input.invoiceDate || null,
    travel_date: input.travelDate || null,
    total_sale: input.totalSale,
    amount_paid: input.amountPaid,
    payment_status: input.paymentStatus,
    payment_due_date: input.paymentDueDate || null,
    airfare_cost: input.airfareCost,
    hotel_cost: input.hotelCost,
    transfer_cost: input.transferCost,
    tour_cost: input.tourCost,
    bank_charge: input.bankCharge,
    refund: input.refund,
    total_cost: totalCost,
    net_profit: netProfit,
    agent_name: input.agentName || null,
    zoho_invoice_number: input.zohoInvoiceNumber || null,
    remarks: input.remarks || null,
    created_by: actingUserId,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from('historical_sales').update(patch).eq('id', input.id);
    if (error) throw new Error(`Failed to update historical sale: ${error.message}`);
    return { id: input.id };
  }

  const { data, error } = await supabase.from('historical_sales').insert(patch).select('id').single();
  if (error || !data) throw new Error(`Failed to add historical sale: ${error?.message}`);
  return { id: data.id as string };
}

/**
 * A lighter-weight partial update than upsertHistoricalSale, for the
 * Sales table's inline-editable cells (one cost field or Remarks at a
 * time) — recalculates Total Cost/Net Profit from whatever the row's
 * current cost values are afterward, same as a full manual edit.
 */
export async function updateHistoricalSaleField(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    airfareCost: number;
    hotelCost: number;
    transferCost: number;
    tourCost: number;
    bankCharge: number;
    refund: number;
    remarks: string;
    zohoInvoiceNumber: string;
  }>
) {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.airfareCost !== undefined) dbPatch.airfare_cost = patch.airfareCost;
  if (patch.hotelCost !== undefined) dbPatch.hotel_cost = patch.hotelCost;
  if (patch.transferCost !== undefined) dbPatch.transfer_cost = patch.transferCost;
  if (patch.tourCost !== undefined) dbPatch.tour_cost = patch.tourCost;
  if (patch.bankCharge !== undefined) dbPatch.bank_charge = patch.bankCharge;
  if (patch.refund !== undefined) dbPatch.refund = patch.refund;
  if (patch.remarks !== undefined) dbPatch.remarks = patch.remarks || null;
  if (patch.zohoInvoiceNumber !== undefined) dbPatch.zoho_invoice_number = patch.zohoInvoiceNumber || null;

  const hasCostChange = ['airfareCost', 'hotelCost', 'transferCost', 'tourCost', 'bankCharge', 'refund'].some((k) => k in patch);
  if (hasCostChange) {
    const { data: current, error: fetchError } = await supabase
      .from('historical_sales')
      .select('total_sale, airfare_cost, hotel_cost, transfer_cost, tour_cost, bank_charge, refund')
      .eq('id', id)
      .single();
    if (fetchError || !current) throw new Error('Historical sale not found.');
    const merged = {
      airfareCost: patch.airfareCost ?? Number(current.airfare_cost),
      hotelCost: patch.hotelCost ?? Number(current.hotel_cost),
      transferCost: patch.transferCost ?? Number(current.transfer_cost),
      tourCost: patch.tourCost ?? Number(current.tour_cost),
      bankCharge: patch.bankCharge ?? Number(current.bank_charge),
      refund: patch.refund ?? Number(current.refund),
    };
    const { totalCost, netProfit } = computeHistoricalCostAndProfit({ totalSale: Number(current.total_sale), ...merged });
    dbPatch.total_cost = totalCost;
    dbPatch.net_profit = netProfit;
  }

  const { error } = await supabase.from('historical_sales').update(dbPatch).eq('id', id);
  if (error) throw new Error(`Failed to update historical sale: ${error.message}`);
}

export async function deleteHistoricalSale(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('historical_sales').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete historical sale: ${error.message}`);
}

/**
 * Duplicate detection for import — matches on the combination of
 * customer name, invoice date, and quotation ref (when present), since
 * the old tracker has no single reliable unique key. Deliberately a
 * "detect and let the agent decide" check, not a hard database
 * constraint, matching "if a duplicate is detected, show it clearly
 * before importing" rather than silently rejecting rows.
 */
export async function findHistoricalDuplicates(
  supabase: SupabaseClient,
  candidates: { customerName: string; invoiceDate: string | null; quotationRef: string | null }[]
): Promise<Set<string>> {
  const { data, error } = await supabase.from('historical_sales').select('customer_name, invoice_date, quotation_ref');
  if (error) throw new Error(`Failed to check for duplicate historical sales: ${error.message}`);

  const existingKeys = new Set((data ?? []).map((r) => fingerprint(r.customer_name, r.invoice_date, r.quotation_ref)));
  const duplicateKeys = new Set<string>();
  for (const c of candidates) {
    const key = fingerprint(c.customerName, c.invoiceDate, c.quotationRef);
    if (existingKeys.has(key)) duplicateKeys.add(key);
  }
  return duplicateKeys;
}

export function fingerprint(customerName: string, invoiceDate: string | null, quotationRef: string | null): string {
  return [customerName.trim().toLowerCase(), invoiceDate ?? '', (quotationRef ?? '').trim().toLowerCase()].join('|');
}

/**
 * Bulk-imports already-validated rows. Total Cost/Net Profit are written
 * EXACTLY as they arrived from validateHistoricalMappedRow (which itself
 * only computes them when the sheet didn't already have its own values) —
 * this function never recalculates on top of that, preserving old-tracker
 * figures verbatim per spec. No quotation, client, booking, or payment
 * record is created for any imported row.
 */
export async function commitHistoricalImport(supabase: SupabaseClient, rows: NormalizedHistoricalRow[], actingUserId: string) {
  if (rows.length === 0) return { imported: 0 };
  const { error } = await supabase.from('historical_sales').insert(
    rows.map((r) => ({
      quotation_ref: r.quotationRef,
      customer_name: r.customerName,
      invoice_date: r.invoiceDate,
      travel_date: r.travelDate,
      total_sale: r.totalSale,
      amount_paid: r.amountPaid,
      payment_status: r.paymentStatus,
      airfare_cost: r.airfareCost,
      hotel_cost: r.hotelCost,
      transfer_cost: r.transferCost,
      tour_cost: r.tourCost,
      bank_charge: r.bankCharge,
      refund: r.refund,
      total_cost: r.totalCost,
      net_profit: r.netProfit,
      remarks: r.remarks,
      created_by: actingUserId,
    }))
  );
  if (error) throw new Error(`Failed to import historical sales: ${error.message}`);
  return { imported: rows.length };
}
