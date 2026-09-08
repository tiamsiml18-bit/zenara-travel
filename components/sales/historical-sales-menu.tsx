'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuButton, DropdownMenuLink } from '@/components/ui/dropdown-menu';
import { HistoricalSaleForm } from './historical-sale-form';

/**
 * Same two actions, same underlying behavior (HistoricalSaleForm modal /
 * link to the import wizard) as the previous separate buttons — only the
 * grouping/trigger changed, per spec ("functionality must remain exactly
 * the same").
 */
export function HistoricalSalesMenu() {
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <DropdownMenu label="Historical Sales">
        <DropdownMenuButton onClick={() => setFormOpen(true)}>Add Historical Sale</DropdownMenuButton>
        <DropdownMenuLink href="/sales/import">Import Historical Sales</DropdownMenuLink>
      </DropdownMenu>
      {formOpen && (
        <HistoricalSaleForm
          onClose={() => {
            setFormOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
