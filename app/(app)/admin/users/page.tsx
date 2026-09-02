import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { listAllUsers } from '@/lib/services/users';
import { requireRole, requireUser } from '@/lib/auth/session';
import { UserRowEditor } from '@/components/admin/user-row';

export default async function AdminUsersPage() {
  await requireRole('admin');
  const currentUser = await requireUser();
  const supabase = await createClient();
  const users = await listAllUsers(supabase);

  const managers = users.filter((u) => u.role === 'admin' || u.role === 'manager');

  return (
    <>
      <Topbar title="Users" />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-ink-500">
          Role changes take effect immediately — Row Level Security in the database, not this screen, is what
          actually enforces access, so a role change here changes what a person can query the moment they refresh.
          New teammates are provisioned in Supabase Auth first (see README), then appear here to have their role and
          manager assigned.
        </p>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3" colSpan={3}>
                  Role &middot; Manager &middot; Status
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRowEditor
                  key={u.id}
                  user={u}
                  managers={managers}
                  isSelf={u.id === currentUser.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
