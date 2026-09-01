import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Briefcase,
  Package,
  Map,
  BarChart3,
  Settings,
  UploadCloud,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { NavLink } from './nav-link';
import type { AppUser } from '@/lib/auth/session';

export function Sidebar({
  user,
  followUpsDueCount = 0,
  logoUrl,
}: {
  user: AppUser;
  followUpsDueCount?: number;
  logoUrl?: string | null;
}) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sand-200 bg-harbor-50 text-ink-900">
      {/* Tag head — agency mark, styled like the punched end of a luggage tag.
          Falls back to the plain "Z" badge until a real logo is uploaded in
          Settings — same fallback the PDF watermark uses. Rendered directly
          at its natural aspect ratio, no background chip — the logo's own
          light background reads clearly against this equally light sidebar,
          and a wrapping box made it look cramped/boxed-in for a wide
          rectangular mark. */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-5 transition-opacity hover:opacity-80">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not worth a next/image remote-domain config for a single small sidebar mark
          <img src={logoUrl} alt="" className="h-11 w-auto shrink-0 object-contain" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-md border-2 border-harbor-600/30 font-display text-base font-semibold text-harbor-600">
            Z
          </span>
        )}
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-ink-900">Zenara</p>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Travel &amp; Tours</p>
        </div>
      </Link>

      {/* Perforated tear line — the tag's signature detail */}
      <div aria-hidden className="mx-4 border-t border-dashed border-sand-200" />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <NavLink href="/dashboard" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/clients" label="Clients" icon={<Users className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/quotations" label="Quotations" icon={<FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/followups" label="Follow-ups" icon={<Bell className="h-4 w-4 shrink-0" strokeWidth={1.75} />} badge={followUpsDueCount} />
        <NavLink href="/bookings" label="Bookings" icon={<Briefcase className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/packages" label="Packages" icon={<Package className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/tours" label="Tours" icon={<Map className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
        <NavLink href="/reports" label="Reports" icon={<BarChart3 className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />

        {user.role === 'admin' && (
          <>
            <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-ink-500">Admin</div>
            <NavLink href="/admin/settings" label="Settings" icon={<Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
            <NavLink href="/admin/users" label="Users" icon={<UserCog className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
            <NavLink href="/admin/import" label="Import clients" icon={<UploadCloud className="h-4 w-4 shrink-0" strokeWidth={1.75} />} />
          </>
        )}
      </nav>

      {/* Tag stub footer — signed-in agent, like the traveler name on a tag */}
      <div className="border-t border-sand-200 px-4 py-3">
        <p className="truncate text-sm font-medium text-ink-900">{user.fullName}</p>
        <p className="truncate text-xs capitalize text-ink-500">{user.role}</p>
      </div>
    </aside>
  );
}
