import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { getAgencySettings } from '@/lib/services/lookups';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Every authenticated route lives under this layout. requireUser() redirects
  // to /login if there's no session — nothing below this line renders for an
  // unauthenticated request, and every list/detail page still applies its own
  // RLS-scoped queries on top of this.
  const user = await requireUser();

  // Sidebar badge count. RLS already scopes this to "my/my team's" follow-ups
  // for agents/managers and to everything for admins, so no extra role
  // branching is needed here — the query is identical for every role.
  const supabase = await createClient();
  const [{ count: followUpsDueCount }, agencySettings] = await Promise.all([
    supabase.from('follow_ups').select('id', { count: 'exact', head: true }).in('status', ['due', 'overdue']),
    getAgencySettings(supabase),
  ]);

  return (
    <div className="flex h-screen bg-sand-50">
      <Sidebar user={user} followUpsDueCount={followUpsDueCount ?? 0} logoUrl={agencySettings.logo_url} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
