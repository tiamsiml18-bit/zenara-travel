import { HISTORICAL_PAYMENT_STATUSES, type HistoricalPaymentStatus } from './historical-sales';

/** Target fields a spreadsheet column can be mapped onto — matches the old tracker's own columns (SN is deliberately not mappable, it carries no information this CRM needs). */
export const HISTORICAL_IMPORT_FIELDS = [
  'customerName',
  'invoiceDate',
  'travelDate',
  'quotationRef',
  'totalSale',
  'airfareCost',
  'hotelCost',
  'transferCost',
  'tourCost',
  'bankCharge',
  'refund',
  'totalCost',
  'netProfit',
  'amountPaid',
  'paymentStatus',
  'remarks',
] as const;
export type HistoricalImportField = (typeof HISTORICAL_IMPORT_FIELDS)[number];

export const HISTORICAL_IMPORT_FIELD_LABELS: Record<HistoricalImportField, string> = {
  customerName: 'Customer Name',
  invoiceDate: 'Invoice Date',
  travelDate: 'Travel Date',
  quotationRef: 'Quotation / Invoice Ref',
  totalSale: 'Total Sale (Invoice Amount)',
  airfareCost: 'Airfare Cost',
  hotelCost: 'Hotel Accommodation Cost',
  transferCost: 'Airport Transfer',
  tourCost: 'Tour Package',
  bankCharge: 'Bank Charge',
  refund: 'Refund',
  totalCost: 'Total Cost',
  netProfit: 'Net Profit',
  amountPaid: 'Amount Paid',
  paymentStatus: 'Payment Status',
  remarks: 'Remarks',
};

export const HISTORICAL_IMPORT_REQUIRED_FIELDS: HistoricalImportField[] = ['customerName'];

const HEADER_SYNONYMS: Record<HistoricalImportField, string[]> = {
  customerName: ['customer name', 'name', 'client name', 'customer'],
  invoiceDate: ['invoice date'],
  travelDate: ['travel date'],
  quotationRef: ['invoice in zoho', 'invoice ref', 'quotation ref', 'quotation / invoice ref', 'zoho', 'invoice number', 'ref'],
  totalSale: ['invoice amount', 'total sale', 'total amount', 'invoice total'],
  airfareCost: ['airfare cost', 'airfare'],
  hotelCost: ['hotel accommodation cost', 'hotel cost', 'hotel accommodation', 'hotel'],
  transferCost: ['airport transfer', 'transfer', 'transfer cost'],
  tourCost: ['tour package', 'tour cost', 'tour'],
  bankCharge: ['bank charge', 'bank fee', 'bank charges'],
  refund: ['refund', 'refunds'],
  totalCost: ['total cost'],
  netProfit: ['net profit', 'profit'],
  amountPaid: ['amount paid', 'paid', 'paid amount'],
  paymentStatus: ['payment status', 'status'],
  remarks: ['remarks', 'notes', 'comments'],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function suggestHistoricalFieldForHeader(header: string): HistoricalImportField | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;
  for (const field of HISTORICAL_IMPORT_FIELDS) {
    if (HEADER_SYNONYMS[field].includes(normalized)) return field;
  }
  for (const field of HISTORICAL_IMPORT_FIELDS) {
    if (HEADER_SYNONYMS[field].some((syn) => normalized.includes(syn) || syn.includes(normalized))) return field;
  }
  return null;
}

export function autoMapHistoricalHeaders(headers: string[]): Record<string, HistoricalImportField | ''> {
  const mapping: Record<string, HistoricalImportField | ''> = {};
  const used = new Set<HistoricalImportField>();
  for (const header of headers) {
    const suggestion = suggestHistoricalFieldForHeader(header);
    if (suggestion && !used.has(suggestion)) {
      mapping[header] = suggestion;
      used.add(suggestion);
    } else {
      mapping[header] = '';
    }
  }
  return mapping;
}

export type HistoricalMappedRow = Partial<Record<HistoricalImportField, string>> & { __rowNumber: number };

export interface NormalizedHistoricalRow {
  rowNumber: number;
  customerName: string;
  invoiceDate: string | null;
  travelDate: string | null;
  quotationRef: string | null;
  totalSale: number;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
  // Preserved from the sheet as-is when present -- NOT recalculated from
  // the cost fields above, per spec ("do not recalculate or overwrite
  // historical values during import"). Only defaults to the computed sum
  // when the sheet didn't have its own value at all.
  totalCost: number;
  netProfit: number;
  amountPaid: number;
  paymentStatus: HistoricalPaymentStatus;
  remarks: string | null;
}

export interface HistoricalRowValidationResult {
  rowNumber: number;
  row: NormalizedHistoricalRow | null;
  errors: string[];
  warnings: string[];
}

function parseMoney(raw: string): { value: number; error: string | null } {
  const cleaned = (raw ?? '').replace(/[^\d.-]/g, '');
  if (cleaned === '') return { value: 0, error: null };
  const num = Number(cleaned);
  if (Number.isNaN(num)) return { value: 0, error: null }; // unparseable money is a soft warning elsewhere, never a hard block
  return { value: num, error: null };
}

function parseDate(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parsePaymentStatus(raw: string | undefined, amountPaid: number, totalSale: number): HistoricalPaymentStatus {
  const normalized = (raw ?? '').trim().toLowerCase();
  const match = HISTORICAL_PAYMENT_STATUSES.find((s) => s === normalized || s.replace('_', ' ') === normalized);
  if (match) return match;
  if (amountPaid <= 0) return 'pending_payment';
  if (amountPaid >= totalSale && totalSale > 0) return 'paid';
  return 'partially_paid';
}

export function validateHistoricalMappedRow(row: HistoricalMappedRow): HistoricalRowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const customerName = (row.customerName ?? '').trim();
  if (!customerName) errors.push('Customer name is required.');

  if ((row.invoiceDate ?? '').trim() && !parseDate(row.invoiceDate ?? '')) {
    warnings.push(`Invoice date "${row.invoiceDate}" wasn't recognized — left blank.`);
  }
  if ((row.travelDate ?? '').trim() && !parseDate(row.travelDate ?? '')) {
    warnings.push(`Travel date "${row.travelDate}" wasn't recognized — left blank.`);
  }

  const totalSale = parseMoney(row.totalSale ?? '').value;
  const airfareCost = parseMoney(row.airfareCost ?? '').value;
  const hotelCost = parseMoney(row.hotelCost ?? '').value;
  const transferCost = parseMoney(row.transferCost ?? '').value;
  const tourCost = parseMoney(row.tourCost ?? '').value;
  const bankCharge = parseMoney(row.bankCharge ?? '').value;
  const refund = parseMoney(row.refund ?? '').value;
  const amountPaid = parseMoney(row.amountPaid ?? '').value;

  const computedTotalCost = airfareCost + hotelCost + transferCost + tourCost + bankCharge + refund;
  const sheetHasTotalCost = (row.totalCost ?? '').trim() !== '';
  const sheetHasNetProfit = (row.netProfit ?? '').trim() !== '';
  const totalCost = sheetHasTotalCost ? parseMoney(row.totalCost ?? '').value : computedTotalCost;
  const netProfit = sheetHasNetProfit ? parseMoney(row.netProfit ?? '').value : totalSale - totalCost;

  if (errors.length > 0) {
    return { rowNumber: row.__rowNumber, row: null, errors, warnings };
  }

  return {
    rowNumber: row.__rowNumber,
    row: {
      rowNumber: row.__rowNumber,
      customerName,
      invoiceDate: parseDate(row.invoiceDate ?? ''),
      travelDate: parseDate(row.travelDate ?? ''),
      quotationRef: (row.quotationRef ?? '').trim() || null,
      totalSale,
      airfareCost,
      hotelCost,
      transferCost,
      tourCost,
      bankCharge,
      refund,
      totalCost,
      netProfit,
      amountPaid,
      paymentStatus: parsePaymentStatus(row.paymentStatus, amountPaid, totalSale),
      remarks: (row.remarks ?? '').trim() || null,
    },
    errors,
    warnings,
  };
}
