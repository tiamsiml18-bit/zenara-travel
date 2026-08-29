import { Topbar } from '@/components/layout/topbar';
import { ClientForm } from '@/components/clients/client-form';
import { createClient } from '@/lib/supabase/server';
import { getClientById } from '@/lib/services/clients';
import { listClientSources, listClientStatuses, listAgents } from '@/lib/services/lookups';
import { updateClientAction } from '../../actions';
import { requireUser } from '@/lib/auth/session';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [client, sources, statuses, agents] = await Promise.all([
    getClientById(supabase, id),
    listClientSources(supabase),
    listClientStatuses(supabase),
    listAgents(supabase),
  ]);

  const boundAction = updateClientAction.bind(null, id);

  return (
    <>
      <Topbar title={`Edit ${client.full_name}`} />
      <main className="flex-1 overflow-y-auto p-6">
        <ClientForm
          action={boundAction}
          sources={sources}
          statuses={statuses}
          agents={agents}
          submitLabel="Save changes"
          defaultValues={{
            fullName: client.full_name,
            mobileNumber: client.mobile_number ?? '',
            email: client.email ?? '',
            messengerHandle: client.messenger_handle ?? '',
            instagramHandle: client.instagram_handle ?? '',
            whatsappNumber: client.whatsapp_number ?? '',
            sourceId: client.source_id ?? '',
            destination: client.destination ?? '',
            travelStartDate: client.travel_start_date ?? '',
            travelEndDate: client.travel_end_date ?? '',
            numAdults: client.num_adults,
            numChildren: client.num_children,
            quotedPrice: client.quoted_price,
            statusId: client.status_id ?? '',
            assignedAgentId: client.assigned_agent_id ?? '',
            notes: client.notes ?? '',
          }}
        />
      </main>
    </>
  );
}
