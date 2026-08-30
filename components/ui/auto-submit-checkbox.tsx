'use client';

export function AutoSubmitCheckbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-700">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      {label}
    </label>
  );
}
