'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export function DropdownMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-md border border-sand-200 bg-surface py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block px-3 py-2 text-sm text-ink-700 hover:bg-sand-100">
      {children}
    </a>
  );
}

export function DropdownMenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-sand-100">
      {children}
    </button>
  );
}
