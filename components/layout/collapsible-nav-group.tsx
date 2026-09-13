'use client';

import { useState, type ReactNode } from 'react';
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
 * Collapsed by default, expands on click, and auto-expands (and stays
 * expanded) whenever the current route is inside one of `childRoutes` —
 * so navigating directly to e.g. /bookings (a bookmark, a link from
 * elsewhere) never leaves its parent group looking collapsed while one
 * of its own pages is the active route.
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
          {icon}
          {label}
        </span>
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} strokeWidth={1.75} />
      </button>

      {isOpen && <div className="mt-1 flex flex-col gap-1 pl-4">{children}</div>}
    </div>
  );
}
