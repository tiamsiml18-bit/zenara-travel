import type { SupplierAdapter } from './types';
import { klookAdapter } from './klook-adapter';
import { genericAdapter } from './generic-adapter';

/**
 * Ordered most-specific-first. To support a new supplier: write a new
 * adapter file implementing SupplierAdapter and add it here, above
 * genericAdapter. Nothing else in the codebase needs to change — the
 * orchestration layer (lib/services/supplier-import.ts) only ever calls
 * `findAdapterForUrl`, never references a specific supplier by name.
 */
const ADAPTERS: SupplierAdapter[] = [klookAdapter];

export function findAdapterForUrl(url: URL): SupplierAdapter {
  return ADAPTERS.find((adapter) => adapter.matches(url)) ?? genericAdapter;
}
