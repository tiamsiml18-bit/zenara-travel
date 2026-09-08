'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HistoricalSaleForm } from './historical-sale-form';

export function AddHistoricalSaleButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
      >
        + Add Historical Sale
      </button>
      {open && (
        <HistoricalSaleForm
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
