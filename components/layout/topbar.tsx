import { Search } from 'lucide-react';
import { BackButton } from './back-button';
import { NotificationBell, type NotificationFollowUp } from './notification-bell';
import { ProfileMenu } from './profile-menu';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listAttentionNeededFollowUps } from '@/lib/services/followups';

export async function Topbar({ title, showBack = false }: { title: string; showBack?: boolean }) {
  const user = await requireUser();
  const supabase = await createClient();

  // Every page renders Topbar, so this fetch happens on every navigation —
  // acceptable here since it's a single small, indexed query, and it's what
  // keeps the badge count accurate without a separate polling mechanism.
  const rawFollowUps = await listAttentionNeededFollowUps(supabase);
  const today = new Date().toISOString().slice(0, 10);
  const followUps: NotificationFollowUp[] = rawFollowUps.map((f: any) => ({
    id: f.id,
    due_date: f.due_date,
    clientName: f.client?.full_name ?? 'Unknown client',
    destination: f.quotation?.current_version?.destination ?? '—',
    quotationId: f.quotation?.id ?? null,
    sequenceNumber: f.sequence_number ?? 1,
    isOverdue: f.due_date < today,
  }));

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-sand-200 bg-white px-6">
      <div className="flex items-center gap-2">
        {showBack && <BackButton />}
        <h1 className="font-display text-lg font-semibold text-ink-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <form action="/search" className="relative hidden sm:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
            strokeWidth={1.75}
          />
          <input
            name="q"
            type="search"
            placeholder="Search clients, quotations, agents…"
            className="w-72 rounded-md border border-sand-200 bg-sand-50 py-1.5 pl-8 pr-3 text-sm text-ink-900 outline-none ring-harbor-400 placeholder:text-ink-500/60 focus:ring-2"
          />
        </form>

        <NotificationBell followUps={followUps} />
        <ProfileMenu isAdmin={user.role === 'admin'} />
      </div>
    </header>
  );
}
