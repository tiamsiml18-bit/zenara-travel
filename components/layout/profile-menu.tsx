'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { UserCircle, Settings, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

export function ProfileMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
        title="Account"
      >
        <UserCircle className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-sand-200 bg-surface py-1.5 shadow-lg">
          {isAdmin && (
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-700 hover:bg-sand-50"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-sand-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
