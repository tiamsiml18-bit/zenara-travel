import Link from 'next/link';
import { clsx } from 'clsx';

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
    );
    params.set('page', String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between border-t border-sand-200 px-4 py-3 text-sm text-ink-500">
      <span>
        Page {page} of {totalPages} &middot; {total.toLocaleString()} total
      </span>
      <div className="flex gap-1">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          className={clsx(
            'rounded-md border border-sand-200 px-2.5 py-1',
            page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'
          )}
        >
          Previous
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          className={clsx(
            'rounded-md border border-sand-200 px-2.5 py-1',
            page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'
          )}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
