import { renderToBuffer } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import { SalesReportPdfDocument, type SalesReportPdfRow } from '@/pdf/sales-report-pdf-document';
import { ExpenseReportPdfDocument, type ExpenseReportPdfRow } from '@/pdf/expense-report-pdf-document';
import { SALES_PAYMENT_STATUS_LABELS, type SalesRecord } from './sales';
import { EXPENSE_PAYMENT_STATUS_LABELS, EXPENSE_PAYMENT_METHOD_LABELS } from '@/lib/validation/expenses';
import type { ExpenseRow } from './expenses';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function describeFilters(filters: Record<string, string | undefined>): string {
  const active = Object.entries(filters).filter(([, v]) => v);
  if (active.length === 0) return 'None';
  return active.map(([k, v]) => `${k}: ${v}`).join(', ');
}

function dateRangeLabel(from?: string, to?: string): string {
  if (!from && !to) return 'All dates';
  return `${from ? fmtDate(from) : 'Earliest'} – ${to ? fmtDate(to) : 'Latest'}`;
}

// ============================================================================
// Sales
// ============================================================================

function toSalesReportRows(records: SalesRecord[]): SalesReportPdfRow[] {
  return records.map((r) => ({
    quotationNumber: r.quotationNumber,
    customerName: r.customerName,
    invoiceDate: fmtDate(r.invoiceDate),
    travelStartDate: fmtDate(r.travelStartDate),
    totalSale: r.totalSale,
    amountPaid: r.amountPaid,
    balance: r.balance,
    paymentStatusLabel: SALES_PAYMENT_STATUS_LABELS[r.paymentStatus],
    airfareCost: r.airfareCost,
    hotelCost: r.hotelCost,
    transferCost: r.transferCost,
    tourCost: r.tourCost,
    bankCharge: r.bankCharge,
    refund: r.refund,
    totalCost: r.totalCost,
    netProfit: r.netProfit,
    paymentDueDate: fmtDate(r.paymentDueDate),
    agentName: r.agentName,
    remarks: r.remarks,
  }));
}

function salesTotals(records: SalesRecord[]) {
  return {
    totalSales: records.reduce((s, r) => s + r.totalSale, 0),
    amountCollected: records.reduce((s, r) => s + r.amountPaid, 0),
    outstandingBalance: records.reduce((s, r) => s + r.balance, 0),
    totalCost: records.reduce((s, r) => s + r.totalCost, 0),
    totalRefund: records.reduce((s, r) => s + r.refund, 0),
    netProfit: records.reduce((s, r) => s + r.netProfit, 0),
  };
}

export async function generateSalesReportPdf(records: SalesRecord[], filters: Record<string, string | undefined>): Promise<Buffer> {
  const data = {
    generatedAt: new Date().toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    dateRangeLabel: dateRangeLabel(filters.invoiceFrom ?? filters.travelFrom, filters.invoiceTo ?? filters.travelTo),
    filterSummary: describeFilters(filters),
    rows: toSalesReportRows(records),
    totals: salesTotals(records),
  };
  return renderToBuffer(SalesReportPdfDocument({ data }));
}

export function generateSalesReportExcel(records: SalesRecord[]): Buffer {
  const rows = records.map((r) => ({
    'Quotation Ref': r.quotationNumber,
    Customer: r.customerName,
    'Invoice Date': fmtDate(r.invoiceDate),
    'Travel Date': fmtDate(r.travelStartDate),
    'Total Sale': Math.round(r.totalSale),
    'Amount Paid': Math.round(r.amountPaid),
    Balance: Math.round(r.balance),
    'Payment Status': SALES_PAYMENT_STATUS_LABELS[r.paymentStatus],
    'Airfare Cost': Math.round(r.airfareCost),
    'Hotel Accommodation Cost': Math.round(r.hotelCost),
    'Airport Transfer': Math.round(r.transferCost),
    'Tour Package': Math.round(r.tourCost),
    'Bank Charge': Math.round(r.bankCharge),
    Refund: Math.round(r.refund),
    'Total Cost': Math.round(r.totalCost),
    'Net Profit': Math.round(r.netProfit),
    'Next Payment Due': fmtDate(r.paymentDueDate),
    Agent: r.agentName,
    Remarks: r.remarks,
  }));

  const totals = salesTotals(records);
  const summaryRows = [
    {},
    { 'Quotation Ref': 'SUMMARY' },
    { 'Quotation Ref': 'Total Sales', 'Total Sale': Math.round(totals.totalSales) },
    { 'Quotation Ref': 'Total Amount Collected', 'Total Sale': Math.round(totals.amountCollected) },
    { 'Quotation Ref': 'Total Outstanding Balance', 'Total Sale': Math.round(totals.outstandingBalance) },
    { 'Quotation Ref': 'Total Cost', 'Total Sale': Math.round(totals.totalCost) },
    { 'Quotation Ref': 'Total Refund', 'Total Sale': Math.round(totals.totalRefund) },
    { 'Quotation Ref': 'Total Net Profit', 'Total Sale': Math.round(totals.netProfit) },
  ];

  const worksheet = XLSX.utils.json_to_sheet([...rows, ...summaryRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ============================================================================
// Expenses
// ============================================================================

function toExpenseReportRows(records: ExpenseRow[]): ExpenseReportPdfRow[] {
  return records.map((r) => ({
    expenseDate: fmtDate(r.expenseDate),
    description: r.description,
    categoryName: r.categoryName,
    amount: r.amount,
    paymentStatusLabel: EXPENSE_PAYMENT_STATUS_LABELS[r.paymentStatus as keyof typeof EXPENSE_PAYMENT_STATUS_LABELS] ?? r.paymentStatus,
    paymentMethodLabel: EXPENSE_PAYMENT_METHOD_LABELS[r.paymentMethod as keyof typeof EXPENSE_PAYMENT_METHOD_LABELS] ?? r.paymentMethod,
    creditCardLabel: r.creditCardLabel ?? '—',
    quotationNumber: r.quotationNumber ?? '—',
    customerName: r.clientName ?? '—',
    bookingNumber: r.bookingNumber ?? '—',
    dueDate: fmtDate(r.dueDate),
    remarks: r.remarks,
  }));
}

function expenseTotals(records: ExpenseRow[]) {
  return {
    totalExpenses: records.reduce((s, r) => s + r.amount, 0),
    paidExpenses: records.filter((r) => r.paymentStatus === 'paid').reduce((s, r) => s + r.amount, 0),
    pendingExpenses: records.filter((r) => r.paymentStatus === 'pending').reduce((s, r) => s + r.amount, 0),
    partiallyPaidExpenses: records.filter((r) => r.paymentStatus === 'partially_paid').reduce((s, r) => s + r.amount, 0),
    creditCardExpenses: records.filter((r) => r.paymentMethod === 'credit_card').reduce((s, r) => s + r.amount, 0),
    linkedTripExpenses: records.filter((r) => r.quotationId).reduce((s, r) => s + r.amount, 0),
  };
}

export async function generateExpenseReportPdf(records: ExpenseRow[], filters: Record<string, string | undefined>): Promise<Buffer> {
  const data = {
    generatedAt: new Date().toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    dateRangeLabel: dateRangeLabel(filters.dateFrom, filters.dateTo),
    filterSummary: describeFilters(filters),
    rows: toExpenseReportRows(records),
    totals: expenseTotals(records),
  };
  return renderToBuffer(ExpenseReportPdfDocument({ data }));
}

export function generateExpenseReportExcel(records: ExpenseRow[]): Buffer {
  const rows = records.map((r) => ({
    'Expense Date': fmtDate(r.expenseDate),
    Description: r.description,
    Category: r.categoryName,
    Amount: Math.round(r.amount),
    'Payment Status': EXPENSE_PAYMENT_STATUS_LABELS[r.paymentStatus as keyof typeof EXPENSE_PAYMENT_STATUS_LABELS] ?? r.paymentStatus,
    'Payment Method': EXPENSE_PAYMENT_METHOD_LABELS[r.paymentMethod as keyof typeof EXPENSE_PAYMENT_METHOD_LABELS] ?? r.paymentMethod,
    'Credit Card / Last 4': r.creditCardLabel ?? '',
    'Quotation Ref': r.quotationNumber ?? '',
    Customer: r.clientName ?? '',
    Booking: r.bookingNumber ?? '',
    'Due Date': fmtDate(r.dueDate),
    Remarks: r.remarks,
  }));

  const totals = expenseTotals(records);
  const summaryRows = [
    {},
    { 'Expense Date': 'SUMMARY' },
    { 'Expense Date': 'Total Expenses', Amount: Math.round(totals.totalExpenses) },
    { 'Expense Date': 'Paid Expenses', Amount: Math.round(totals.paidExpenses) },
    { 'Expense Date': 'Pending Expenses', Amount: Math.round(totals.pendingExpenses) },
    { 'Expense Date': 'Partially Paid Expenses', Amount: Math.round(totals.partiallyPaidExpenses) },
    { 'Expense Date': 'Credit Card Expenses', Amount: Math.round(totals.creditCardExpenses) },
    { 'Expense Date': 'Linked Trip Expenses', Amount: Math.round(totals.linkedTripExpenses) },
  ];

  const worksheet = XLSX.utils.json_to_sheet([...rows, ...summaryRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Report');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
