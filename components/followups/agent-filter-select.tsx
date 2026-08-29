'use client';

/**
 * A plain <select onChange={...}> can't live directly in a Server Component
 * page (native DOM event handlers require a Client Component boundary) —
 * that's what was crashing /followups. This is the smallest possible
 * extraction: just the interactive bit, so the rest of the page stays a
 * Server Component doing its normal data fetching.
 */
export function AgentFilterSelect({
  agents,
  defaultValue,
}: {
  agents: { id: string; full_name: string }[];
  defaultValue: string;
}) {
  return (
    <select
      name="agent"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-md border border-sand-200 bg-white px-3 py-2 text-sm"
    >
      <option value="">All agents</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.full_name}
        </option>
      ))}
    </select>
  );
}
