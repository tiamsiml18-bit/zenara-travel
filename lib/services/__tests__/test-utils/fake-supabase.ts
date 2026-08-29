/**
 * A deliberately minimal fake of the Supabase query builder — just enough
 * chainable surface (.from/.select/.eq/.single/.insert/.update/.rpc) for the
 * handful of service-layer tests that need to assert business-rule behavior
 * (e.g. "refuses to convert a non-confirmed quotation") without spinning up
 * a real Postgres instance. This is intentionally not a general-purpose
 * mock — it returns whatever `singleResult` / `rpcResult` the test configures
 * regardless of which table/columns were requested, so it's only suitable
 * for tests that care about one call's outcome, not multi-step data flow.
 * True end-to-end correctness (RLS, triggers, the numbering sequence's
 * concurrency safety) is out of scope for unit tests and belongs in a
 * migration-backed integration suite against a real Supabase project —
 * see TESTING.md.
 */
export function createFakeSupabaseClient(config: {
  singleResult?: { data: unknown; error: unknown };
  rpcResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
}) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    single: async () => config.singleResult ?? { data: null, error: null },
    insert: () => ({
      select: () => ({
        single: async () => config.insertResult ?? { data: null, error: null },
      }),
    }),
    update: () => chain,
  };

  return {
    from: () => chain,
    rpc: async () => config.rpcResult ?? { data: null, error: null },
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}
