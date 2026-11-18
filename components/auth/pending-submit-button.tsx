'use client';

import { useFormStatus } from 'react-dom';

export function PendingSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-harbor-700 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
