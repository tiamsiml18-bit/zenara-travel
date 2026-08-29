/**
 * With `types/database.ts` currently a placeholder (`Database = any` — see
 * that file's own doc comment), supabase-js can't know the cardinality of an
 * embedded to-one relationship (e.g. `agent:users!fk (...)`) from the schema,
 * so its generic type inference defaults to typing every embed as an array.
 * At runtime this is harmless — PostgREST determines cardinality from the
 * actual foreign key, not from TypeScript's guess, so a many-to-one embed
 * really does come back as a single object. This helper makes that explicit
 * at the two or three call sites affected, rather than sprinkling `as any`
 * through the codebase. Once real generated types replace the placeholder
 * (`supabase gen types typescript ...`), these call sites can drop the
 * helper entirely — supabase-js will infer the correct shape on its own.
 */
export function unwrapToOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
