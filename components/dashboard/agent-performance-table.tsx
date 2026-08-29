export interface AgentPerformanceRow {
  agent_id: string;
  agent_name: string;
  leads_assigned: number;
  quotes_created: number;
  quotes_sent: number;
  followups_completed: number;
  bookings_confirmed: number;
  confirmed_sales_value: number;
  conversion_rate_pct: number;
}

function formatMoney(n: number) {
  return `PHP ${Number(n).toLocaleString('en-PH')}`;
}

export function AgentPerformanceTable({ rows }: { rows: AgentPerformanceRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-sand-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-sand-200 bg-sand-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3 text-right">Leads</th>
            <th className="px-4 py-3 text-right">Quotes created</th>
            <th className="px-4 py-3 text-right">Quotes sent</th>
            <th className="px-4 py-3 text-right">Follow-ups done</th>
            <th className="px-4 py-3 text-right">Bookings</th>
            <th className="px-4 py-3 text-right">Sales value</th>
            <th className="px-4 py-3 text-right">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.agent_id} className="border-b border-sand-100 last:border-0">
              <td className="px-4 py-3 font-medium text-ink-900">{r.agent_name}</td>
              <td className="px-4 py-3 text-right text-ink-700">{r.leads_assigned}</td>
              <td className="px-4 py-3 text-right text-ink-700">{r.quotes_created}</td>
              <td className="px-4 py-3 text-right text-ink-700">{r.quotes_sent}</td>
              <td className="px-4 py-3 text-right text-ink-700">{r.followups_completed}</td>
              <td className="px-4 py-3 text-right text-ink-700">{r.bookings_confirmed}</td>
              <td className="font-ticket px-4 py-3 text-right text-ink-900">{formatMoney(r.confirmed_sales_value)}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-ticket rounded-full bg-harbor-100 px-2 py-0.5 text-xs font-medium text-harbor-700">
                  {r.conversion_rate_pct}%
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-ink-500">
                No agent activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
