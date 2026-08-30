'use client';

export function AutoSubmitDateInput({
  name,
  defaultValue,
  title,
}: {
  name: string;
  defaultValue?: string;
  title?: string;
}) {
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      title={title}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-md border border-sand-200 px-3 py-2 text-sm"
    />
  );
}
