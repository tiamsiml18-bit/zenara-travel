import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface SalesReportPdfRow {
  quotationNumber: string;
  customerName: string;
  invoiceDate: string;
  travelStartDate: string;
  totalSale: number;
  amountPaid: number;
  balance: number;
  paymentStatusLabel: string;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
  totalCost: number;
  netProfit: number;
  paymentDueDate: string;
  agentName: string;
  remarks: string;
}

export interface SalesReportPdfData {
  generatedAt: string;
  dateRangeLabel: string;
  filterSummary: string;
  rows: SalesReportPdfRow[];
  totals: {
    totalSales: number;
    amountCollected: number;
    outstandingBalance: number;
    totalCost: number;
    totalRefund: number;
    netProfit: number;
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

// Column widths as flex ratios — sums to a fixed proportion of the page, tuned for landscape Letter with 19 columns.
const COLS: { key: keyof SalesReportPdfRow; label: string; width: number; money?: boolean }[] = [
  { key: 'quotationNumber', label: 'Quotation Ref', width: 8 },
  { key: 'customerName', label: 'Customer', width: 9 },
  { key: 'invoiceDate', label: 'Invoice Date', width: 6 },
  { key: 'travelStartDate', label: 'Travel Date', width: 6 },
  { key: 'totalSale', label: 'Total Sale', width: 6, money: true },
  { key: 'amountPaid', label: 'Paid', width: 6, money: true },
  { key: 'balance', label: 'Balance', width: 6, money: true },
  { key: 'paymentStatusLabel', label: 'Status', width: 6 },
  { key: 'airfareCost', label: 'Airfare', width: 5, money: true },
  { key: 'hotelCost', label: 'Hotel', width: 5, money: true },
  { key: 'transferCost', label: 'Transfer', width: 5, money: true },
  { key: 'tourCost', label: 'Tour', width: 5, money: true },
  { key: 'bankCharge', label: 'Bank Chg', width: 5, money: true },
  { key: 'refund', label: 'Refund', width: 5, money: true },
  { key: 'totalCost', label: 'Total Cost', width: 6, money: true },
  { key: 'netProfit', label: 'Net Profit', width: 6, money: true },
  { key: 'paymentDueDate', label: 'Next Due', width: 6 },
  { key: 'agentName', label: 'Agent', width: 6 },
  { key: 'remarks', label: 'Remarks', width: 8 },
];

function money(n: number) {
  return `PHP ${Math.round(n).toLocaleString('en-PH')}`;
}

export function SalesReportPdfDocument({ data }: { data: SalesReportPdfData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Sales Report</Text>
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
            <Text>Total Sales</Text>
            <Text>{money(data.totals.totalSales)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Amount Collected</Text>
            <Text>{money(data.totals.amountCollected)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Outstanding Balance</Text>
            <Text>{money(data.totals.outstandingBalance)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Cost</Text>
            <Text>{money(data.totals.totalCost)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Refund</Text>
            <Text>{money(data.totals.totalRefund)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Net Profit</Text>
            <Text>{money(data.totals.netProfit)}</Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
