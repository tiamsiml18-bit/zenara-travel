import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listSalesRecords, type SalesPaymentStatus } from '@/lib/services/sales';
import { generateSalesReportExcel } from '@/lib/services/reports-export';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    search: params.get('search') ?? undefined,
    paymentStatus: (params.get('paymentStatus') as SalesPaymentStatus | null) ?? undefined,
    agentId: params.get('agentId') ?? undefined,
    travelFrom: params.get('travelFrom') ?? undefined,
    travelTo: params.get('travelTo') ?? undefined,
    invoiceFrom: params.get('invoiceFrom') ?? undefined,
    invoiceTo: params.get('invoiceTo') ?? undefined,
  };

  const supabase = await createClient();
  try {
    const records = await listSalesRecords(supabase, filters);
    const excelBuffer = generateSalesReportExcel(records);

    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sales-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate report.' }, { status: 500 });
  }
}
