# Zenara Travel and Tours — Platform

Phases delivered so far: **1–19 — the full plan.** Architecture, schema, auth,
roles, app shell, client management, quotation creation, package library, PDF
generation, follow-up CRM, booking & payment tracking, revision UI, dashboard
& reports, Excel client import, supplier URL import, admin settings/user
management/global search, a real security and performance review (with actual
bugs found and fixed — see below), a unit test suite, and deployment
documentation. See `ARCHITECTURE.md` for the phase-by-phase history,
`TESTING.md` for test coverage and its honest limits, and `DEPLOYMENT.md` for
the go-live runbook.

## Local setup

1. Create a Supabase project.
2. Run the migration:
   ```
   supabase db push
   # or paste database/migrations/0001_init.sql into the SQL editor
   ```
3. Copy `.env.example` to `.env.local` and fill in your project's URL/keys.
4. Create the four initial users in Supabase Auth (email/password), then insert
   matching rows into `public.users` with the right `role`:
   ```sql
   insert into users (id, full_name, email, role) values
     ('<leo-auth-uid>',  'Leo',  'leo@zenaratravel.com',  'agent'),
     ('<anne-auth-uid>', 'Anne', 'anne@zenaratravel.com', 'agent'),
     ('<kirsi-auth-uid>','Kirsi','kirsi@zenaratravel.com','agent'),
     ('<jc-auth-uid>',   'JC',   'jc@zenaratravel.com',   'agent');
   -- promote whichever of these should be admin:
   -- update users set role = 'admin' where email = 'leo@zenaratravel.com';
   ```
5. `npm install`
6. `npm run dev`

## What's live right now

- Login / forgot password / reset password, backed by Supabase Auth.
- Middleware-based route protection (redirects unauthenticated requests to `/login`).
- Role model (`admin` / `manager` / `agent`) enforced at the database level via RLS —
  see `lib/auth/session.ts` for the server-side helpers (`requireUser`, `requireRole`).
- App shell: sidebar (role-aware nav, follow-up badge count), topbar (search stub,
  sign out), dashboard placeholder.
- **Clients**: searchable/filterable/paginated list, profile page (info, activity
  timeline, notes, quotation history), create/edit form, inline "quick create"
  used from inside the quotation wizard.
- **Quotations**: 6-step creation wizard (client → package/custom → trip details →
  itinerary → inclusions/exclusions → review), atomic quotation numbering
  (`QT-2026-00001`, race-safe via a DB-level sequence function), hide/show toggle
  for internal supplier cost & markup so it's never shown by accident, send flow
  (locks the version, updates client status, generates the follow-up schedule),
  revise flow (creates a new immutable-once-sent version), duplicate flow (new
  quotation number, original untouched).
- **Follow-up CRM**: `/followups` dashboard with Due Today / Overdue / Upcoming /
  Completed tabs (horizontally scrollable — this is the page agents check from
  their phones, per spec). Follow-up schedule auto-generated on send (day
  1/3/7/14, configurable in `quotation_settings`). Each card has every action
  the spec lists: Open Client, Open Quotation, Mark Complete, Reschedule, Add
  Note, Copy Follow-up Message, Open Messenger, Open WhatsApp, Send Email —
  nothing sends automatically, the agent always does that manually and the app
  just prepares the message and the deep link.
- **Bookings & payments**: `Convert to Booking` appears on a quotation once
  it's Confirmed; the booking copies a snapshot of the confirmed version and
  never touches the quotation. Booking detail page shows trip info, a status
  selector, and a running payment ledger — `payment_status` (unpaid/partial/paid)
  is always derived from the sum of recorded payments, never set by hand, so it
  can't drift out of sync. Deliberately simple, with an explicit note that
  detailed accounting stays in Zoho.
- **Revision flow fix**: the wizard's "Create revision" path is now fully wired
  (`/quotations/[id]/revise`) and correctly calls the revise action instead of
  create — this was a latent bug from the original scaffold (the step
  indicator and Back button also now correctly respect revise mode's shorter
  step sequence instead of exposing the client/package steps, which shouldn't
  change on a revision).
- **Packages**: admin/manager-managed template library (list with active/inactive
  filter, create/edit reusing the same itinerary builder and inclusions/exclusions
  UI from the quotation wizard). Editing a package template never retroactively
  changes quotations already created from it — they hold their own copied snapshot.
- **PDF generation**: `Download PDF` on the quotation page streams a generated,
  client-safe PDF (`app/api/quotations/[id]/pdf/route.ts`). The rendering path
  (`lib/services/pdf-data.ts` → `pdf/quotation-pdf-document.tsx`) is hand-written
  to only ever select client-facing columns — it has no code path that can reach
  `quotation_pricing_internal`, so internal cost/markup/profit cannot leak into
  a PDF even by future accident. Styled as a brochure (agency header, itinerary,
  inclusions/exclusions, one price block, terms, agent contact footer) rather
  than an invoice, per spec.
- **Dashboard & reports**: KPI row (leads, quotes sent/pending, follow-ups due,
  confirmed bookings, lost leads, quoted/confirmed/collected value, outstanding
  balance, conversion rate), monthly quotation/booking charts, top destinations
  and lead source breakdowns, and a per-agent performance table. Backed by SQL
  views (`database/migrations/0003_reporting_views.sql`) declared with
  `security_invoker = true` so RLS on the underlying tables still applies per
  caller — an agent's dashboard is automatically scoped to their own data with
  no extra app-layer filtering needed. Estimated/actual profit is a separate,
  explicitly admin/manager-gated call that never shares a code path with the
  general KPIs, matching the pricing-isolation pattern used for the PDF. The
  `/reports` page's date/agent/destination/status/source filter bar applies to
  every chart and KPI, not just the headline numbers — filtering the monthly
  volume, top-destinations, and lead-source charts falls back to grouping the
  filtered rows in memory rather than the precomputed view when any filter is
  active, since the views can't be parameterized; see the scale note in the
  migration for when to promote this to a proper filtered RPC.
- **Excel client import** (`/admin/import`, admin only): drag-and-drop
  .xlsx/.xls/.csv upload, parsed entirely in-browser (nothing touches the
  server until the final confirm). Auto-suggests a column mapping from
  header text (Name/Full Name → full name, Phone/Mobile → mobile number,
  etc.), then a review screen buckets every row into **Valid / Duplicate /
  Invalid** before anything is written — duplicates are caught both within
  the file itself and against existing clients in the database (checked via
  two batched `IN (...)` queries, not one query per row). Validation runs in
  chunks with a yield back to the browser between them so a several-thousand-
  row sheet doesn't freeze the tab. The commit step batches inserts (500 rows
  per batch) and seeds each new client's activity timeline, matching what a
  manually-created client gets.
- **Supplier URL import** (wired into the quotation wizard's "Package" step,
  alongside Existing Package / New Custom Package): paste a public package
  URL, the server fetches it (respecting `robots.txt`, with a light SSRF
  guard against internal/private addresses, response size/time caps, and a
  clearly-identified bot user agent), and runs it through a supplier adapter.
  Built as `lib/suppliers/{types,registry,generic-adapter,klook-adapter}.ts`
  so a second real supplier is one new file + one registry line, never a
  branch in the orchestration code. Everything extracted — title, duration,
  itinerary, inclusions/exclusions, pickup, meals, notes — lands on an
  editable review screen (reusing the same itinerary builder and tag inputs
  as the rest of the app) and is only applied to the draft once the agent
  clicks "Use this data"; nothing is fetched-and-saved automatically, and a
  failed extraction (blocked by robots.txt, login-walled, page not found,
  nothing structured found) shows a clear reason and a manual-entry fallback
  instead of a raw error. The Klook adapter is upfront in its own comments
  about a real constraint: Klook's activity pages are a client-rendered SPA,
  so a plain server fetch only reliably sees the static SEO shell (title,
  meta description, sometimes JSON-LD) — it does not attempt to execute
  JavaScript or otherwise simulate a browser, which would cross into
  bypassing the site's normal access model.

## Phases 16–19: security review, performance review, tests, deployment prep

Unlike the earlier phases, this wasn't a documentation pass — an actual
`npm install`, `npx tsc --noEmit`, `npx vitest run`, and `npx next build`
were run against the full codebase, which caught real bugs no amount of
reading the code would have surfaced:

- **Would have broken PDF generation entirely**: `pdf-data.ts` queried
  `quotation.current_version_id` without selecting that column.
- **Two build-breaking React-version mismatches**: `useActionState` (React 19)
  used in a React 18.3 project, and a plain client function passed to
  `<form action={fn}>` (also React 19-only) in the admin users screen — both
  fixed with the React-18-compatible `useFormState`/`useFormStatus`/`onSubmit`
  equivalents.
- **Build-breaking**: `<style jsx>` used without `'use client'` in a Server
  Component — fixed by removing styled-jsx in favor of plain Tailwind classes
  (and the component gets to stay a zero-JS Server Component as a result).
  Confirmed via a real `next build`, not just `tsc`.
- Several unguarded array/regex-index accesses (itinerary reordering,
  robots.txt parsing, the supplier adapters) that `noUncheckedIndexedAccess`
  flagged as edge-case crashes waiting to happen.
- Two `<Pagination>` call sites silently dropping active filters on page
  navigation (missing a required prop).
- Three genuinely missing pages that the sidebar/topbar already linked to:
  `/admin/settings` (agency configuration), `/admin/users` (role/manager/
  active-status management), and `/search` (global search across clients and
  quotations, correctly handling the PostgREST `!inner`-join gotcha for
  filtering by an embedded field).

A dedicated unit test suite (62 tests) now covers Excel import validation,
follow-up scheduling (including UTC/timezone regression guards), client and
quotation validation, the "only confirmed quotations convert to bookings"
rule, and — the single most load-bearing test in the repo — a source-level
regression guard asserting the PDF data path can never reference internal
pricing columns, so a future PR can't reintroduce that leak without CI
catching it immediately. See `TESTING.md` for exactly what is and isn't
covered, and why (RLS policies, the immutability trigger, and the numbering
sequence's concurrency safety are real guarantees but need a live Postgres
instance to test meaningfully, not a JS unit suite with a mock).

`DEPLOYMENT.md` has the full go-live runbook: migration order, provisioning
the four initial users, environment variables, and a post-deploy checklist.

## Remaining opportunities for a future phase

- **Integration/E2E test suite** against a real (or local) Supabase instance
  — the unit suite intentionally doesn't try to validate RLS policies, the
  sent-quotation immutability trigger, or the numbering sequence's
  concurrency safety, since those need a live Postgres instance to test
  meaningfully. See `TESTING.md` for the specific scope this should cover.
- **Self-serve user invites** — new teammates are currently provisioned
  manually in the Supabase dashboard, then managed from `/admin/users`. Worth
  automating with the Auth admin API once onboarding is frequent enough to
  matter (see `lib/services/users.ts`'s doc comment for the reasoning).
- Everything under "Future architecture" in `ARCHITECTURE.md` — hotel/tour
  databases, agent commissions, email/WhatsApp/Messenger automation, n8n
  webhooks, a customer-facing portal, Zoho integration — none of which the
  spec asked for in v1, and the schema/service-layer separation was
  deliberately kept clean so none of it requires re-architecting to add later.

## Security notes for anyone extending this

- Never import `lib/supabase/server-admin.ts` outside `lib/services/*`.
- Any new table needs RLS enabled + a policy before it ships — there is no
  table in this schema left open by default.
- Internal pricing (`quotation_pricing_internal`) must never be joined into
  a query that also feeds the client-facing PDF or quotation view.
