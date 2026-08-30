'use client';

import { useTransition, useState } from 'react';
import { updateUserAction } from '@/app/(app)/admin/users/actions';

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  manager_id: string | null;
  is_active: boolean;
};

export function UserRowEditor({
  user,
  managers,
  isSelf,
}: {
  user: UserRow;
  managers: { id: string; full_name: string }[];
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // React 18.3 doesn't support passing a function to <form action> (that's
    // a React 19 feature) — same class of issue as the useActionState fix in
    // client-form.tsx. Plain onSubmit + FormData is the compatible approach.
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateUserAction(user.id, formData);
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
    });
  }

  return (
    <tr className="border-b border-sand-100 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-ink-900">{user.full_name}</p>
        <p className="text-xs text-ink-500">{user.email}</p>
      </td>
      <td colSpan={3} className="px-4 py-2">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <select
            name="role"
            defaultValue={user.role}
            disabled={isSelf}
            className="rounded-md border border-sand-200 px-2 py-1.5 text-sm capitalize disabled:opacity-50"
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="agent">Agent</option>
          </select>
          <select
            name="managerId"
            defaultValue={user.manager_id ?? ''}
            disabled={isSelf}
            className="rounded-md border border-sand-200 px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">No manager</option>
            {managers
              .filter((m) => m.id !== user.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  Reports to {m.full_name}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-ink-700">
            <input type="checkbox" name="isActive" defaultChecked={user.is_active} disabled={isSelf} />
            Active
          </label>
          <button
            type="submit"
            disabled={isPending || isSelf}
            className="rounded-md border border-sand-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          {isSelf && <span className="text-xs text-ink-500">Ask another admin to change your own account</span>}
          {error && <span className="text-xs text-coral-600">{error}</span>}
        </form>
      </td>
    </tr>
  );
}
