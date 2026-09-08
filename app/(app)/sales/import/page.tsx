import { Topbar } from '@/components/layout/topbar';
import { HistoricalImportWizard } from '@/components/sales/import/historical-import-wizard';
import { requireUser } from '@/lib/auth/session';

export default async function ImportHistoricalSalesPage() {
  await requireUser();

  return (
    <>
      <Topbar title="Import Historical Sales" showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-ink-500">
          Upload your old sales tracker spreadsheet (SN, Customer Name, Invoice Date, Travel Date, Invoice in Zoho, Invoice Amount, and cost columns).
          Imported rows become Historical Sales only — no quotation, client, booking, or payment record is created.
        </p>
        <HistoricalImportWizard />
      </main>
    </>
  );
}
