'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export function NavLink({
  href,
  label,
  icon: Icon,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={clsx(
        'group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-harbor-800 text-sand-50'
          : 'text-harbor-100/70 hover:bg-harbor-800/60 hover:text-sand-50'
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        {label}
      </span>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className={clsx(
            'font-ticket rounded-full px-1.5 py-0.5 text-[11px] leading-none',
            isActive ? 'bg-sand-50 text-harbor-800' : 'bg-coral-500 text-white'
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
