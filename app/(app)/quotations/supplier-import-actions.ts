'use server';

import { requireUser } from '@/lib/auth/session';
import { extractFromSupplierUrl } from '@/lib/services/supplier-import';
import type { ExtractionResult } from '@/lib/suppliers/types';

/**
 * Any authenticated agent can use this — it never writes anything, just
 * fetches a public page and returns a structured (editable) draft. The
 * quotation itself is only ever created/saved through the normal wizard
 * submit path, so nothing here can create or send a quotation on its own,
 * per spec.
 */
export async function extractSupplierUrlAction(url: string): Promise<ExtractionResult> {
  await requireUser();

  if (!url || url.trim().length === 0) {
    return { ok: false, data: null, warnings: [], error: 'Paste a supplier URL first.' };
  }

  return extractFromSupplierUrl(url);
}
