import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Briefcase,
  Package,
  BarChart3,
  Settings,
  UploadCloud,
  UserCog,
} from 'lucide-react';
import { NavLink } from './nav-link';
import type { AppUser } from '@/lib/auth/session';

export function Sidebar({ user, followUpsDueCount = 0 }: { user: AppUser; followUpsDueCount?: number }) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-harbor-900 text-sand-50">
      {/* Tag head — agency mark, styled like the punched end of a luggage tag */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-sand-50/25 font-display text-sm font-semibold">
          Z
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">Zenara</p>
          <p className="text-[11px] uppercase tracking-wide text-harbor-100/50">Travel &amp; Tours</p>
        </div>
      </div>

      {/* Perforated tear line — the tag's signature detail */}
      <div
        aria-hidden
        className="mx-4 border-t border-dashed border-sand-50/15"
      />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <NavLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
        <NavLink href="/clients" label="Clients" icon={Users} />
        <NavLink href="/quotations" label="Quotations" icon={FileText} />
        <NavLink href="/followups" label="Follow-ups" icon={Bell} badge={followUpsDueCount} />
        <NavLink href="/bookings" label="Bookings" icon={Briefcase} />
        <NavLink href="/packages" label="Packages" icon={Package} />
        <NavLink href="/reports" label="Reports" icon={BarChart3} />

        {user.role === 'admin' && (
          <>
            <div className="mt-4 mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-harbor-100/40">
              Admin
            </div>
            <NavLink href="/admin/settings" label="Settings" icon={Settings} />
            <NavLink href="/admin/users" label="Users" icon={UserCog} />
            <NavLink href="/admin/import" label="Import clients" icon={UploadCloud} />
          </>
        )}
      </nav>

      {/* Tag stub footer — signed-in agent, like the traveler name on a tag */}
      <div className="border-t border-harbor-800 px-4 py-3">
        <p className="truncate text-sm font-medium">{user.fullName}</p>
        <p className="truncate text-xs capitalize text-harbor-100/50">{user.role}</p>
      </div>
    </aside>
  );
}
