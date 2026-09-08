import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listExpenses } from '@/lib/services/expenses';
import { generateExpenseReportPdf } from '@/lib/services/reports-export';

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
    categoryId: params.get('categoryId') ?? undefined,
    paymentStatus: params.get('paymentStatus') ?? undefined,
    paymentMethod: params.get('paymentMethod') ?? undefined,
    creditCardId: params.get('creditCardId') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    quotationId: params.get('quotationId') ?? undefined,
  };

  const supabase = await createClient();
  try {
    const records = await listExpenses(supabase, filters);
    const pdfBuffer = await generateExpenseReportPdf(records, filters);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="expense-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate report.' }, { status: 500 });
  }
}
