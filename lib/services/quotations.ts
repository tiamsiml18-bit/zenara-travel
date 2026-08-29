import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuotationDraftInput } from '@/lib/validation/quotation';
import { writeAudit } from './audit';
import { setClientStatusByName } from './clients';
import { generateFollowUpSchedule } from './followups';

const VERSION_SELECT = `
  id, version_number, version_label, status, client_name_snapshot, destination,
  travel_start_date, travel_end_date, num_adults, num_children, hotel_name,
  num_bedrooms, price_per_person, total_price, currency, notes, sent_at, created_at,
  consultant_id, consultant_name_snapshot,
  num_seniors, num_infants, price_per_senior, price_per_adult, price_per_child, price_per_infant
`;

export interface QuotationListFilters {
  status?: string;
  agentId?: string;
  destination?: string;
  page?: number;
  pageSize?: number;
}

export async function listQuotations(supabase: SupabaseClient, filters: QuotationListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('quotations')
    .select(
      `id, quotation_number, status, created_at, updated_at,
       client:clients ( id, full_name ),
       agent:users!quotations_assigned_agent_id_fkey ( id, full_name ),
       current_version:quotation_versions!quotations_current_version_id_fkey (
         destination, travel_start_date, travel_end_date, num_adults, num_children, total_price
       )`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);

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
  const [{ data: itinerary }, { data: inclusions }, { data: exclusions }, { data: costItems }, { data: feeItems }] =
    await Promise.all([
      supabase
        .from('quotation_itinerary_days')
        .select('id, day_number, day_date, title, description, activities')
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
    ]);
  return {
    itinerary: itinerary ?? [],
    inclusions: inclusions ?? [],
    exclusions: exclusions ?? [],
    costItems: (costItems ?? []).map((c) => ({ label: c.label, amount: Number(c.unit_price) })),
    feeItems: (feeItems ?? []).map((f) => ({ label: f.label, amount: Number(f.amount) })),
  };
}

/** Only returns data for admin/manager/owning-agent — enforced by RLS, this just isolates the query. */
export async function getPricingForVersion(supabase: SupabaseClient, versionId: string) {
  const { data } = await supabase
    .from('quotation_pricing_internal')
    .select('supplier_cost, markup, selling_price, profit, profit_margin_pct')
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
async function resolveConsultantName(supabase: SupabaseClient, consultantId?: string | null): Promise<string | null> {
  if (!consultantId) return null;
  const { data } = await supabase.from('agency_consultants').select('full_name').eq('id', consultantId).single();
  return data?.full_name ?? null;
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

  const supplierCost = input.costItems.reduce((sum, item) => sum + item.amount, 0);

  const { error: pricingError } = await supabase.from('quotation_pricing_internal').insert({
    quotation_version_id: versionId,
    supplier_cost: supplierCost,
    markup: input.markup,
    selling_price: input.totalPrice,
  });
  if (pricingError) throw new Error(`Failed to save pricing: ${pricingError.message}`);
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
        num_adults: input.numAdults,
        num_children: input.numChildren,
        num_seniors: input.numSeniors,
        num_infants: input.numInfants,
        hotel_name: input.hotelName || null,
        num_bedrooms: input.numBedrooms ?? null,
        price_per_person: input.pricePerPerson ?? null,
        total_price: input.totalPrice,
        price_per_senior: input.pricePerSenior ?? null,
        price_per_adult: input.pricePerAdult ?? null,
        price_per_child: input.pricePerChild ?? null,
        price_per_infant: input.pricePerInfant ?? null,
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
    .update({ status: 'sent' })
    .eq('id', quotationId);
  if (qError) throw new Error(`Failed to update quotation status: ${qError.message}`);

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

  await generateFollowUpSchedule(supabase, {
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
      num_adults: input.numAdults,
      num_children: input.numChildren,
      num_seniors: input.numSeniors,
      num_infants: input.numInfants,
      hotel_name: input.hotelName || null,
      num_bedrooms: input.numBedrooms ?? null,
      price_per_person: input.pricePerPerson ?? null,
      total_price: input.totalPrice,
      price_per_senior: input.pricePerSenior ?? null,
      price_per_adult: input.pricePerAdult ?? null,
      price_per_child: input.pricePerChild ?? null,
      price_per_infant: input.pricePerInfant ?? null,
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

  const { itinerary, inclusions, exclusions, costItems, feeItems } = await getVersionDetail(supabase, currentVersion.id);
  const pricing = await getPricingForVersion(supabase, currentVersion.id);

  const { quotation: sourceQuotation } = await getQuotationById(supabase, sourceQuotationId);

  const input: QuotationDraftInput = {
    clientId: overrides?.clientId ?? sourceQuotation.client_id,
    packageId: sourceQuotation.package_id ?? '',
    destination: currentVersion.destination,
    travelStartDate: overrides?.travelStartDate ?? currentVersion.travel_start_date,
    travelEndDate: overrides?.travelEndDate ?? currentVersion.travel_end_date,
    numAdults: currentVersion.num_adults,
    numChildren: currentVersion.num_children,
    numSeniors: currentVersion.num_seniors ?? 0,
    numInfants: currentVersion.num_infants ?? 0,
    hotelName: currentVersion.hotel_name ?? '',
    numBedrooms: currentVersion.num_bedrooms,
    pricePerPerson: currentVersion.price_per_person,
    totalPrice: currentVersion.total_price,
    pricePerSenior: currentVersion.price_per_senior,
    pricePerAdult: currentVersion.price_per_adult,
    pricePerChild: currentVersion.price_per_child,
    pricePerInfant: currentVersion.price_per_infant,
    notes: currentVersion.notes ?? '',
    inclusions: inclusions.map((i) => i.item),
    exclusions: exclusions.map((e) => e.item),
    itinerary: itinerary.map((d) => ({
      dayNumber: d.day_number,
      dayDate: d.day_date ?? '',
      title: d.title,
      description: d.description ?? '',
      activities: d.activities ?? [],
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
