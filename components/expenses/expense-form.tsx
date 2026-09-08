'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { upsertExpenseAction, searchQuotationsForExpenseAction } from '@/app/(app)/expenses/actions';
import {
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_PAYMENT_STATUS_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type ExpensePaymentStatus,
  type ExpensePaymentMethod,
} from '@/lib/validation/expenses';

export interface ExpenseFormValues {
  id?: string;
  expenseDate: string;
  description: string;
  categoryId: string;
  amount: number;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  creditCardId: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  quotationId: string;
  quotationNumber: string;
  bookingId: string;
  bookingNumber: string;
  remarks: string;
}

const EMPTY: ExpenseFormValues = {
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  categoryId: '',
  amount: 0,
  paymentStatus: 'pending',
  paymentMethod: 'cash',
  creditCardId: '',
  dueDate: '',
  clientId: '',
  clientName: '',
  quotationId: '',
  quotationNumber: '',
  bookingId: '',
  bookingNumber: '',
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

export function ExpenseForm({
  initialValues,
  categories,
  creditCards,
  onClose,
}: {
  initialValues?: ExpenseFormValues;
  categories: { id: string; name: string }[];
  creditCards: { id: string; card_name: string; last_four: string }[];
  onClose: () => void;
}) {
  const [values, setValues] = useState<ExpenseFormValues>(initialValues ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Quotation picker — deliberately its own small piece of state, since
  // it drives Customer (never typed directly) and offers a matching
  // Booking, both per spec.
  const [quotationSearch, setQuotationSearch] = useState(values.quotationNumber);
  const [quotationResults, setQuotationResults] = useState<Awaited<ReturnType<typeof searchQuotationsForExpenseAction>>['data']>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!showResults || quotationSearch.trim().length < 2) {
      setQuotationResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const result = await searchQuotationsForExpenseAction(quotationSearch);
      if (result.ok) setQuotationResults(result.data ?? []);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [quotationSearch, showResults]);

  function set<K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function selectQuotation(q: NonNullable<typeof quotationResults>[number]) {
    setValues((v) => ({
      ...v,
      quotationId: q.quotationId,
      quotationNumber: q.quotationNumber,
      // Auto-filled, never typed independently — exactly per spec.
      clientId: q.clientId ?? '',
      clientName: q.clientName ?? '',
      bookingId: q.bookingId ?? '',
      bookingNumber: q.bookingNumber ?? '',
    }));
    setQuotationSearch(q.quotationNumber);
    setShowResults(false);
  }

  function clearQuotation() {
    setValues((v) => ({ ...v, quotationId: '', quotationNumber: '', clientId: '', clientName: '', bookingId: '', bookingNumber: '' }));
    setQuotationSearch('');
  }

  function handleSubmit() {
    setError(null);
    if (!values.description.trim()) {
      setError('Description is required.');
      return;
    }
    startTransition(async () => {
      const result = await upsertExpenseAction({
        id: values.id,
        expenseDate: values.expenseDate,
        description: values.description,
        categoryId: values.categoryId,
        amount: values.amount,
        paymentStatus: values.paymentStatus,
        paymentMethod: values.paymentMethod,
        creditCardId: values.creditCardId,
        dueDate: values.dueDate,
        clientId: values.clientId,
        quotationId: values.quotationId,
        bookingId: values.bookingId,
        remarks: values.remarks,
      });
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
        <h3 className="font-display text-base font-semibold text-ink-900">{values.id ? 'Edit Expense' : 'Add Expense'}</h3>

        {error && <div className="mt-3 rounded-md border border-coral-500/30 bg-coral-500/5 px-3 py-2 text-sm text-coral-600">{error}</div>}

        <div className="mt-4 space-y-3">
          <div className="relative">
            <Field label="Quotation Reference (optional)">
              <input
                value={quotationSearch}
                onChange={(e) => {
                  setQuotationSearch(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Search by quotation number or customer name…"
                className={inputClass}
              />
            </Field>
            {values.quotationId && (
              <button type="button" onClick={clearQuotation} className="mt-1 text-xs text-coral-600 hover:underline">
                Clear quotation link
              </button>
            )}
            {showResults && quotationResults && quotationResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-sand-200 bg-surface shadow-lg">
                {quotationResults.map((q) => (
                  <button
                    key={q.quotationId}
                    type="button"
                    onClick={() => selectQuotation(q)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sand-50"
                  >
                    <span className="font-medium text-ink-900">{q.quotationNumber}</span>
                    <span className="text-ink-500">{q.clientName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer">
              <input readOnly value={values.clientName || 'No customer linked'} className={`${inputClass} bg-sand-50 text-ink-500`} />
            </Field>
            <Field label="Booking (optional)">
              <input readOnly value={values.bookingNumber || '—'} className={`${inputClass} bg-sand-50 text-ink-500`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Expense Date">
              <input type="date" value={values.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <input value={values.description} onChange={(e) => set('description', e.target.value)} className={inputClass} placeholder="e.g. Canva subscription" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input type="number" value={values.amount} onChange={(e) => set('amount', Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Payment Status">
              <select value={values.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value as ExpensePaymentStatus)} className={inputClass}>
                {EXPENSE_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {EXPENSE_PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment Method">
              <select value={values.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as ExpensePaymentMethod)} className={inputClass}>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {EXPENSE_PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </Field>
            {values.paymentMethod === 'credit_card' && (
              <Field label="Credit Card">
                <select value={values.creditCardId} onChange={(e) => set('creditCardId', e.target.value)} className={inputClass}>
                  <option value="">Select a card…</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.card_name} •••• {c.last_four}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Due Date (optional)">
            <input type="date" value={values.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
          </Field>

          <Field label="Remarks">
            <input value={values.remarks} onChange={(e) => set('remarks', e.target.value)} className={inputClass} />
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
