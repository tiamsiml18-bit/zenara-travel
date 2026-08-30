import { redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/topbar';
import { QuotationWizard } from '@/components/quotations/quotation-wizard';
import { createClient } from '@/lib/supabase/server';
import { getQuotationById, getVersionDetail, getPricingForVersion } from '@/lib/services/quotations';
import { listActivePackages } from '@/lib/services/packages';
import { listClientSources, listConsultants, getAgencySettings } from '@/lib/services/lookups';
import { listToursForPicker } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { quotation, currentVersion } = await getQuotationById(supabase, id);
  if (!currentVersion) throw new Error('This quotation has no version to edit.');

  // Editing directly only makes sense while nothing has been sent yet — the
  // moment a version is sent, the DB trigger locks its child tables and
  // "Edit" instead creates a revision (see /quotations/[id]/revise).
  if (currentVersion.status !== 'draft') {
    redirect(`/quotations/${id}/revise`);
  }

  const [
    { data: recentClients },
    { data: currentClient },
    { itinerary, inclusions, exclusions, costItems, feeItems, guestRates },
    pricing,
    packages,
    sources,
    consultants,
    tours,
    agencySettings,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email, mobile_number')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase.from('clients').select('id, full_name, email, mobile_number').eq('id', quotation.client_id).single(),
    getVersionDetail(supabase, currentVersion.id),
    getPricingForVersion(supabase, currentVersion.id),
    listActivePackages(supabase),
    listClientSources(supabase),
    listConsultants(supabase),
    listToursForPicker(supabase),
    getAgencySettings(supabase),
  ]);

  // The current client is guaranteed to appear in the picker even if
  // they're not among the 200 most-recently-updated (e.g. an older lead) —
  // deduplicated since they may well already be in that list too.
  const clients = currentClient
    ? [currentClient, ...(recentClients ?? []).filter((c) => c.id !== currentClient.id)]
    : recentClients ?? [];

  return (
    <>
      <Topbar title={`Edit ${quotation.quotation_number}`} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <QuotationWizard
          mode="edit"
          quotationId={id}
          clients={clients}
          packages={packages}
          sources={sources}
          consultants={consultants}
          tours={tours}
          feePercentages={{
            creditCard: agencySettings?.credit_card_fee_pct ?? 0.029,
            paypal: agencySettings?.paypal_fee_pct ?? 0.039,
          }}
          initialData={{
            clientId: quotation.client_id,
            clientLabel: quotation.client?.full_name ?? '',
            destination: currentVersion.destination,
            travelStartDate: currentVersion.travel_start_date,
            travelEndDate: currentVersion.travel_end_date,
            validUntil: currentVersion.valid_until ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            numAdults: currentVersion.num_adults,
            numChildren: currentVersion.num_children,
            numSeniors: currentVersion.num_seniors ?? 0,
            numInfants: currentVersion.num_infants ?? 0,
            numPwd: currentVersion.num_pwd ?? 0,
            hotelName: currentVersion.hotel_name ?? '',
            numBedrooms: currentVersion.num_bedrooms ?? 1,
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
            itinerary: itinerary.map((d) => ({
              dayNumber: d.day_number,
              dayDate: d.day_date ?? '',
              title: d.title,
              description: d.description ?? '',
              activities: d.activities ?? [],
              sourceTourId: d.source_tour_id ?? null,
            })),
            inclusions: inclusions.map((i) => i.item),
            exclusions: exclusions.map((e) => e.item),
            costItems,
            feeItems,
            supplierCost: pricing?.supplier_cost ?? 0,
            markup: pricing?.markup ?? 0,
            consultantId: currentVersion.consultant_id ?? '',
          }}
        />
      </main>
    </>
  );
}
