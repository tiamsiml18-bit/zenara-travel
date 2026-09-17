'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { SidebarTooltip } from './sidebar-tooltip';

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
 *
 * `sidebarCollapsed` is a separate concern from `open` above — it's the
 * whole sidebar's own icon-only rail state (see sidebar.tsx), not this
 * group's. When true, this group's header shows its icon only (with a
 * hover tooltip) and its children lose their pl-4 indent, but `open`'s
 * own logic is untouched — an already-open group's children still
 * render, just as icon-only NavLinks, so every route stays reachable.
 */
export function CollapsibleNavGroup({
  label,
  icon,
  childRoutes,
  children,
  sidebarCollapsed = false,
}: {
  label: string;
  icon: ReactNode;
  childRoutes: string[];
  children: ReactNode;
  sidebarCollapsed?: boolean;
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

  const header = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-label={sidebarCollapsed ? label : undefined}
      className={clsx(
        'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
        sidebarCollapsed ? 'justify-center' : 'justify-between',
        isInsideGroup ? 'text-sidebar-active-text' : 'text-sidebar-text hover:bg-sidebar-hover'
      )}
    >
      <span className={clsx('flex items-center', !sidebarCollapsed && 'gap-2.5')}>
        {icon}
        {!sidebarCollapsed && label}
      </span>
      {!sidebarCollapsed && (
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} strokeWidth={1.75} />
      )}
    </button>
  );

  return (
    <div>
      {sidebarCollapsed ? <SidebarTooltip label={label}>{header}</SidebarTooltip> : header}

      {/* Sidebar-collapsed children still render (as icon-only NavLinks —
          each receives its own `collapsed` prop directly from
          sidebar.tsx, same as every other nav item) rather than being
          hidden outright, so every existing route stays reachable from
          the sidebar in both states — only the pl-4 indent, which has
          no room in a narrow collapsed rail, is dropped. This group's
          own open/closed logic above is completely untouched either
          way. */}
      {open && <div className={clsx('mt-1 flex flex-col gap-1', !sidebarCollapsed && 'pl-4')}>{children}</div>}
    </div>
  );
}
