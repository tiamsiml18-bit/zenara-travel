import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface DetailedItineraryRow {
  id: string;
  status: string;
  generatedAt: string;
  sentAt: string | null;
  booking: {
    id: string;
    bookingNumber: string;
    destination: string;
    travelStartDate: string;
    travelEndDate: string;
    clientName: string | null;
  } | null;
}

export function DetailedItinerariesTable({ itineraries }: { itineraries: DetailedItineraryRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3">Booking</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Travel dates</th>
            <th className="px-4 py-3">Generated</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {itineraries.map((it) => (
            <tr key={it.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/50">
              <td className="px-4 py-3">
                <Link href={`/detailed-itineraries/${it.id}`} className="font-ticket font-medium text-ink-900 hover:text-harbor-600">
                  {it.booking?.bookingNumber ?? '—'}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink-700">{it.booking?.clientName ?? '—'}</td>
              <td className="px-4 py-3 text-ink-700">{it.booking?.destination ?? '—'}</td>
              <td className="px-4 py-3 text-ink-700">
                {it.booking ? `${formatDate(it.booking.travelStartDate)} – ${formatDate(it.booking.travelEndDate)}` : '—'}
              </td>
              <td className="px-4 py-3 text-ink-700">{formatDate(it.generatedAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge label={it.status} />
              </td>
            </tr>
          ))}
          {itineraries.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                No Detailed Itineraries yet — one is created automatically 14 days before departure for every
                confirmed, fully paid booking.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
