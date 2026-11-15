import Link from 'next/link';
import { Calendar } from 'lucide-react';

interface UpcomingTravelRow {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string | null;
  paymentStatus: 'paid' | 'partial';
}

function formatDayMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return { day: d.getUTCDate(), month: d.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }) };
}

function daysAway(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function TravelRow({ row }: { row: UpcomingTravelRow }) {
  const { day, month } = formatDayMonth(row.travelStartDate);
  const isPaid = row.paymentStatus === 'paid';
  return (
    <li>
      <Link href={`/quotations/${row.quotationId}`} className="flex items-center gap-3 py-2.5 hover:bg-sand-50">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-harbor-50 py-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-harbor-600">{month}</span>
          <span className="font-ticket text-base font-semibold text-harbor-800">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{row.clientName}</p>
          <p className="truncate text-xs text-ink-500">{row.destination}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isPaid ? 'bg-harbor-100 text-harbor-700' : 'bg-warning-100 text-warning-700'
            }`}
          >
            {isPaid ? 'Fully Paid' : 'Partially Paid'}
          </span>
          <span className="text-xs text-ink-500">{daysAway(row.travelStartDate)}</span>
        </div>
      </Link>
    </li>
  );
}

export function UpcomingTravelWidget({ rows }: { rows: UpcomingTravelRow[] }) {
  // Rows arrive earliest-first; each group keeps that order.
  const fullyPaid = rows.filter((r) => r.paymentStatus === 'paid');
  const partiallyPaid = rows.filter((r) => r.paymentStatus === 'partial');

  return (
    <section className="rounded-lg border border-sand-200 bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-harbor-600" />
        <h3 className="font-display text-sm font-semibold text-ink-900">Upcoming confirmed travel</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500">No confirmed trips departing soon.</p>
      ) : (
        <div>
          {fullyPaid.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-harbor-700">
                Fully Paid ({fullyPaid.length})
              </p>
              <ul className="divide-y divide-sand-100">
                {fullyPaid.map((row) => (
                  <TravelRow key={row.quotationId} row={row} />
                ))}
              </ul>
            </div>
          )}
          {fullyPaid.length > 0 && partiallyPaid.length > 0 && <hr className="my-4 border-t-2 border-sand-200" />}
          {partiallyPaid.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-warning-700">
                Partially Paid ({partiallyPaid.length})
              </p>
              <ul className="divide-y divide-sand-100">
                {partiallyPaid.map((row) => (
                  <TravelRow key={row.quotationId} row={row} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
