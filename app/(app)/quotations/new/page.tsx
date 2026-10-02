import { Topbar } from '@/components/layout/topbar';
import { QuotationWizard } from '@/components/quotations/quotation-wizard';
import { createClient } from '@/lib/supabase/server';
import { listClientSources, listConsultants, getAgencySettings, listActiveHotels } from '@/lib/services/lookups';
import { listActivePackages } from '@/lib/services/packages';
import { listToursForPicker } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireUser();
  const { clientId } = await searchParams;
  const supabase = await createClient();

  // A capped, recency-ordered list keeps this fast even at 10k+ clients; the
  // wizard's search box filters within it. A fully server-searched combobox
  // is a reasonable upgrade once agent feedback asks for it.
  const [{ data: clients }, sources, packages, consultants, tours, agencySettings, hotels] = await Promise.all([
    supabase
      .from('clients')
      // Destination/dates/guest counts are included alongside the existing
      // columns (no extra query — same single select) purely so a brand-new
      // quotation can pre-fill those fields from what was already captured
      // at this client's intake, rather than asking the agent to retype
      // data the CRM already has. See handleSelectClient in
      // quotation-wizard.tsx — it only ever fills an untouched field.
      .select('id, full_name, email, mobile_number, destination, travel_start_date, travel_end_date, num_adults, num_children')
      .is('deleted_at', null)
      .is('merged_into_client_id', null)
      .order('updated_at', { ascending: false })
      .limit(200),
    listClientSources(supabase),
    listActivePackages(supabase),
    listConsultants(supabase),
    listToursForPicker(supabase),
    getAgencySettings(supabase),
    listActiveHotels(supabase),
  ]);

  return (
    <>
      <Topbar title="New quotation" showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <QuotationWizard
          clients={clients ?? []}
          packages={packages}
          sources={sources}
          consultants={consultants}
          tours={tours}
          hotels={hotels}
          feePercentages={{
            creditCard: agencySettings?.credit_card_fee_pct ?? 0.029,
            paypal: agencySettings?.paypal_fee_pct ?? 0.039,
          }}
          defaultTransferMarkupPct={agencySettings?.default_transfer_markup_pct ?? 0.10}
          initialClientId={clientId}
        />
      </main>
    </>
  );
}
