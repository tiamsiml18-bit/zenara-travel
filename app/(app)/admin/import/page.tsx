import { Topbar } from '@/components/layout/topbar';
import { ImportWizard } from '@/components/admin/import/import-wizard';
import { createClient } from '@/lib/supabase/server';
import { listClientStatuses, listClientSources, listAgents } from '@/lib/services/lookups';
import { requireRole } from '@/lib/auth/session';

export default async function ImportClientsPage() {
  await requireRole('admin');
  const supabase = await createClient();

  const [statuses, sources, agents] = await Promise.all([
    listClientStatuses(supabase),
    listClientSources(supabase),
    listAgents(supabase),
  ]);

  return (
    <>
      <Topbar title="Import clients" />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 max-w-4xl text-sm text-ink-500">
          Upload a spreadsheet of existing clients to bring them into Zenara. Nothing is saved until you review the
          mapping and confirm on the final screen — you can back out at any point before that.
        </p>
        <ImportWizard statuses={statuses} sources={sources} agents={agents} />
      </main>
    </>
  );
}
