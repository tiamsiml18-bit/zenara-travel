'use client';

/**
 * A plain <select onChange={...}> can't live directly in a Server
 * Component page (native DOM event handlers require a Client Component
 * boundary) — this is the smallest possible extraction: just the
 * interactive bit, so the rest of the page stays a Server Component doing
 * its normal data fetching. Submitting the enclosing <form> on change is
 * what makes a filter apply immediately with no separate button.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={className ?? 'rounded-md border border-sand-200 bg-surface px-3 py-2 text-sm'}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
