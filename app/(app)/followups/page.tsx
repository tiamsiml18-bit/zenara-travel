import Link from 'next/link';
import { clsx } from 'clsx';
import { Topbar } from '@/components/layout/topbar';
import { FollowUpCard } from '@/components/followups/followup-card';
import { AgentFilterSelect } from '@/components/followups/agent-filter-select';
import { createClient } from '@/lib/supabase/server';
import { listFollowUps, getFollowUpCounts } from '@/lib/services/followups';
import { listAgents } from '@/lib/services/lookups';
import { requireUser } from '@/lib/auth/session';

const TABS = [
  { key: 'due_today', label: 'Due Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
] as const;

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; agent?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const bucket = (TABS.find((t) => t.key === params.tab)?.key ?? 'due_today') as (typeof TABS)[number]['key'];

  const supabase = await createClient();
  const [followUps, counts, agents] = await Promise.all([
    listFollowUps(supabase, { bucket, agentId: params.agent }),
    getFollowUpCounts(supabase, params.agent),
    user.role === 'admin' || user.role === 'manager' ? listAgents(supabase) : Promise.resolve([]),
  ]);

  const countFor = (key: (typeof TABS)[number]['key']) =>
    key === 'due_today' ? counts.dueToday : key === 'overdue' ? counts.overdue : key === 'upcoming' ? counts.upcoming : counts.completed;

  return (
    <>
      <Topbar title="Follow-ups" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs — horizontally scrollable on mobile, this is the page agents check from their phones */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={`/followups?tab=${tab.key}${params.agent ? `&agent=${params.agent}` : ''}`}
                className={clsx(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium',
                  bucket === tab.key ? 'bg-harbor-700 text-sand-50' : 'bg-white text-ink-700 hover:bg-sand-100'
                )}
              >
                {tab.label}
                <span
                  className={clsx(
                    'font-ticket rounded-full px-1.5 py-0.5 text-[11px] leading-none',
                    bucket === tab.key ? 'bg-sand-50/20' : 'bg-sand-100 text-ink-500'
                  )}
                >
                  {countFor(tab.key)}
                </span>
              </Link>
            ))}
          </div>

          {agents.length > 0 && (
            <form action="/followups" className="flex gap-2">
              <input type="hidden" name="tab" value={bucket} />
              <AgentFilterSelect agents={agents} defaultValue={params.agent ?? ''} />
            </form>
          )}
        </div>

        <div className="space-y-2.5">
          {followUps.map((f) => (
            // @ts-expect-error — Supabase's inferred join shape matches FollowUpCardData at runtime;
            // full typing arrives once generated types replace the placeholder Database type.
            <FollowUpCard key={f.id} followUp={f} />
          ))}
          {followUps.length === 0 && (
            <div className="rounded-lg border border-dashed border-sand-200 bg-white p-10 text-center text-sm text-ink-500">
              Nothing here right now.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
