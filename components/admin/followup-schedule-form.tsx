'use client';

import { useState, useTransition } from 'react';
import { updateFollowUpScheduleAction } from '@/app/(app)/admin/settings/actions';

export function FollowUpScheduleForm({ settingsId, currentDays }: { settingsId: string | null; currentDays: number[] }) {
  const [value, setValue] = useState(currentDays.join(', '));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSubmit() {
    setMessage(null);
    const formData = new FormData();
    formData.set('followupScheduleDays', value);
    startTransition(async () => {
      const result = await updateFollowUpScheduleAction(settingsId, formData);
      setMessage(result.ok ? { type: 'success', text: 'Schedule saved.' } : { type: 'error', text: result.error });
    });
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink-700">Follow-up schedule (days)</p>
      <p className="mb-3 text-xs text-ink-500">
        Comma-separated gaps between consecutive follow-ups — the first number is days after a quotation is sent,
        each number after that is days after the previous follow-up is completed. The count of numbers is the count
        of follow-ups in the sequence (three numbers = three follow-ups).
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="2, 3, 5"
          className="flex-1 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'error' ? 'text-coral-600' : 'text-harbor-600'}`}>{message.text}</p>
      )}
    </div>
  );
}
