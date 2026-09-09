import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { RestoreQuotationButton } from '@/components/quotations/restore-quotation-button';
import { createClient } from '@/lib/supabase/server';
import { listDeletedQuotations } from '@/lib/services/quotations';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export default async function DeletedQuotationsPage() {
  await requireUser();
  const supabase = await createClient();
  const deletedQuotations = await listDeletedQuotations(supabase);

  return (
    <>
      <Topbar title="Deleted Quotations" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/quotations" className="flex items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-harbor-600">
            <ArrowLeft className="h-4 w-4" /> Back to Quotations
          </Link>
        </div>

        <p className="mb-4 text-sm text-ink-500">
          Deleted quotations are excluded from active Sales calculations. Restoring a quotation returns it to the
          active Quotations list exactly as it was, with all of its existing data intact.
        </p>

        <div className="overflow-hidden rounded-lg border border-sand-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 bg-sand-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quotation No.</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Travel dates</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Original Status</th>
                <th className="px-4 py-3 font-medium">Deleted Date</th>
                <th className="px-4 py-3 font-medium">Deleted By</th>
                <th className="px-4 py-3 font-medium">Restore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {deletedQuotations.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-ink-500">
                    No deleted quotations.
                  </td>
                </tr>
              )}
              {deletedQuotations.map((q) => (
                <tr key={q.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3 font-ticket font-medium text-ink-900">{q.quotationNumber}</td>
                  <td className="px-4 py-3 text-ink-700">{q.clientName}</td>
                  <td className="px-4 py-3 text-ink-700">{q.destination}</td>
                  <td className="px-4 py-3 font-ticket text-ink-700">{formatDate(q.travelStartDate)}</td>
                  <td className="px-4 py-3 font-ticket text-ink-700">{formatMoney(q.totalPrice)}</td>
                  <td className="px-4 py-3 text-ink-700 capitalize">{q.originalStatus}</td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(q.deletedAt)}</td>
                  <td className="px-4 py-3 text-ink-700">{q.deletedByName}</td>
                  <td className="px-4 py-3">
                    <RestoreQuotationButton quotationId={q.id} quotationNumber={q.quotationNumber} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
