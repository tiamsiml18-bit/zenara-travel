import { Topbar } from '@/components/layout/topbar';
import { QuotationWizard } from '@/components/quotations/quotation-wizard';
import { createClient } from '@/lib/supabase/server';
import { listClientSources, listConsultants } from '@/lib/services/lookups';
import { listActivePackages } from '@/lib/services/packages';
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
  const [{ data: clients }, sources, packages, consultants] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, email, mobile_number')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200),
    listClientSources(supabase),
    listActivePackages(supabase),
    listConsultants(supabase),
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
          initialClientId={clientId}
        />
      </main>
    </>
  );
}
