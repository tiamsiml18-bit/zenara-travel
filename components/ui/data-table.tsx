import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';
import { clsx } from 'clsx';

/**
 * Minimal, purely structural table primitives — the exact markup and
 * classes already used by clients-table.tsx / quotations-table.tsx
 * (the more consistent of the existing tables; bookings-table.tsx had
 * drifted slightly, e.g. an extra `text-left font-medium` on its header
 * that the other two don't have — this canonicalizes the correct
 * version rather than either one, resolving that specific drift).
 *
 * Deliberately does not include pagination, sorting, filtering, or row
 * selection — those stay exactly where they already live (page-level
 * state and the existing Pagination component). This is only the
 * repeated visual shell: outer wrapper, header, body, row, cell.
 *
 * No existing table is migrated onto this yet — it's available for a
 * later phase to adopt one table at a time.
 */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('overflow-hidden rounded-lg border border-sand-200 bg-surface', className)}>{children}</div>;
}

export function DataTableTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={clsx('w-full text-sm', className)}>{children}</table>;
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
      {children}
    </thead>
  );
}

export function DataTableHeadCell({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={clsx('px-4 py-3', className)} {...props}>
      {children}
    </th>
  );
}

export function DataTableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={clsx('divide-y divide-sand-100', className)}>{children}</tbody>;
}

export function DataTableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={clsx('hover:bg-sand-50', className)}>{children}</tr>;
}

export function DataTableCell({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx('px-4 py-3', className)} {...props}>
      {children}
    </td>
  );
}

/** A single full-width cell for the "no rows" state — pass colSpan matching the table's column count. */
export function DataTableEmpty({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-ink-500">
        {children}
      </td>
    </tr>
  );
}
