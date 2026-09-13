'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Settings, SlidersHorizontal, UserRoundCog, CloudUpload, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { NavLink } from './nav-link';

const CHILD_ROUTES = ['/admin/settings', '/admin/users', '/admin/import', '/settings/privacy-security'];

/**
 * Single collapsible "Settings" parent item in the sidebar — not a
 * standalone NavLink itself (it has no href of its own), just a
 * toggle button that reveals/hides its four children on click. Auto-
 * expands when navigation lands on one of those children, so arriving
 * at e.g. Privacy & Security directly (a bookmark, a link from an
 * email, etc.) doesn't leave the group looking collapsed while its own
 * page is the active one.
 *
 * `open` is kept in sync with the active route via the effect below
 * rather than derived as `isInsideGroup || manuallyOpen` on every
 * render — that version could never become false while already on an
 * active route (isInsideGroup alone kept re-forcing it true), so
 * clicking the arrow to collapse did nothing until navigating
 * elsewhere. Here the click handler sets `open` directly, and the
 * effect only re-asserts `open = true` when the route changes to one
 * inside this group — not on every render — so a collapse click while
 * already on that route takes effect immediately.
 *
 * General/Users/Import clients keep their existing routes and
 * requireRole('admin') gating untouched — this component only changes
 * what's shown in the sidebar, not access control (isAdmin is computed
 * server-side in Sidebar from the real user role and passed in as a
 * plain boolean prop, same as before). Privacy & Security always
 * renders, since every authenticated user needs to reach it, not just
 * admins.
 */
export function SettingsNavGroup({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isInsideGroup = CHILD_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [open, setOpen] = useState(isInsideGroup);

  useEffect(() => {
    if (isInsideGroup) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isInsideGroup ? 'text-harbor-600' : 'text-ink-700 hover:bg-sand-100 hover:text-ink-900'
        )}
      >
        <span className="flex items-center gap-2.5">
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Settings
        </span>
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          {isAdmin && (
            <>
              <NavLink href="/admin/settings" label="General" icon={<SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
              <NavLink href="/admin/users" label="Users" icon={<UserRoundCog className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
              <NavLink href="/admin/import" label="Import clients" icon={<CloudUpload className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
            </>
          )}
          <NavLink
            href="/settings/privacy-security"
            label="Privacy & Security"
            icon={<ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          />
        </div>
      )}
    </div>
  );
}
