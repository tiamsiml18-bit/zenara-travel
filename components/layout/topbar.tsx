import { Search, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth/actions';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-sand-200 bg-white px-6">
      <h1 className="font-display text-lg font-semibold text-ink-900">{title}</h1>

      <div className="flex items-center gap-4">
        <form action="/search" className="relative hidden sm:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
            strokeWidth={1.75}
          />
          <input
            name="q"
            type="search"
            placeholder="Search clients, quotations, agents…"
            className="w-72 rounded-md border border-sand-200 bg-sand-50 py-1.5 pl-8 pr-3 text-sm text-ink-900 outline-none ring-harbor-400 placeholder:text-ink-500/60 focus:ring-2"
          />
        </form>

        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
