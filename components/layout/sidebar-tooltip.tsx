'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Minimal, dependency-free hover/focus tooltip — only ever used inside
 * the sidebar's collapsed (icon-only) state, to show a nav item's label
 * on hover. No new package: this project already has @radix-ui/* for
 * dialogs/dropdowns/etc., but a single-purpose text tooltip like this
 * doesn't need it.
 *
 * Portaled to document.body rather than positioned inline: the sidebar
 * nav list has (pre-existing, unrelated to this change) overflow-y-auto
 * for its own vertical scrolling, and per the CSS overflow spec, setting
 * overflow-y to anything but visible makes the browser treat overflow-x
 * as auto too — so a tooltip absolutely-positioned inside that list
 * would be silently clipped, never actually visible, regardless of its
 * own z-index/opacity. Portaling escapes that container's clipping
 * entirely, which is why this needs the trigger's on-screen position
 * (via getBoundingClientRect on hover/focus) rather than a plain CSS
 * `absolute` offset from its own parent.
 */
export function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }
  function hide() {
    setCoords(null);
  }

  return (
    <span
      ref={wrapperRef}
      className="relative flex w-full"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-sidebar-bg px-2 py-1 text-xs font-medium text-sidebar-text opacity-100 shadow-card"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
