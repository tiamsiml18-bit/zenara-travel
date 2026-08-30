import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuotationDraftInput } from '@/lib/validation/quotation';
import { writeAudit, diffFields } from './audit';
import { setClientStatusByName } from './clients';
import { generateFirstFollowUp } from './followups';
import { updateQuotationPipelineStage } from './pipeline';

const VERSION_SELECT = `
  id, version_number, version_label, status, client_name_snapshot, destination,
  travel_start_date, travel_end_date, valid_until, num_adults, num_children, hotel_name,
  num_bedrooms, price_per_person, total_price, currency, notes, sent_at, created_at,
  consultant_id, consultant_name_snapshot,
  num_seniors, num_infants, num_pwd
`;

export interface QuotationListFilters {
  status?: string;
  agentId?: string;
  consultantId?: string;
  destination?: string;
  travelStartFrom?: string;
  travelStartTo?: string;
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export async function listQuotations(supabase: SupabaseClient, filters: QuotationListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Filtering by consultant or travel date means filtering PARENT
  // (quotations) rows by a condition on the EMBEDDED quotation_versions
  // row — PostgREST only applies an embedded filter to which parent rows
  // come back at all when the embed is an inner join (`!inner`), not a
  // left join (the default). Only switching to inner-join when one of
  // these filters is actually active avoids ever silently hiding a
  // quotation whose version embed would otherwise be a left join.
  const needsInnerVersion = Boolean(filters.consultantId || filters.travelStartFrom || filters.travelStartTo);

  let query = supabase
    .from('quotations')
    .select(
      `id, quotation_number, status, created_at, updated_at,
       client:clients ( id, full_name ),
       agent:users!quotations_assigned_agent_id_fkey ( id, full_name ),
       current_version:quotation_versions!quotations_current_version_id_fkey${needsInnerVersion ? '!inner' : ''} (
         destination, travel_start_date, travel_end_date, num_adults, num_children, total_price,
         consultant_id, consultant_name_snapshot
       )`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to);

  // Archived quotations are hidden by default (that's the whole point of
  // the Archive button) but never actually excluded before — `is_archived`
  // existed on the table with no query ever checking it.
  if (!filters.includeArchived) query = query.eq('is_archived', false);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);
  if (filters.consultantId) query = query.eq('current_version.consultant_id', filters.consultantId);
  if (filters.travelStartFrom) query = query.gte('current_version.travel_start_date', filters.travelStartFrom);
  if (filters.travelStartTo) query = query.lte('current_version.travel_start_date', filters.travelStartTo);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load quotations: ${error.message}`);
  return { quotations: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listQuotationsByClient(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('quotations')
    .select(
      `id, quotation_number, status, created_at,
       current_version:quotation_versions!quotations_current_version_id_fkey ( destination, total_price, travel_start_date )`
    )
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getQuotationById(supabase: SupabaseClient, quotationId: string) {
  const { data: quotation, error } = await supabase
    .from('quotations')
    .select(
      `*, client:clients ( id, full_name, email, mobile_number ),
       agent:users!quotations_assigned_agent_id_fkey ( id, full_name )`
    )
    .eq('id', quotationId)
    .single();
  if (error || !quotation) throw new Error('Quotation not found.');

  const { data: versions, error: vErr } = await supabase
    .from('quotation_versions')
    .select(VERSION_SELECT)
    .eq('quotation_id', quotationId)
    .order('version_number', { ascending: false });
  if (vErr) throw new Error(vErr.message);

  const currentVersion = versions?.find((v) => v.id === quotation.current_version_id) ?? versions?.[0];

  return { quotation, versions: versions ?? [], currentVersion };
}

export async function getVersionDetail(supabase: SupabaseClient, versionId: string) {
  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }, { data: costItems }, { data: feeItems }, { data: guestPricing }, { data: guestPricingInternal }] =
    await Promise.all([
      supabase
        .from('quotation_itinerary_days')
        .select('id, day_number, day_date, title, description, activities, source_tour_id')
        .eq('quotation_version_id', versionId)
        .order('day_number'),
      supabase
        .from('quotation_inclusions')
        .select('id, item')
        .eq('quotation_version_id', versionId)
        .order('sort_order'),
      supabase
        .from('quotation_exclusions')
        .select('id, item')
        .eq('quotation_version_id', versionId)
        .order('sort_order'),
      supabase
        .from('quotation_items')
        .select('id, label, unit_price')
        .eq('quotation_version_id', versionId)
        .order('sort_order'),
      supabase
        .from('quotation_fees')
        .select('id, label, amount')
        .eq('quotation_version_id', versionId)
        .order('sort_order'),
      supabase.from('quotation_guest_pricing').select('guest_type, price_per_person').eq('quotation_version_id', versionId),
      // Internal supplier cost per guest type — RLS on this table already
      // restricts it to admin/manager/owning-agent, same as
      // quotation_pricing_internal; a plain agent viewing someone else's
      // quotation simply gets an empty result here, not an error.
      supabase
        .from('quotation_guest_pricing_internal')
        .select('guest_type, supplier_cost_per_person')
        .eq('quotation_version_id', versionId),
    ]);

  const supplierCostByType = new Map((guestPricingInternal ?? []).map((g) => [g.guest_type, Number(g.supplier_cost_per_person)]));
  const guestRates = (guestPricing ?? []).map((g) => ({
    guestType: g.guest_type as 'senior' | 'adult' | 'child' | 'infant' | 'pwd',
    pricePerPerson: Number(g.price_per_person),
    supplierCostPerPerson: supplierCostByType.get(g.guest_type) ?? 0,
  }));

  return {
    itinerary: itinerary ?? [],
    inclusions: inclusions ?? [],
    exclusions: exclusions ?? [],
    costItems: (costItems ?? []).map((c) => ({ label: c.label, amount: Number(c.unit_price) })),
    feeItems: (feeItems ?? []).map((f) => ({ label: f.label, amount: Number(f.amount) })),
    guestRates,
  };
}

/** Only returns data for admin/manager/owning-agent — enforced by RLS, this just isolates the query. */
export async function getPricingForVersion(supabase: SupabaseClient, versionId: string) {
  const { data } = await supabase
    .from('quotation_pricing_internal')
    .select(
      `supplier_cost, markup, selling_price, profit, profit_margin_pct,
       airfare_actual_rate, airfare_senior_rate, airfare_child_rate, airfare_infant_rate, airfare_pwd_rate,
       hotel_actual_rate, transfer_actual_rate, payment_method`
    )
    .eq('quotation_version_id', versionId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Resolves a consultant's current name for snapshotting onto a version at
 * creation time — same "freeze at issue time" pattern as client_name_snapshot,
 * so renaming/deactivating a consultant later never retroactively changes an
 * already-issued quotation's PDF.
 */
/** 14 days from today, as a YYYY-MM-DD string — the sensible starting point for a new quotation's validity date, fully editable before save. */
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

async function resolveConsultantName(supabase: SupabaseClient, consultantId?: string | null): Promise<string | null> {
  if (!consultantId) return null;
  const { data } = await supabase.from('agency_consultants').select('full_name').eq('id', consultantId).single();
  return data?.full_name ?? null;
}

import { calculateTotalPrice, calculateGuestSupplierCost, activeGuestTypes, GUEST_TYPES, GUEST_TYPE_LABELS, calculateAirfareRates, calculateHotelRatePerPerson, calculateTransferRatePerPerson, calculatePackagePerPax, calculateBankFee, calculateAdjustedPackage, calculateFinalRatePerPax, type GuestCounts, type GuestRates } from '@/lib/utils/guest-pricing';

/** Pulls the 5 guest counts off a QuotationDraftInput into the shape guest-pricing.ts expects. */
function guestCountsOf(input: QuotationDraftInput): GuestCounts {
  return {
    senior: input.numSeniors,
    adult: input.numAdults,
    child: input.numChildren,
    infant: input.numInfants,
    pwd: input.numPwd,
  };
}

/**
 * The one function that computes a quotation's actual pricing — replicating
 * the agency's Excel formula chain exactly (Airfare → Hotel → Transfer →
 * Tours → Package per PAX → Bank Fee → Adjusted → Final Rate per PAX).
 * Called from every place a version's pricing needs to be known (the
 * version row's total_price, insertVersionChildren's guest_pricing rows) so
 * there is exactly one calculation path, never three drifting copies of it.
 */
async function computeFullPricing(supabase: SupabaseClient, input: QuotationDraftInput) {
  const counts = guestCountsOf(input);

  const tourClientRates: GuestRates = {};
  const tourSupplierRates: GuestRates = {};
  for (const rate of input.guestRates) {
    tourClientRates[rate.guestType] = rate.pricePerPerson;
    tourSupplierRates[rate.guestType] = rate.supplierCostPerPerson;
  }

  const airfareRates = calculateAirfareRates(
    {
      actualRate: input.airfareActualRate,
      seniorRate: input.airfareSeniorRate,
      childRate: input.airfareChildRate,
      infantRate: input.airfareInfantRate,
      pwdRate: input.airfarePwdRate,
    },
    counts
  );
  const hotelRatePerPerson = calculateHotelRatePerPerson(input.hotelActualRate, counts);
  const transferRatePerPerson = calculateTransferRatePerPerson(input.transferActualRate, counts);
  const packagePerPax = calculatePackagePerPax(airfareRates, hotelRatePerPerson, transferRatePerPerson, tourClientRates);

  const { data: agencySettings } = await supabase
    .from('agency_settings')
    .select('credit_card_fee_pct, paypal_fee_pct')
    .limit(1)
    .single();
  const feePct =
    input.paymentMethod === 'credit_card'
      ? (agencySettings?.credit_card_fee_pct ?? 0.029)
      : input.paymentMethod === 'paypal'
        ? (agencySettings?.paypal_fee_pct ?? 0.039)
        : 0;
  const bankFee = calculateBankFee(packagePerPax, feePct);
  const adjustedPackage = calculateAdjustedPackage(packagePerPax, bankFee);
  const clientRates = calculateFinalRatePerPax(adjustedPackage, input.markup);

  const totalPrice = calculateTotalPrice(counts, clientRates);
  const otherCostsTotal = input.costItems.reduce((sum, item) => sum + item.amount, 0);
  const tourSupplierCostTotal = calculateGuestSupplierCost(counts, tourSupplierRates);
  const supplierCost = input.airfareActualRate + input.hotelActualRate + input.transferActualRate + otherCostsTotal + tourSupplierCostTotal;

  return { counts, clientRates, tourSupplierRates, totalPrice, supplierCost };
}

async function insertVersionChildren(
  supabase: SupabaseClient,
  versionId: string,
  input: QuotationDraftInput
) {
  if (input.itinerary.length > 0) {
    const { error } = await supabase.from('quotation_itinerary_days').insert(
      input.itinerary.map((d) => ({
        quotation_version_id: versionId,
        day_number: d.dayNumber,
        day_date: d.dayDate || null,
        title: d.title,
        description: d.description || null,
        activities: d.activities,
        source_tour_id: d.sourceTourId || null,
      }))
    );
    if (error) throw new Error(`Failed to save itinerary: ${error.message}`);
  }

  if (input.inclusions.length > 0) {
    const { error } = await supabase.from('quotation_inclusions').insert(
      input.inclusions.map((item, i) => ({ quotation_version_id: versionId, item, sort_order: i }))
    );
    if (error) throw new Error(`Failed to save inclusions: ${error.message}`);
  }

  if (input.exclusions.length > 0) {
    const { error } = await supabase.from('quotation_exclusions').insert(
      input.exclusions.map((item, i) => ({ quotation_version_id: versionId, item, sort_order: i }))
    );
    if (error) throw new Error(`Failed to save exclusions: ${error.message}`);
  }

  // Client-facing additional fees / taxes — a separate table from
  // quotation_items (internal cost breakdown) since one is meant to be shown
  // to the client (via the PDF) and the other must never be.
  if (input.feeItems.length > 0) {
    const { error } = await supabase.from('quotation_fees').insert(
      input.feeItems.map((item, i) => ({
        quotation_version_id: versionId,
        label: item.label,
        amount: item.amount,
        sort_order: i,
      }))
    );
    if (error) throw new Error(`Failed to save additional fees: ${error.message}`);
  }

  // Internal cost breakdown (airfare, hotel, transfers, custom client
  // requests like a sleeper bus) — stored per-item so it's editable later,
  // never surfaced client-side. quotation_items has no RLS path that feeds
  // the PDF or any client-facing query (see quotation_pricing_internal's
  // isolation note below for the same guarantee on the summed total).
  if (input.costItems.length > 0) {
    const { error } = await supabase.from('quotation_items').insert(
      input.costItems.map((item, i) => ({
        quotation_version_id: versionId,
        label: item.label,
        unit_price: item.amount,
        quantity: 1,
        sort_order: i,
      }))
    );
    if (error) throw new Error(`Failed to save cost breakdown: ${error.message}`);
  }

  // ==========================================================================
  // Pricing — replicates the agency's Excel quotation formula chain exactly
  // (verified cell-by-cell against real data before this was built). See
  // computeFullPricing() above — the single calculation path shared with the
  // quotation_versions row itself, so the two can never disagree.
  // ==========================================================================
  const { counts, clientRates, tourSupplierRates, supplierCost } = await computeFullPricing(supabase, input);
  const active = activeGuestTypes(counts);
  const totalPrice = calculateTotalPrice(counts, clientRates);

  if (active.length > 0) {
    const { error: guestPricingError } = await supabase.from('quotation_guest_pricing').insert(
      active.map((guestType) => ({
        quotation_version_id: versionId,
        guest_type: guestType,
        price_per_person: clientRates[guestType] ?? 0,
      }))
    );
    if (guestPricingError) throw new Error(`Failed to save guest pricing: ${guestPricingError.message}`);

    const { error: guestPricingInternalError } = await supabase.from('quotation_guest_pricing_internal').insert(
      active.map((guestType) => ({
        quotation_version_id: versionId,
        guest_type: guestType,
        supplier_cost_per_person: tourSupplierRates[guestType] ?? 0,
      }))
    );
    if (guestPricingInternalError) {
      throw new Error(`Failed to save internal guest pricing: ${guestPricingInternalError.message}`);
    }
  }

  const { error: pricingError } = await supabase.from('quotation_pricing_internal').insert({
    quotation_version_id: versionId,
    supplier_cost: supplierCost,
    markup: input.markup,
    selling_price: totalPrice,
    airfare_actual_rate: input.airfareActualRate,
    airfare_senior_rate: input.airfareSeniorRate,
    airfare_child_rate: input.airfareChildRate,
    airfare_infant_rate: input.airfareInfantRate,
    airfare_pwd_rate: input.airfarePwdRate,
    hotel_actual_rate: input.hotelActualRate,
    transfer_actual_rate: input.transferActualRate,
    payment_method: input.paymentMethod,
  });
  if (pricingError) throw new Error(`Failed to save pricing: ${pricingError.message}`);

  return { totalPrice };
}

/**
 * Creates a brand-new quotation (envelope + version 1, status draft).
 *
 * NOTE ON ATOMICITY: this performs several sequential inserts rather than a
 * single DB transaction, because the Supabase JS client does not expose
 * multi-statement transactions. If a later insert fails, we best-effort
 * delete the quotation row (cascade removes the version + children). For
 * stronger guarantees under high concurrency, migrate this to a single
 * `create_quotation_draft(jsonb)` Postgres function — flagged in
 * ARCHITECTURE.md as a hardening item before scaling past the pilot team.
 */
/**
 * Edits a DRAFT quotation in place — no new version, no revision number
 * bump. This is only safe because a draft was never sent to a client; the
 * revision system (reviseQuotation, below) exists specifically for the
 * case where that's no longer true. Reuses insertVersionChildren after
 * clearing the existing children, so the exact same pricing/snapshot logic
 * that powers creation also powers this edit.
 */
export async function updateDraftQuotation(
  supabase: SupabaseClient,
  quotationId: string,
  input: QuotationDraftInput,
  actingUserId: string
) {
  const { data: quotation, error: qFetchError } = await supabase
    .from('quotations')
    .select('id, current_version_id, quotation_versions:quotation_versions!quotations_current_version_id_fkey(status)')
    .eq('id', quotationId)
    .single();
  if (qFetchError || !quotation) throw new Error('Quotation not found.');

  const versionStatus = (
    Array.isArray(quotation.quotation_versions) ? quotation.quotation_versions[0] : quotation.quotation_versions
  )?.status;
  if (versionStatus !== 'draft') {
    throw new Error('This quotation has already been sent — use Edit to create a revision instead of editing it directly.');
  }

  const versionId = quotation.current_version_id as string;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('full_name')
    .eq('id', input.clientId)
    .single();
  if (clientError || !client) throw new Error('Client not found.');

  const consultantName = await resolveConsultantName(supabase, input.consultantId);

  const { clientRates: clientRatesForTotal, totalPrice: computedTotalPrice } = await computeFullPricing(supabase, input);

  const { error: quotationUpdateError } = await supabase
    .from('quotations')
    .update({ client_id: input.clientId, package_id: input.packageId || null })
    .eq('id', quotationId);
  if (quotationUpdateError) throw new Error(`Failed to update quotation: ${quotationUpdateError.message}`);

  const { error: vError } = await supabase
    .from('quotation_versions')
    .update({
      client_name_snapshot: client.full_name,
      destination: input.destination,
      travel_start_date: input.travelStartDate,
      travel_end_date: input.travelEndDate,
      valid_until: input.validUntil,
      num_adults: input.numAdults,
      num_children: input.numChildren,
      num_seniors: input.numSeniors,
      num_infants: input.numInfants,
      num_pwd: input.numPwd,
      hotel_name: input.hotelName || null,
      num_bedrooms: input.numBedrooms ?? null,
      price_per_person: clientRatesForTotal.adult ?? null,
      total_price: computedTotalPrice,
      notes: input.notes || null,
      consultant_id: input.consultantId || null,
      consultant_name_snapshot: consultantName,
    })
    .eq('id', versionId);
  if (vError) throw new Error(`Failed to update quotation version: ${vError.message}`);

  // Clear and rebuild every child table — safe only while still a draft;
  // the prevent_child_mutation_if_version_locked() trigger would reject
  // this the moment status moves past 'draft'.
  await Promise.all([
    supabase.from('quotation_itinerary_days').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_inclusions').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_exclusions').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_fees').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_items').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_guest_pricing').delete().eq('quotation_version_id', versionId),
    supabase.from('quotation_guest_pricing_internal').delete().eq('quotation_version_id', versionId),
  ]);
  await supabase.from('quotation_pricing_internal').delete().eq('quotation_version_id', versionId);

  await insertVersionChildren(supabase, versionId, input);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.draft_edited',
    entityType: 'quotation',
    entityId: quotationId,
  });

  return quotationId;
}

export async function createDraftQuotation(
  supabase: SupabaseClient,
  input: QuotationDraftInput,
  actingUserId: string
) {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('full_name')
    .eq('id', input.clientId)
    .single();
  if (clientError || !client) throw new Error('Client not found.');

  const consultantName = await resolveConsultantName(supabase, input.consultantId);

  const { data: quotationNumber, error: numError } = await supabase.rpc('allocate_quotation_number', {
    p_prefix: 'QT',
  });
  if (numError || !quotationNumber) throw new Error('Failed to allocate a quotation number.');

  const { data: quotation, error: qError } = await supabase
    .from('quotations')
    .insert({
      quotation_number: quotationNumber,
      client_id: input.clientId,
      package_id: input.packageId || null,
      status: 'draft',
      assigned_agent_id: actingUserId,
    })
    .select('id')
    .single();
  if (qError || !quotation) throw new Error(`Failed to create quotation: ${qError?.message}`);

  // Computed here (not read from the request) so the version row's
  // total_price is never anything the agent typed — see
  // lib/utils/guest-pricing.ts for the one formula this and
  // insertVersionChildren() both use.
  const { clientRates: clientRatesForTotal, totalPrice: computedTotalPrice } = await computeFullPricing(supabase, input);

  try {
    const { data: version, error: vError } = await supabase
      .from('quotation_versions')
      .insert({
        quotation_id: quotation.id,
        version_number: 1,
        version_label: 'Original',
        status: 'draft',
        client_name_snapshot: client.full_name,
        destination: input.destination,
        travel_start_date: input.travelStartDate,
        travel_end_date: input.travelEndDate,
        valid_until: input.validUntil,
        num_adults: input.numAdults,
        num_children: input.numChildren,
        num_seniors: input.numSeniors,
        num_infants: input.numInfants,
        num_pwd: input.numPwd,
        hotel_name: input.hotelName || null,
        num_bedrooms: input.numBedrooms ?? null,
        // Legacy single-rate field — kept populated with the adult rate
        // (the closest thing to a "primary" rate) purely so any old report
        // or view still expecting a single number has something sane to
        // read; it's no longer shown as the quotation's real pricing
        // anywhere, which is now always the per-guest-type breakdown.
        price_per_person: clientRatesForTotal.adult ?? null,
        total_price: computedTotalPrice,
        notes: input.notes || null,
        created_by: actingUserId,
        consultant_id: input.consultantId || null,
        consultant_name_snapshot: consultantName,
      })
      .select('id')
      .single();
    if (vError || !version) throw new Error(`Failed to create quotation version: ${vError?.message}`);

    await insertVersionChildren(supabase, version.id, input);

    const { error: linkError } = await supabase
      .from('quotations')
      .update({ current_version_id: version.id })
      .eq('id', quotation.id);
    if (linkError) throw new Error(linkError.message);

    await supabase.from('client_activities').insert({
      client_id: input.clientId,
      activity_type: 'quotation_created',
      description: `Quotation ${quotationNumber} created.`,
      user_id: actingUserId,
      related_quotation_id: quotation.id,
    });

    await writeAudit(supabase, {
      userId: actingUserId,
      action: 'quotation.created',
      entityType: 'quotation',
      entityId: quotation.id,
      metadata: { quotationNumber },
    });

    return { quotationId: quotation.id as string, quotationNumber: quotationNumber as string };
  } catch (err) {
    // Compensating cleanup — see atomicity note above.
    await supabase.from('quotations').delete().eq('id', quotation.id);
    throw err;
  }
}

/**
 * Sends a draft quotation: locks the version (via status change, DB trigger
 * enforces immutability from here on), updates client status, and generates
 * the follow-up schedule.
 */
export async function sendQuotation(supabase: SupabaseClient, quotationId: string, actingUserId: string) {
  const { quotation, currentVersion } = await getQuotationById(supabase, quotationId);
  if (!currentVersion) throw new Error('Quotation has no version to send.');
  if (currentVersion.status !== 'draft') throw new Error('This version has already been sent.');

  const sentAt = new Date().toISOString();

  const { error: vError } = await supabase
    .from('quotation_versions')
    .update({ status: 'sent', sent_at: sentAt })
    .eq('id', currentVersion.id);
  if (vError) throw new Error(`Failed to mark version as sent: ${vError.message}`);

  const { error: qError } = await supabase
    .from('quotations')
    .update({ status: 'sent', pipeline_stage: 'quotation_sent' })
    .eq('id', quotationId);
  if (qError) throw new Error(`Failed to update quotation status: ${qError.message}`);

  // Pipeline stage change gets its own audit entry (previous → new), same
  // as every other pipeline move, even though it's happening automatically
  // here rather than from a manual drag on the Kanban board.
  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.pipeline_stage_changed',
    entityType: 'quotation',
    entityId: quotationId,
    metadata: { previousStage: quotation.pipeline_stage, newStage: 'quotation_sent' },
  });

  await setClientStatusByName(
    supabase,
    quotation.client_id,
    'Quotation Sent',
    actingUserId,
    `Quotation ${quotation.quotation_number} sent to client.`
  );

  await supabase.from('client_activities').insert({
    client_id: quotation.client_id,
    activity_type: 'quotation_sent',
    description: `Quotation ${quotation.quotation_number} sent.`,
    user_id: actingUserId,
    related_quotation_id: quotationId,
  });

  await generateFirstFollowUp(supabase, {
    quotationId,
    clientId: quotation.client_id,
    agentId: quotation.assigned_agent_id,
    sentAt: new Date(sentAt),
  });

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.sent',
    entityType: 'quotation',
    entityId: quotationId,
  });

  return { clientId: quotation.client_id as string };
}

/**
 * Creates a new version under the SAME quotation number (Rev 2, Rev 3, ...).
 * The prior version is left untouched — the immutability trigger would
 * reject an update to it anyway once its status left 'draft'.
 */
export async function reviseQuotation(
  supabase: SupabaseClient,
  quotationId: string,
  input: QuotationDraftInput,
  actingUserId: string
) {
  const { quotation, versions } = await getQuotationById(supabase, quotationId);
  const nextVersionNumber = Math.max(...versions.map((v) => v.version_number), 0) + 1;

  const { data: client } = await supabase.from('clients').select('full_name').eq('id', quotation.client_id).single();
  const consultantName = await resolveConsultantName(supabase, input.consultantId);

  const { clientRates: revisedClientRates, totalPrice: revisedTotalPrice } = await computeFullPricing(supabase, input);

  const { data: version, error: vError } = await supabase
    .from('quotation_versions')
    .insert({
      quotation_id: quotationId,
      version_number: nextVersionNumber,
      version_label: `Rev ${nextVersionNumber}`,
      status: 'draft',
      client_name_snapshot: client?.full_name ?? 'Unknown',
      destination: input.destination,
      travel_start_date: input.travelStartDate,
      travel_end_date: input.travelEndDate,
      valid_until: input.validUntil,
      num_adults: input.numAdults,
      num_children: input.numChildren,
      num_seniors: input.numSeniors,
      num_infants: input.numInfants,
      num_pwd: input.numPwd,
      hotel_name: input.hotelName || null,
      num_bedrooms: input.numBedrooms ?? null,
      price_per_person: revisedClientRates.adult ?? null,
      total_price: revisedTotalPrice,
      notes: input.notes || null,
      created_by: actingUserId,
      consultant_id: input.consultantId || null,
      consultant_name_snapshot: consultantName,
    })
    .select('id')
    .single();
  if (vError || !version) throw new Error(`Failed to create revision: ${vError?.message}`);

  await insertVersionChildren(supabase, version.id, input);

  await supabase
    .from('quotations')
    .update({ current_version_id: version.id, status: 'draft' })
    .eq('id', quotationId);

  await supabase.from('client_activities').insert({
    client_id: quotation.client_id,
    activity_type: 'quotation_revised',
    description: `Quotation ${quotation.quotation_number} revised (Rev ${nextVersionNumber}).`,
    user_id: actingUserId,
    related_quotation_id: quotationId,
  });

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.revised',
    entityType: 'quotation',
    entityId: quotationId,
    metadata: { versionNumber: nextVersionNumber },
  });

  // Field-level diff specifically for guest counts and per-guest-type
  // rates — the two things this revision most likely changed on purpose,
  // and the two things "record changes to guest quantities and guest-type
  // rates" explicitly asks to be traceable. Reuses the same diffFields()
  // pattern already used for client edits, so this reads the same way in
  // Audit History (label, old value, new value) rather than inventing a
  // second format.
  const oldVersion = versions.find((v) => v.id === quotation.current_version_id);
  if (oldVersion) {
    const { guestRates: oldGuestRates } = await getVersionDetail(supabase, oldVersion.id);
    const oldRateByType = Object.fromEntries(oldGuestRates.map((r) => [r.guestType, r.pricePerPerson]));
    const newRateByType = Object.fromEntries(input.guestRates.map((r) => [r.guestType, r.pricePerPerson]));

    const before: Record<string, number> = {
      numSeniors: oldVersion.num_seniors ?? 0,
      numAdults: oldVersion.num_adults,
      numChildren: oldVersion.num_children,
      numInfants: oldVersion.num_infants ?? 0,
      numPwd: oldVersion.num_pwd ?? 0,
    };
    const after: Record<string, number> = {
      numSeniors: input.numSeniors,
      numAdults: input.numAdults,
      numChildren: input.numChildren,
      numInfants: input.numInfants,
      numPwd: input.numPwd,
    };
    const labels: Record<string, string> = {
      numSeniors: 'Senior citizen count',
      numAdults: 'Adult count',
      numChildren: 'Child count',
      numInfants: 'Infant/toddler count',
      numPwd: 'PWD count',
    };
    for (const guestType of GUEST_TYPES) {
      before[`rate_${guestType}`] = oldRateByType[guestType] ?? 0;
      after[`rate_${guestType}`] = newRateByType[guestType] ?? 0;
      labels[`rate_${guestType}`] = `${GUEST_TYPE_LABELS[guestType]} rate`;
    }

    const guestChanges = diffFields(before, after, labels);
    if (guestChanges.length > 0) {
      await writeAudit(supabase, {
        userId: actingUserId,
        action: 'quotation.guest_pricing_changed',
        entityType: 'quotation',
        entityId: quotationId,
        metadata: { versionNumber: nextVersionNumber, changes: guestChanges },
      });
    }
  }

  return version.id as string;
}

/**
 * Generic status transition for a quotation, used for the states that don't
 * have their own dedicated flow (send/revise/duplicate already have one).
 * Mirrors the change onto the client status per the mapping in the spec:
 * quotation confirmed -> client "Confirmed", quotation negotiating -> client
 * "Negotiating", etc. Only touches client status for the transitions the
 * spec explicitly calls out; other quotation statuses leave client status
 * alone so an agent's manual client status isn't clobbered unexpectedly.
 */
const QUOTATION_TO_CLIENT_STATUS: Partial<Record<string, string>> = {
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  lost: 'Lost',
  expired: 'Expired',
};

/**
 * Archive is a soft, reversible hide — not deletion. Uses the dedicated
 * `is_archived` flag (kept separate from `deleted_at`, which this app
 * reserves for actual removal from every query, whereas an archived
 * quotation should still be findable if someone goes looking for it).
 * Gated by a confirmation dialog client-side; this function just executes.
 */
export async function archiveQuotation(supabase: SupabaseClient, quotationId: string, actingUserId: string) {
  const { error } = await supabase.from('quotations').update({ is_archived: true }).eq('id', quotationId);
  if (error) throw new Error(`Failed to archive quotation: ${error.message}`);
  await writeAudit(supabase, { userId: actingUserId, action: 'quotation.archived', entityType: 'quotation', entityId: quotationId });
}

export async function unarchiveQuotation(supabase: SupabaseClient, quotationId: string, actingUserId: string) {
  const { error } = await supabase.from('quotations').update({ is_archived: false }).eq('id', quotationId);
  if (error) throw new Error(`Failed to restore quotation: ${error.message}`);
  await writeAudit(supabase, { userId: actingUserId, action: 'quotation.unarchived', entityType: 'quotation', entityId: quotationId });
}

export async function updateQuotationStatus(
  supabase: SupabaseClient,
  quotationId: string,
  newStatus: string,
  actingUserId: string
) {
  const { data: quotation, error: fetchError } = await supabase
    .from('quotations')
    .select('client_id, quotation_number, status')
    .eq('id', quotationId)
    .single();
  if (fetchError || !quotation) throw new Error('Quotation not found.');

  const { error } = await supabase.from('quotations').update({ status: newStatus }).eq('id', quotationId);
  if (error) throw new Error(`Failed to update quotation status: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: quotation.client_id,
    activity_type: 'quotation_status_changed',
    description: `Quotation ${quotation.quotation_number} status changed to ${newStatus.replace(/_/g, ' ')}.`,
    user_id: actingUserId,
    related_quotation_id: quotationId,
  });

  const mappedClientStatus = QUOTATION_TO_CLIENT_STATUS[newStatus];
  if (mappedClientStatus) {
    await setClientStatusByName(supabase, quotation.client_id, mappedClientStatus, actingUserId);
  }

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.status_changed',
    entityType: 'quotation',
    entityId: quotationId,
    metadata: { from: quotation.status, to: newStatus },
  });

  // Keeps pipeline_stage from ever contradicting quotation status — a
  // quotation can't sit at status=confirmed while its pipeline card is
  // still on Follow-up, or status=cancelled while the card reads
  // Proceeding. Only these two statuses have an unambiguous pipeline
  // equivalent; every other status change (sent is handled separately in
  // sendQuotation(), and the rest don't map to a specific stage) leaves the
  // pipeline exactly where the agent last manually put it.
  if (newStatus === 'confirmed') {
    await updateQuotationPipelineStage(supabase, quotationId, 'confirmed', actingUserId);
  } else if (newStatus === 'cancelled') {
    await updateQuotationPipelineStage(supabase, quotationId, 'lost', actingUserId);
  }

  // Returned so the calling Server Action knows which client to revalidate
  // in addition to the quotation itself — the client's status badge (on
  // their profile and in the client list) and the dashboard's KPI counts
  // both change as a result of this call, not just the quotation page.
  return { clientId: quotation.client_id as string };
}
export async function duplicateQuotation(
  supabase: SupabaseClient,
  sourceQuotationId: string,
  actingUserId: string,
  overrides?: { clientId?: string; travelStartDate?: string; travelEndDate?: string }
) {
  const { currentVersion } = await getQuotationById(supabase, sourceQuotationId);
  if (!currentVersion) throw new Error('Source quotation has no version to duplicate.');

  const { itinerary, inclusions, exclusions, costItems, feeItems, guestRates } = await getVersionDetail(supabase, currentVersion.id);
  const pricing = await getPricingForVersion(supabase, currentVersion.id);

  const { quotation: sourceQuotation } = await getQuotationById(supabase, sourceQuotationId);

  const input: QuotationDraftInput = {
    clientId: overrides?.clientId ?? sourceQuotation.client_id,
    packageId: sourceQuotation.package_id ?? '',
    destination: currentVersion.destination,
    travelStartDate: overrides?.travelStartDate ?? currentVersion.travel_start_date,
    travelEndDate: overrides?.travelEndDate ?? currentVersion.travel_end_date,
    validUntil: currentVersion.valid_until ?? defaultValidUntil(),
    numAdults: currentVersion.num_adults,
    numChildren: currentVersion.num_children,
    numSeniors: currentVersion.num_seniors ?? 0,
    numInfants: currentVersion.num_infants ?? 0,
    numPwd: currentVersion.num_pwd ?? 0,
    hotelName: currentVersion.hotel_name ?? '',
    numBedrooms: currentVersion.num_bedrooms,
    guestRates,
    airfareActualRate: pricing?.airfare_actual_rate ?? 0,
    airfareSeniorRate: pricing?.airfare_senior_rate ?? 0,
    airfareChildRate: pricing?.airfare_child_rate ?? 0,
    airfareInfantRate: pricing?.airfare_infant_rate ?? 0,
    airfarePwdRate: pricing?.airfare_pwd_rate ?? 0,
    hotelActualRate: pricing?.hotel_actual_rate ?? 0,
    transferActualRate: pricing?.transfer_actual_rate ?? 0,
    paymentMethod: (pricing?.payment_method as 'credit_card' | 'paypal' | 'none') ?? 'credit_card',
    notes: currentVersion.notes ?? '',
    inclusions: inclusions.map((i) => i.item),
    exclusions: exclusions.map((e) => e.item),
    itinerary: itinerary.map((d) => ({
      dayNumber: d.day_number,
      dayDate: d.day_date ?? '',
      title: d.title,
      description: d.description ?? '',
      activities: d.activities ?? [],
      sourceTourId: d.source_tour_id ?? null,
    })),
    feeItems,
    costItems,
    markup: pricing?.markup ?? 0,
    consultantId: currentVersion.consultant_id ?? '',
  };

  const result = await createDraftQuotation(supabase, input, actingUserId);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'quotation.duplicated',
    entityType: 'quotation',
    entityId: result.quotationId,
    metadata: { sourceQuotationId },
  });

  return result;
}
