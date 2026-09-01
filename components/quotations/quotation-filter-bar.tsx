'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/services/pipeline';

// The same six stages Follow-up (pipeline) status uses — one consistent
// status system throughout the CRM.
const STATUS_OPTIONS: PipelineStage[] = ['sent', 'negotiating', 'confirmed', 'paid', 'no_response', 'lost'];

export function QuotationFilterBar({ consultants }: { consultants: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const consultant = searchParams.get('consultant') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const hasActiveFilters = Boolean(status || consultant || from || to);

  /**
   * Every filter change goes through here — builds the next query string
   * from the current one plus this one change, then navigates immediately.
   * Page never needs its own "Filter" submit: this IS the filter action,
   * fired directly from each control's onChange.
   */
  function updateFilter(key: 'status' | 'consultant' | 'from' | 'to', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page'); // any filter change resets back to page 1
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => updateFilter('status', e.target.value)}
        className="rounded-md border border-sand-200 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {PIPELINE_STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      {/* Filters by consultant, not the technical assigned-agent account —
          with one shared login across the team, filtering by assigned
          agent would never narrow anything down, since every quotation has
          the same value there. Consultant is the field that actually
          distinguishes who worked on it. */}
      <select
        value={consultant}
        onChange={(e) => updateFilter('consultant', e.target.value)}
        className="rounded-md border border-sand-200 px-3 py-2 text-sm"
      >
        <option value="">All consultants</option>
        {consultants.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={from}
        onChange={(e) => updateFilter('from', e.target.value)}
        title="Travel date from"
        className="rounded-md border border-sand-200 px-3 py-2 text-sm"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => updateFilter('to', e.target.value)}
        title="Travel date to"
        className="rounded-md border border-sand-200 px-3 py-2 text-sm"
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-ink-500 hover:bg-sand-100 hover:text-ink-900"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}
