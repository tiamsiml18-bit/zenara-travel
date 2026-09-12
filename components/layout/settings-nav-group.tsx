'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Settings, UserCog, UploadCloud, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { NavLink } from './nav-link';

const CHILD_ROUTES = ['/admin/settings', '/admin/users', '/admin/import', '/settings/privacy-security'];

/**
 * Single collapsible "Settings" parent item in the sidebar — not a
 * standalone NavLink itself (it has no href of its own), just a
 * toggle button that reveals/hides its four children on click. Auto-
 * expands when the current route is inside one of those children, so
 * navigating to e.g. Privacy & Security directly (a bookmark, a link
 * from an email, etc.) doesn't leave the group looking collapsed while
 * its own page is the active one.
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
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const isOpen = isInsideGroup || manuallyOpen;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManuallyOpen((open) => !open)}
        aria-expanded={isOpen}
        className={clsx(
          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isInsideGroup ? 'text-harbor-600' : 'text-ink-700 hover:bg-sand-100 hover:text-ink-900'
        )}
      >
        <span className="flex items-center gap-2.5">
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Settings
        </span>
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} strokeWidth={1.75} />
      </button>

      {isOpen && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          {isAdmin && (
            <>
              <NavLink href="/admin/settings" label="General" icon={<Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
              <NavLink href="/admin/users" label="Users" icon={<UserCog className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
              <NavLink href="/admin/import" label="Import clients" icon={<UploadCloud className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
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
