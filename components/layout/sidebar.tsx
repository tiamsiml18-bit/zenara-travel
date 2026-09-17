'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  UsersRound,
  FileText,
  TrendingUp,
  Bell,
  BriefcaseBusiness,
  Package,
  PackageCheck,
  Map,
  WalletCards,
  Receipt,
  ChartNoAxesCombined,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { NavLink } from './nav-link';
import { CollapsibleNavGroup } from './collapsible-nav-group';
import { SettingsNavGroup } from './settings-nav-group';
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
  // Whole-sidebar icon-only rail state — distinct from each
  // CollapsibleNavGroup's own open/closed accordion state (Pipeline/
  // Catalog/Finance/Settings), which is untouched by this. Local state
  // rather than persisted (no localStorage/cookie): the (app) layout
  // that renders Sidebar isn't remounted on in-app navigation, so this
  // already survives moving between pages; it only resets on a full
  // reload, a reasonable default for the smallest change that adds the
  // toggle without adding new persistence machinery.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-text transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-56'
      )}
    >
      {/* Tag head — agency mark, styled like the punched end of a luggage tag.
          Falls back to the plain "Z" badge until a real logo is uploaded in
          Settings — same fallback the PDF watermark uses. Rendered directly
          at its natural aspect ratio, no background chip — the logo's own
          light background reads clearly against this equally light sidebar,
          and a wrapping box made it look cramped/boxed-in for a wide
          rectangular mark. */}
      <div className={clsx('py-5', collapsed ? 'px-1.5' : 'px-4')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'justify-between gap-2')}>
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden transition-opacity hover:opacity-80">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not worth a next/image remote-domain config for a single small sidebar mark
              <img src={logoUrl} alt="" className={clsx('w-auto shrink-0 object-contain', collapsed ? 'h-7' : 'h-11')} />
            ) : (
              <span
                className={clsx(
                  'flex shrink-0 items-center justify-center rounded-md border-2 border-sidebar-active-text/30 font-display font-semibold text-sidebar-active-text',
                  collapsed ? 'h-7 w-7 text-sm' : 'h-11 w-11 text-base'
                )}
              >
                Z
              </span>
            )}
            {!collapsed && (
              <div className="leading-tight">
                <p className="font-display text-sm font-semibold text-sidebar-text">Zenara</p>
                <p className="text-[11px] uppercase tracking-wide text-sidebar-text-muted">Travel &amp; Tours</p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="shrink-0 rounded-md p-1.5 text-sidebar-text-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mt-2 flex w-full items-center justify-center rounded-md p-1.5 text-sidebar-text-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text"
          >
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Perforated tear line — the tag's signature detail */}
      <div aria-hidden className="mx-4 border-t border-dashed border-sidebar-border" />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon={<LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          collapsed={collapsed}
        />

        <CollapsibleNavGroup
          label="Pipeline"
          icon={<GitBranch className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          childRoutes={['/clients', '/quotations', '/followups', '/bookings']}
          sidebarCollapsed={collapsed}
        >
          <NavLink href="/clients" label="Clients" icon={<UsersRound className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
          <NavLink href="/quotations" label="Quotations" icon={<FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
          <NavLink
            href="/followups"
            label="Follow-ups"
            icon={<Bell className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            badge={followUpsDueCount}
            collapsed={collapsed}
            indent
          />
          <NavLink href="/bookings" label="Bookings" icon={<BriefcaseBusiness className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
        </CollapsibleNavGroup>

        <CollapsibleNavGroup
          label="Catalog"
          icon={<Package className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          childRoutes={['/packages', '/tours']}
          sidebarCollapsed={collapsed}
        >
          <NavLink href="/packages" label="Packages" icon={<PackageCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
          <NavLink href="/tours" label="Tours" icon={<Map className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
        </CollapsibleNavGroup>

        <CollapsibleNavGroup
          label="Finance"
          icon={<WalletCards className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          childRoutes={['/sales', '/expenses']}
          sidebarCollapsed={collapsed}
        >
          <NavLink href="/sales" label="Sales" icon={<TrendingUp className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
          <NavLink href="/expenses" label="Expenses" icon={<Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} />} collapsed={collapsed} indent />
        </CollapsibleNavGroup>

        <NavLink
          href="/reports"
          label="Reports"
          icon={<ChartNoAxesCombined className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
          collapsed={collapsed}
        />

        {/* Single collapsible "Settings" parent — collapsed by default,
            expands on click, and auto-expands when the current route is
            inside one of its four children. General/Users/Import clients
            keep their existing routes and admin-only gating; Privacy &
            Security is available to every authenticated user. See
            settings-nav-group.tsx for the toggle/auto-expand logic. */}
        <SettingsNavGroup isAdmin={user.role === 'admin'} sidebarCollapsed={collapsed} />
      </nav>

      {/* Tag stub footer — signed-in agent, like the traveler name on a tag.
          Hidden in the collapsed rail — there's no icon representation of
          "the current user" among the existing UI to fall back to, and the
          name/role text can't usefully fit an icon-only width. */}
      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="truncate text-sm font-medium text-sidebar-text">{user.fullName}</p>
          <p className="truncate text-xs capitalize text-sidebar-text-muted">{user.role}</p>
        </div>
      )}
    </aside>
  );
}
