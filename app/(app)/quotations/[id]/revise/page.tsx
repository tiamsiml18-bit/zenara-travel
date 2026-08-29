import { redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/topbar';
import { QuotationWizard } from '@/components/quotations/quotation-wizard';
import { createClient } from '@/lib/supabase/server';
import { getQuotationById, getVersionDetail, getPricingForVersion } from '@/lib/services/quotations';
import { listActivePackages } from '@/lib/services/packages';
import { listClientSources, listConsultants } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

export default async function ReviseQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { quotation, versions, currentVersion } = await getQuotationById(supabase, id);
  if (!currentVersion) throw new Error('This quotation has no version to revise.');

  // A version that's still a draft is edited in place via the quotation
  // detail page, not through the revision flow — revising only makes sense
  // once a version has been sent and is therefore locked by the DB trigger.
  if (currentVersion.status === 'draft') {
    redirect(`/quotations/${id}`);
  }

  const [{ itinerary, inclusions, exclusions, costItems, feeItems }, pricing, packages, sources, consultants] = await Promise.all([
    getVersionDetail(supabase, currentVersion.id),
    getPricingForVersion(supabase, currentVersion.id),
    listActivePackages(supabase),
    listClientSources(supabase),
    listConsultants(supabase),
  ]);

  return (
    <>
      <Topbar title={`Revise ${quotation.quotation_number}`} />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-3xl text-sm text-ink-500">
          {currentVersion.version_label} has already been sent and can no longer be edited. Saving here creates a
          new revision — the original stays exactly as the client received it.
        </p>
        <QuotationWizard
          mode="revise"
          quotationId={id}
          nextVersionLabel={`Rev ${(versions?.length ?? 1) + 1}`}
          packages={packages}
          sources={sources}
          consultants={consultants}
          clients={[]}
          initialData={{
            clientId: quotation.client_id,
            clientLabel: quotation.client?.full_name ?? '',
            destination: currentVersion.destination,
            travelStartDate: currentVersion.travel_start_date,
            travelEndDate: currentVersion.travel_end_date,
            numAdults: currentVersion.num_adults,
            numChildren: currentVersion.num_children,
            numSeniors: currentVersion.num_seniors ?? 0,
            numInfants: currentVersion.num_infants ?? 0,
            hotelName: currentVersion.hotel_name ?? '',
            numBedrooms: currentVersion.num_bedrooms ?? 1,
            pricePerPerson: currentVersion.price_per_person,
            totalPrice: currentVersion.total_price,
            pricePerSenior: currentVersion.price_per_senior,
            pricePerAdult: currentVersion.price_per_adult,
            pricePerChild: currentVersion.price_per_child,
            pricePerInfant: currentVersion.price_per_infant,
            notes: currentVersion.notes ?? '',
            itinerary: itinerary.map((d) => ({
              dayNumber: d.day_number,
              dayDate: d.day_date ?? '',
              title: d.title,
              description: d.description ?? '',
              activities: d.activities ?? [],
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
