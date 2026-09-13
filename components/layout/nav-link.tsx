'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

export function NavLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={clsx(
        'group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-sidebar-active text-sidebar-active-text' : 'text-sidebar-text hover:bg-sidebar-hover'
      )}
    >
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      {typeof badge === 'number' && badge > 0 && (
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
}
