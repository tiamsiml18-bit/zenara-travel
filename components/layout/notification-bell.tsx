'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

export interface NotificationFollowUp {
  id: string;
  due_date: string;
  clientName: string;
  destination: string;
  quotationId: string | null;
  sequenceNumber: number;
  isOverdue: boolean;
}

export function NotificationBell({ followUps }: { followUps: NotificationFollowUp[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const overdue = followUps.filter((f) => f.isOverdue);
  const today = followUps.filter((f) => !f.isOverdue);
  const count = followUps.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
        title="Follow-ups needing attention"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-sand-200 bg-surface py-2 shadow-lg">
          {count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">Nothing needs attention right now.</p>
          ) : (
            <>
              {overdue.length > 0 && (
                <NotificationGroup title="Overdue" items={overdue} onNavigate={() => setOpen(false)} tone="danger" />
              )}
              {today.length > 0 && (
                <NotificationGroup title="Today" items={today} onNavigate={() => setOpen(false)} tone="neutral" />
              )}
            </>
          )}
          <div className="mt-1 border-t border-sand-100 px-4 pt-2">
            <Link href="/followups" onClick={() => setOpen(false)} className="text-xs font-medium text-harbor-600 hover:underline">
              View all follow-ups
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationGroup({
  title,
  items,
  onNavigate,
  tone,
}: {
  title: string;
  items: NotificationFollowUp[];
  onNavigate: () => void;
  tone: 'danger' | 'neutral';
}) {
  return (
    <div className="px-2 py-1">
      <p className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone === 'danger' ? 'text-coral-600' : 'text-ink-500'}`}>
        {title}
      </p>
      {items.map((f) => (
        <Link
          key={f.id}
          href={f.quotationId ? `/quotations/${f.quotationId}` : '/followups'}
          onClick={onNavigate}
          className="block rounded-md px-2 py-1.5 hover:bg-sand-50"
        >
          <p className="text-sm font-medium text-ink-900">{f.clientName}</p>
          <p className="text-xs text-ink-500">
            {f.destination} · Follow-up #{f.sequenceNumber}
          </p>
        </Link>
      ))}
    </div>
  );
}
