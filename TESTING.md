# Testing — what's covered, what isn't, and why

62 tests, all passing (`npm test`). Run `npx tsc --noEmit` and `npm run build`
too — both are verified clean as of this writing (see the note on Google
Fonts below if `npm run build` fails in a network-restricted environment).

## What's covered

**Pure logic (`lib/validation/__tests__/`, 43 tests)** — the cheapest, most
valuable tests to have, since they need no database and can't rot silently:
- `client.test.ts` — client creation validation, including the "source/status/
  agent are required by design" rule (every real call site always supplies
  them; a client with none would be invisible in most RLS-scoped views).
- `quotation.test.ts` — price calculations and required-field validation on
  the quotation draft schema, itinerary day validation.
- `import.test.ts` — Excel import: header auto-mapping (including the exact
  header variants named in the spec), row validation, currency/date parsing,
  the "unrecognized status/agent/source warns but still imports" rule.

**Follow-up scheduling (`lib/services/__tests__/followups.test.ts`, 9 tests)**
 — `computeFollowUpDueDates` is deliberately a pure function (no Supabase
client) specifically so it could be unit tested, including a regression guard
for UTC-vs-local-time date math (a classic off-by-one-day bug class) and
month/year rollover.

**Service-layer business rules with a fake Supabase client (7 tests)**:
- `bookings.test.ts` — "only a confirmed quotation converts to a booking" is
  tested against draft, sent, nonexistent, and confirmed states.
- `pdf-data-security.test.ts` — the single most important test in this repo.
  It's a source-level regression guard asserting `lib/services/pdf-data.ts`
  never mentions `quotation_pricing_internal`, `supplier_cost`, `markup`, or
  `profit` anywhere outside a comment. The point isn't proving today's code
  is safe (a manual review already does that) — it's making sure a future PR
  that innocently adds one more field to that select string fails immediately
  and loudly, rather than shipping a pricing leak that only gets caught by
  someone happening to notice it in review.

`lib/services/__tests__/test-utils/fake-supabase.ts` is a deliberately
minimal fake query builder — enough chainable surface for these specific
tests, not a general-purpose mock. It's not trying to prove RLS or triggers
work; see below for what actually validates those.

## What's NOT covered by this suite, and where that coverage actually lives

- **Quotation number allocation's concurrency safety** — the atomic,
  race-safe part of `allocate_quotation_number()` is a Postgres function with
  row-level locking (`database/migrations/0002_numbering_functions.sql`).
  That guarantee is meaningless to test in JS with a mock; it needs a real
  Postgres instance and concurrent connections. If you want to verify it,
  the honest way is a migration-backed integration test (e.g. via
  `supabase start` locally) that fires N concurrent `rpc()` calls and asserts
  N distinct numbers come back — not a unit test.
- **RLS policies** — every claim in `ARCHITECTURE.md`'s security model
  ("agents only see their own data," "pricing requires admin/manager/owner")
  is enforced by Postgres, not application code. Testing it properly means
  hitting a real (or local) Supabase project with real JWTs for each role and
  asserting query results — again, an integration concern, not a unit test.
- **The "sent version is immutable" trigger** — same story: it's a database
  trigger (`prevent_sent_version_mutation`), correctly un-testable from a JS
  unit suite in any way that would actually catch a regression in the SQL
  itself.
- **Permission-check helpers** (`requireUser`/`requireRole` in
  `lib/auth/session.ts`) — these are thin wrappers around `next/headers`
  cookies and `redirect()`, which makes them awkward to unit test in a way
  that proves anything beyond "the mock does what I told it to." They're
  better covered by an end-to-end test (Playwright, hitting real routes as
  each role) than a unit test with a faked Next.js request context.
- **PDF rendering itself** (does the generated PDF *look* right) — the
  security-relevant part (it can't contain pricing) is covered; visual
  correctness of the `@react-pdf/renderer` output is a visual-regression /
  manual-QA concern, not a unit-test concern.

**If a Phase 20 ever happens**, the highest-value next investment isn't more
unit tests — it's a small integration suite against a real local Supabase
instance (via `supabase start`) covering exactly the four bullets above, plus
a handful of Playwright smoke tests for the core workflow (create client →
create quotation → send → follow-up appears → convert to booking → PDF
downloads and contains no pricing). That's genuinely a different, heavier
kind of test infrastructure than what's here, and deliberately wasn't built
speculatively before there's a real Supabase project to point it at.

## A note on `npm run build` in a network-restricted environment

`next/font/google` fetches font files from `fonts.googleapis.com` at build
time. In a sandboxed CI environment without general internet access, this
step will fail with a `NextFontError` — that's an environment limitation, not
a code bug (verified during this project's own review process by temporarily
swapping to system fonts, at which point the build completed cleanly with
zero errors). On Vercel, or any environment with normal internet access, this
resolves itself with no changes needed.
