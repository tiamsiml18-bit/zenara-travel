'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExpenseForm } from './expense-form';

export function AddExpenseButton({
  categories,
  creditCards,
}: {
  categories: { id: string; name: string }[];
  creditCards: { id: string; card_name: string; last_four: string }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-harbor-700 px-3 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600">
        + Add Expense
      </button>
      {open && (
        <ExpenseForm
          categories={categories}
          creditCards={creditCards}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
