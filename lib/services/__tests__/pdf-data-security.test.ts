import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * This is the single highest-stakes invariant in the whole app: supplier
 * cost, markup, and profit must never be reachable from the code path that
 * produces the client-facing PDF (or, by extension, any client-facing view).
 * The schema already isolates this data into its own table
 * (quotation_pricing_internal) with its own RLS policy, but that only
 * protects against a bad *query* — it does nothing to stop a future edit to
 * pdf-data.ts from innocently adding `pricing:quotation_pricing_internal(*)`
 * to a select string to "just show one more field."
 *
 * Rather than trying to assert this via a mocked Supabase client (which
 * would only prove the mock behaves as configured, not that the real query
 * is safe), this test reads the actual source of the PDF data-fetching
 * module and asserts it never mentions the forbidden table or columns
 * anywhere. It is intentionally a blunt, source-level check — the point is
 * that ANY future PR introducing so much as the string "supplier_cost" into
 * this file should fail CI immediately, before anyone has to notice it in
 * code review.
 */
describe('PDF data path — pricing isolation (security regression guard)', () => {
  const rawSource = readFileSync(join(__dirname, '..', 'pdf-data.ts'), 'utf-8');
  // Strip comments before scanning — this file's own doc comments legitimately
  // *explain* why these terms are excluded (as this very comment block does),
  // and that prose shouldn't itself trip the guard. Only actual code (a
  // select string, a property access, a variable name) should fail this.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  const forbiddenTerms = [
    'quotation_pricing_internal',
    'supplier_cost',
    'markup',
    'profit',
    'profit_margin_pct',
  ];

  for (const term of forbiddenTerms) {
    it(`never references "${term}"`, () => {
      expect(source).not.toContain(term);
    });
  }

  it('only exposes price_per_person and total_price as pricing fields', () => {
    // Sanity check that the file does still expose SOME pricing — proving
    // the test isn't trivially passing because pricing was removed entirely.
    expect(source).toContain('price_per_person');
    expect(source).toContain('total_price');
  });
});
