'use client';

import { useState, useTransition } from 'react';
import { upsertHistoricalSaleAction } from '@/app/(app)/sales/actions';
import { HISTORICAL_PAYMENT_STATUS_LABELS, HISTORICAL_PAYMENT_STATUSES, type HistoricalPaymentStatus } from '@/lib/validation/historical-sales';

export interface HistoricalSaleFormValues {
  id?: string;
  quotationRef: string;
  customerName: string;
  invoiceDate: string;
  travelDate: string;
  totalSale: number;
  amountPaid: number;
  paymentStatus: HistoricalPaymentStatus;
  airfareCost: number;
  hotelCost: number;
  transferCost: number;
  tourCost: number;
  bankCharge: number;
  refund: number;
  agentName: string;
  zohoInvoiceNumber: string;
  remarks: string;
}

const EMPTY: HistoricalSaleFormValues = {
  quotationRef: '',
  customerName: '',
  invoiceDate: '',
  travelDate: '',
  totalSale: 0,
  amountPaid: 0,
  paymentStatus: 'pending_payment',
  airfareCost: 0,
  hotelCost: 0,
  transferCost: 0,
  tourCost: 0,
  bankCharge: 0,
  refund: 0,
  agentName: '',
  zohoInvoiceNumber: '',
  remarks: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-md border border-sand-200 px-3 py-2 text-sm outline-none ring-harbor-400 focus:ring-2';

export function HistoricalSaleForm({ initialValues, onClose }: { initialValues?: HistoricalSaleFormValues; onClose: () => void }) {
  const [values, setValues] = useState<HistoricalSaleFormValues>(initialValues ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live, in-form preview only — the actual saved Total Cost/Net Profit
  // are recalculated server-side by upsertHistoricalSale, matching every
  // other manual-edit path exactly.
  const totalCost = values.airfareCost + values.hotelCost + values.transferCost + values.tourCost + values.bankCharge + values.refund;
  const netProfit = values.totalSale - totalCost;
  const balance = Math.max(0, values.totalSale - values.amountPaid);

  function set<K extends keyof HistoricalSaleFormValues>(key: K, value: HistoricalSaleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit() {
    setError(null);
    if (!values.customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    startTransition(async () => {
      const result = await upsertHistoricalSaleAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-5 shadow-xl">
        <h3 className="font-display text-base font-semibold text-ink-900">{values.id ? 'Edit Historical Sale' : 'Add Historical Sale'}</h3>
        <p className="mt-1 text-sm text-ink-500">A manually tracked old transaction — this never creates a quotation, client, booking, or payment record.</p>

        {error && <div className="mt-3 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Quotation / Invoice Ref">
            <input value={values.quotationRef} onChange={(e) => set('quotationRef', e.target.value)} className={inputClass} placeholder="e.g. ZOHO-INV-4821" />
          </Field>
          <Field label="Customer Name">
            <input value={values.customerName} onChange={(e) => set('customerName', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Invoice Date">
            <input type="date" value={values.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Travel Date">
            <input type="date" value={values.travelDate} onChange={(e) => set('travelDate', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Total Sale">
            <input type="number" value={values.totalSale} onChange={(e) => set('totalSale', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Amount Paid">
            <input type="number" value={values.amountPaid} onChange={(e) => set('amountPaid', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Balance (calculated)">
            <input readOnly value={`PHP ${Math.round(balance).toLocaleString('en-PH')}`} className={`${inputClass} bg-sand-50 text-ink-500`} />
          </Field>
          <Field label="Payment Status">
            <select value={values.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value as HistoricalPaymentStatus)} className={inputClass}>
              {HISTORICAL_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {HISTORICAL_PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Airfare Cost">
            <input type="number" value={values.airfareCost} onChange={(e) => set('airfareCost', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Hotel Accommodation Cost">
            <input type="number" value={values.hotelCost} onChange={(e) => set('hotelCost', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Airport Transfer">
            <input type="number" value={values.transferCost} onChange={(e) => set('transferCost', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Tour Package">
            <input type="number" value={values.tourCost} onChange={(e) => set('tourCost', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Bank Charge">
            <input type="number" value={values.bankCharge} onChange={(e) => set('bankCharge', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Refund">
            <input type="number" value={values.refund} onChange={(e) => set('refund', Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Total Cost (calculated)">
            <input readOnly value={`PHP ${Math.round(totalCost).toLocaleString('en-PH')}`} className={`${inputClass} bg-sand-50 text-ink-500`} />
          </Field>
          <Field label="Net Profit (calculated)">
            <input readOnly value={`PHP ${Math.round(netProfit).toLocaleString('en-PH')}`} className={`${inputClass} bg-sand-50 text-ink-500`} />
          </Field>
          <Field label="Agent">
            <input value={values.agentName} onChange={(e) => set('agentName', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Zoho Invoice Number">
            <input
              value={values.zohoInvoiceNumber}
              onChange={(e) => set('zohoInvoiceNumber', e.target.value)}
              className={inputClass}
              placeholder="For accounting/reconciliation only"
            />
          </Field>
          <Field label="Remarks">
            <input value={values.remarks} onChange={(e) => set('remarks', e.target.value)} className={inputClass} placeholder="e.g. PAID, DP 36,000…" />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600 disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
