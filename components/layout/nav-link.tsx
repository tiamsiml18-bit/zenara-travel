'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { SidebarTooltip } from './sidebar-tooltip';

export function NavLink({
  href,
  label,
  icon,
  badge,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  const link = (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      className={clsx(
        'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center' : 'justify-between',
        isActive ? 'bg-sidebar-active text-sidebar-active-text' : 'text-sidebar-text hover:bg-sidebar-hover'
      )}
    >
      <span className={clsx('flex items-center', !collapsed && 'gap-2.5')}>
        {icon}
        {!collapsed && label}
      </span>
      {/* Collapsed mode shows icons only, per the approved scope — the
          due-count badge (Follow-ups) is part of the label-adjacent
          content this hides, not the icon itself, so it's omitted here
          rather than repositioned onto the icon. Fully restored,
          unchanged, the moment the sidebar expands again. */}
      {typeof badge === 'number' && badge > 0 && !collapsed && (
        <span
          className={clsx(
            'font-ticket rounded-full px-1.5 py-0.5 text-[11px] leading-none',
            isActive ? 'bg-harbor-600 text-white' : 'bg-coral-500 text-white'
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return <SidebarTooltip label={label}>{link}</SidebarTooltip>;
}
