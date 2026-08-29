import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Pagination } from '@/components/ui/pagination';
import { createClient } from '@/lib/supabase/server';
import { listPackages } from '@/lib/services/packages';
import { requireUser } from '@/lib/auth/session';
import { ToggleActiveButton } from '@/components/packages/toggle-active-button';

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  const { packages, total, page, pageSize } = await listPackages(supabase, {
    search: params.q,
    includeInactive: params.all === '1',
    page: params.page ? Number(params.page) : 1,
  });

  const canManage = user.role === 'admin' || user.role === 'manager';

  return (
    <>
      <Topbar title="Packages" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <form className="flex flex-1 gap-2" action="/packages">
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name or destination…"
              className="w-72 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
            />
            <label className="flex items-center gap-1.5 text-sm text-ink-700">
              <input type="checkbox" name="all" value="1" defaultChecked={params.all === '1'} />
              Show inactive
            </label>
            <button type="submit" className="rounded-md border border-sand-200 px-3 py-2 text-sm hover:bg-sand-100">
              Filter
            </button>
          </form>

          {canManage && (
            <Link
              href="/packages/new"
              className="flex items-center gap-1.5 rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600"
            >
              <Plus className="h-4 w-4" /> New package
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/packages/${p.id}`} className="font-medium text-ink-900 hover:text-harbor-600">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{p.destination}</td>
                  <td className="font-ticket px-4 py-3 text-ink-700">
                    {p.num_days}D{p.num_nights}N
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.is_active
                          ? 'rounded-full bg-harbor-100 px-2 py-0.5 text-xs font-medium text-harbor-700'
                          : 'rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-ink-500'
                      }
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && <ToggleActiveButton packageId={p.id} isActive={p.is_active} />}
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                    No packages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination total={total} page={page} pageSize={pageSize} basePath="/packages" searchParams={{ q: params.q, all: params.all }} />
      </main>
    </>
  );
}
