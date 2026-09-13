'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { UserCircle, Settings, LogOut, Loader2 } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

/**
 * Separate from ProfileMenu because useFormStatus only reports the
 * status of the nearest enclosing <form> when called from a component
 * nested INSIDE that form — calling it directly in ProfileMenu (which
 * renders the <form> itself, not a descendant of it) would never see
 * "pending". signOut() itself is untouched; this only adds visual
 * feedback (disabled + spinner) while that existing action is in flight.
 */
function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : <LogOut className="h-3.5 w-3.5" />}
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

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
            <SignOutButton />
          </form>
        </div>
      )}
    </div>
  );
}
