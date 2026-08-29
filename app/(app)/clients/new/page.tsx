import { Topbar } from '@/components/layout/topbar';
import { ClientForm } from '@/components/clients/client-form';
import { createClient } from '@/lib/supabase/server';
import { listClientSources, listClientStatuses, listAgents } from '@/lib/services/lookups';
import { createClientAction } from '../actions';
import { requireUser } from '@/lib/auth/session';

export default async function NewClientPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [sources, statuses, agents] = await Promise.all([
    listClientSources(supabase),
    listClientStatuses(supabase),
    listAgents(supabase),
  ]);

  const newLeadStatus = statuses.find((s) => s.name === 'New Lead');

  return (
    <>
      <Topbar title="New client" />
      <main className="flex-1 overflow-y-auto p-6">
        <ClientForm
          action={createClientAction}
          sources={sources}
          statuses={statuses}
          agents={agents}
          defaultValues={{ statusId: newLeadStatus?.id, assignedAgentId: user.id, numAdults: 1, numChildren: 0 }}
          submitLabel="Create client"
        />
      </main>
    </>
  );
}
