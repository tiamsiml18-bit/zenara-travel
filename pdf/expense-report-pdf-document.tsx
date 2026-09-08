import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface ExpenseReportPdfRow {
  expenseDate: string;
  description: string;
  categoryName: string;
  amount: number;
  paymentStatusLabel: string;
  paymentMethodLabel: string;
  creditCardLabel: string;
  quotationNumber: string;
  customerName: string;
  bookingNumber: string;
  dueDate: string;
  remarks: string;
}

export interface ExpenseReportPdfData {
  generatedAt: string;
  dateRangeLabel: string;
  filterSummary: string;
  rows: ExpenseReportPdfRow[];
  totals: {
    totalExpenses: number;
    paidExpenses: number;
    pendingExpenses: number;
    partiallyPaidExpenses: number;
    creditCardExpenses: number;
    linkedTripExpenses: number;
  };
}

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 24, fontSize: 7, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 8, color: '#555', marginBottom: 1 },
  table: { marginTop: 12, borderWidth: 1, borderColor: '#ccc' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  cell: { padding: 3, borderRightWidth: 0.5, borderRightColor: '#e0e0e0' },
  headerCell: { padding: 3, fontFamily: 'Helvetica-Bold', borderRightWidth: 0.5, borderRightColor: '#ccc' },
  summarySection: { marginTop: 16, borderWidth: 1, borderColor: '#ccc', padding: 10 },
  summaryTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  pageNumber: { position: 'absolute', bottom: 16, right: 24, fontSize: 7, color: '#888' },
});

const COLS: { key: keyof ExpenseReportPdfRow; label: string; width: number; money?: boolean }[] = [
  { key: 'expenseDate', label: 'Date', width: 6 },
  { key: 'description', label: 'Description', width: 12 },
  { key: 'categoryName', label: 'Category', width: 7 },
  { key: 'amount', label: 'Amount', width: 6, money: true },
  { key: 'paymentStatusLabel', label: 'Status', width: 6 },
  { key: 'paymentMethodLabel', label: 'Method', width: 6 },
  { key: 'creditCardLabel', label: 'Card', width: 8 },
  { key: 'quotationNumber', label: 'Quotation Ref', width: 8 },
  { key: 'customerName', label: 'Customer', width: 8 },
  { key: 'bookingNumber', label: 'Booking', width: 7 },
  { key: 'dueDate', label: 'Due Date', width: 6 },
  { key: 'remarks', label: 'Remarks', width: 10 },
];

function money(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export function ExpenseReportPdfDocument({ data }: { data: ExpenseReportPdfData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Expense Report</Text>
        <Text style={styles.meta}>Generated: {data.generatedAt}</Text>
        <Text style={styles.meta}>Date range: {data.dateRangeLabel}</Text>
        <Text style={styles.meta}>Filters: {data.filterSummary}</Text>

        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.headerCell, { flex: c.width }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {data.rows.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              {COLS.map((c) => (
                <Text key={c.key} style={[styles.cell, { flex: c.width }]}>
                  {c.money ? money(r[c.key] as number) : String(r[c.key] ?? '')}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.summarySection} wrap={false}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text>Total Expenses</Text>
            <Text>{money(data.totals.totalExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Paid Expenses</Text>
            <Text>{money(data.totals.paidExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Pending Expenses</Text>
            <Text>{money(data.totals.pendingExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Partially Paid Expenses</Text>
            <Text>{money(data.totals.partiallyPaidExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Credit Card Expenses</Text>
            <Text>{money(data.totals.creditCardExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Linked Trip Expenses</Text>
            <Text>{money(data.totals.linkedTripExpenses)}</Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
