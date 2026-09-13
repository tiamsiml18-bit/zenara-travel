'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Generic collapsible sidebar group — the same toggle/auto-expand pattern
 * already used and proven in settings-nav-group.tsx, extracted here so
 * PIPELINE/CATALOG/FINANCE can reuse it without duplicating that logic
 * three times. SettingsNavGroup itself is untouched; it already works
 * correctly and has its own admin-conditional children, so there's no
 * need to migrate it onto this shared component right now.
 *
 * Collapsed by default, expands on click, and auto-expands whenever
 * navigation lands on a route inside `childRoutes` — so navigating
 * directly to e.g. /bookings (a bookmark, a link from elsewhere) never
 * leaves its parent group looking collapsed while one of its own pages
 * is the active route.
 *
 * `open` is a single piece of state kept in sync with the active route
 * via the effect below, rather than being derived as
 * `isInsideGroup || manuallyOpen` on every render. That OR-derived
 * version could never become false while still on an active route,
 * since `isInsideGroup` alone would keep re-forcing it true — so
 * clicking the arrow to collapse a currently-active group silently did
 * nothing until navigating elsewhere. Here, the click handler sets
 * `open` directly, and the effect only re-asserts `open = true` when
 * the route actually changes to one inside this group — not on every
 * render — so an explicit collapse click while already on that route
 * takes effect immediately.
 */
export function CollapsibleNavGroup({
  label,
  icon,
  childRoutes,
  children,
}: {
  label: string;
  icon: ReactNode;
  childRoutes: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isInsideGroup = childRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [open, setOpen] = useState(isInsideGroup);

  useEffect(() => {
    if (isInsideGroup) setOpen(true);
    // Intentionally omitted from deps: re-running this on every render
    // (rather than only when the route changes) would re-force `open`
    // to true right after a collapse click while still on an active
    // route — the exact bug this fix addresses.
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
          {icon}
          {label}
        </span>
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} strokeWidth={1.75} />
      </button>

      {open && <div className="mt-1 flex flex-col gap-1 pl-4">{children}</div>}
    </div>
  );
}
