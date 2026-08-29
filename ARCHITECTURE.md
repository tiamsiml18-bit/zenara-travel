# Zenara Travel and Tours — Platform Architecture
**Phase 1–3 Deliverable: System Architecture, Database Schema, Role Model, Implementation Plan**

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js (App Router)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Server       │  │  Server       │  │  Client Components│  │
│  │  Components   │  │  Actions      │  │  (forms, tables,   │  │
│  │  (data reads) │  │  (mutations)  │  │  itinerary builder)│  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
└─────────┼──────────────────┼───────────────────┼──────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
   ┌──────────────────────────────────────────────────┐
   │           lib/services/*  (business logic)         │
   │  clients, quotations, versions, packages,           │
   │  followups, bookings, payments, pdf, imports,        │
   │  suppliers, reports, audit                           │
   └───────────────────────┬────────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────┐
   │        Supabase (Postgres + Auth + Storage)         │
   │  RLS-enforced tables · service-role only on server  │
   │  Auth (email/password) · Storage (private buckets)  │
   └──────────────────────────────────────────────────┘
```

**Key architectural rules**
- All privileged mutations (writes, pricing, status transitions, PDF generation) happen in **Server Actions / Route Handlers**, never client-side, so the Supabase **service role key never reaches the browser**.
- The browser only ever talks to Supabase directly for reads that are safe under RLS using the **anon key** (e.g., own profile, assigned records) — everything sensitive is proxied through the server.
- Business logic lives in `lib/services/*`, not in components or route handlers, so the same logic is reusable for future n8n webhooks, cron jobs, and API endpoints.
- Every entity that can be "sent" to a client (quotations) is **append-only once sent** — enforced both at the service layer and via a Postgres trigger that blocks UPDATE on `quotation_versions` rows whose status is no longer `draft`.

---

## 2. Application Folder Structure

```
zenara/
├── app/
│   ├── (auth)/login, forgot-password, reset-password
│   ├── (app)/                     # authenticated shell w/ sidebar
│   │   ├── dashboard/
│   │   ├── clients/[id]/
│   │   ├── quotations/[id]/{edit,revise,pdf}/
│   │   ├── quotations/new/
│   │   ├── followups/
│   │   ├── bookings/[id]/
│   │   ├── packages/[id]/
│   │   ├── reports/
│   │   └── admin/{users,settings,lead-sources,statuses,import}/
│   └── api/
│       ├── quotations/[id]/pdf/route.ts
│       ├── imports/clients/route.ts
│       ├── suppliers/extract/route.ts
│       └── webhooks/ (future n8n)
├── components/           # dumb/presentational, shadcn-based
├── lib/
│   ├── services/          # business logic (see §7)
│   ├── supabase/          # server client, browser client, middleware client
│   ├── auth/               # role/permission helpers
│   └── validation/         # zod schemas
├── database/
│   └── migrations/         # SQL, versioned
├── pdf/                    # quotation PDF template + renderer
├── imports/                 # excel column mapping + validators
├── suppliers/                # adapter interface + klook adapter
├── types/                    # generated DB types + domain types
└── hooks/
```

---

## 3. Role & Permission Model

| Capability | Admin | Manager | Agent |
|---|---|---|---|
| View all clients/quotations | ✅ | Team only | Own only |
| Create/edit clients | ✅ | ✅ (team) | ✅ (own) |
| Create/send/revise quotations | ✅ | ✅ (team) | ✅ (own) |
| View internal pricing (cost/markup/profit) | ✅ | ✅ | Configurable per-agent flag (default: own quotes only) |
| Manage packages | ✅ | ✅ | View only |
| Manage users/settings | ✅ | ❌ | ❌ |
| View reports | ✅ (all) | ✅ (team) | ✅ (own) |
| Excel import | ✅ | ❌ | ❌ |

Roles are stored on `users.role` and mirrored into a Postgres helper function `auth_role()` / `auth_uid()` used inside RLS policies (see schema). "Team" scoping uses a `manager_id` self-reference on `users`, so a manager sees rows where `assigned_agent_id IN (their reports)`.

---

## 4. Security Model

1. **RLS everywhere** — every business table has RLS enabled; no table is left open. Policies reference `auth.uid()` joined against `users` to resolve role + team.
2. **Service role isolation** — service role key lives only in server env vars (`SUPABASE_SERVICE_ROLE_KEY`), used only inside `lib/supabase/server-admin.ts`, only for operations RLS cannot express cleanly (e.g., quotation number sequence allocation, audit log writes).
3. **Pricing isolation** — cost/markup/profit fields live in a **separate table** (`quotation_pricing_internal`) with its own RLS policy restricted to admin/manager/owning-agent, never joined into any client-facing/PDF query path.
4. **PDF generation is server-side only**, pulling from a dedicated "public view" query that explicitly selects client-safe columns — it physically cannot select internal pricing columns because they live in a different table it never joins.
5. **File storage** — Supabase Storage bucket `quotation-files` is private; access via signed URLs generated server-side, scoped to the requesting user's permission.
6. **Audit log** — every mutation service function writes to `audit_logs` after a successful transaction.
7. **Input validation** — Zod schemas in `lib/validation/*`, shared between client forms and server actions (parse on both ends; never trust client-parsed data).

---

## 5. Quotation Versioning Model (critical)

- `quotations` = the stable "envelope" (one row per quotation number, holds client_id, current status, current_version_id).
- `quotation_versions` = one row per revision (`QT-2026-00001` = version 1, `Rev 2` = version 2, etc.), each holding its own snapshot of client-facing data (client name/destination/dates at time of sending), itinerary, inclusions, exclusions, pricing reference.
- Once a `quotation_versions` row's status leaves `draft` (i.e., becomes `sent`), a DB trigger (`prevent_sent_version_mutation`) blocks further UPDATEs to that row. Any further edit **must** create a new `quotation_versions` row and bump `quotations.current_version_id`.
- **Duplicate** = new `quotations` row (new number) + copy of the current version's content into a fresh `draft` version. Original is untouched.
- **Client-facing snapshot fields** (name, destination, dates as issued) are copied at send-time into the version row itself, so later edits to the `clients` table never retroactively change a historical quotation.

---

## 6. Database Schema — see `database/migrations/0001_init.sql`

Entity relationship summary:

```
users ──< clients ──< client_notes
   │         │  ├──< client_activities
   │         │  └──< quotations
   │         │
   │         └──< quotations ──< quotation_versions ──< quotation_itinerary_days
   │                  │                │  ├──< quotation_inclusions
   │                  │                │  ├──< quotation_exclusions
   │                  │                │  └──< quotation_pricing_internal (1:1)
   │                  │                └──< quotation_items
   │                  ├──< follow_ups
   │                  └──< bookings ──< payments
   │
   └──< packages ──< package_itineraries
                 ├──< package_inclusions
                 └──< package_exclusions

hotels (lightweight lookup, referenced by name+id from quotation_versions)
files (polymorphic: entity_type + entity_id)
audit_logs (polymorphic: entity_type + entity_id)
agency_settings, quotation_settings, client_sources, client_statuses (config tables)
```

Full DDL with indexes, constraints, RLS policies, and triggers is in the migration file.

---

## 7. Service Layer (`lib/services/`)

| Service | Responsibilities |
|---|---|
| `clients.ts` | CRUD, status transitions, activity timeline writes |
| `quotations.ts` | create draft, send, revise (new version), duplicate, status transitions |
| `quotationNumbering.ts` | atomic sequence allocation (`QT-{year}-{seq}`) via Postgres sequence, collision-proof |
| `packages.ts` | package + template itinerary CRUD |
| `pricing.ts` | cost/markup/margin calculations, isolated from client-safe queries |
| `followups.ts` | schedule generation on send, due/overdue/upcoming queries, completion recording |
| `bookings.ts` | convert-from-quotation, status transitions |
| `payments.ts` | add payment, recompute balance/status |
| `pdf.ts` | renders client-safe PDF from a version snapshot |
| `suppliers/` | adapter interface (`extract(url): RawPackageData`) + `klookAdapter.ts`; extraction result always goes through a review step before persistence |
| `imports/excel.ts` | streaming parse, column mapping, dedupe/validate, staged preview before commit |
| `reports.ts` | dashboard aggregates (materialized via SQL views for performance at scale) |
| `audit.ts` | central audit log writer, called by every mutating service |

---

## 8. Core User Flows (traced against DB writes)

**Create & send a quotation**
1. `clients.create()` or select existing → `client_activities` row.
2. `quotations.createDraft()` → `quotations` + `quotation_versions` (status=draft) + itinerary/inclusions/exclusions rows + `quotation_pricing_internal`.
3. `quotations.send()` → version status→sent, `clients.status`→"Quotation Sent", `followups.generateSchedule()` creates 4 `follow_ups` rows (day 1/3/7/14, configurable via `quotation_settings`), `audit_logs` entry.
4. Agent revises → `quotations.reviseVersion()` → new `quotation_versions` row, old one immutable (trigger-enforced).
5. Client confirms → `quotations.markConfirmed()` → `clients.status`→"Confirmed".
6. `bookings.convertFromQuotation()` → new `bookings` row referencing the confirmed version; quotation untouched.
7. `payments.add()` × N → booking payment_status recomputed.

**Follow-up dashboard** reads `follow_ups` joined to `quotations`/`clients`, bucketed by due_date vs today (Due Today / Overdue / Upcoming / Completed), agent-scoped via RLS.

**Excel import**: parse (streamed, worker-friendly) → map columns → validate in-memory → show valid/duplicate/invalid counts → admin confirms → batch insert with `client_activities` seed rows.

**Supplier URL import**: POST to `/api/suppliers/extract` → adapter fetches + parses → returns structured draft (never persisted) → agent edits in review UI → on save, becomes a normal `quotation_versions` payload (or a new `packages` template if agent chooses "save as package").

---

## 9. Performance Strategy (10k+ clients, 50k+ quotations)

- Indexes on all FK columns + `clients(status, assigned_agent_id)`, `quotations(status, client_id)`, `follow_ups(due_date, status)`, full-text index (`pg_trgm`) on client name/phone/email for search.
- All list views are server-paginated (cursor or page+limit), never full-table client fetch.
- Dashboard aggregates backed by SQL views / materialized views refreshed on a schedule, not computed per request.
- Soft delete via `deleted_at` on business-critical tables, filtered out by default in RLS-safe views, excluded from indexes via partial indexes (`WHERE deleted_at IS NULL`).

---

## 10. Implementation Plan (Phases, per your spec)

| Phase | Deliverable | Status |
|---|---|---|
| 1–3 | Architecture, schema, migration | ✅ this delivery |
| 4 | Supabase Auth + role model + middleware | Next |
| 5 | App shell, sidebar, protected routes | Next |
| 6 | Client management (CRUD, timeline, list) | Pending |
| 7 | Quotation creation flow | Pending |
| 8 | Packages + itinerary builder | Pending |
| 9 | PDF generation | Pending |
| 10 | Revision & duplication | Pending |
| 11 | Follow-up CRM | Pending |
| 12 | Bookings & payments | Pending |
| 13 | Dashboard & reports | Pending |
| 14 | Excel import | Pending |
| 15 | Supplier URL extraction (Klook adapter) | Pending |
| 16–19 | Security/perf review, tests, deploy prep | Pending |

**Ambiguity resolutions made (documented per your instruction):**
- Hotels are a lightweight lookup table (name only, no rooms/rates database) per spec — "do not require a detailed hotel database for v1."
- Agent visibility into internal pricing defaults to **their own quotations only**; admins/managers see all. This can be tightened/loosened via a single settings flag.
- Quotation numbering uses a Postgres sequence per year (`QT-2026-00001`) reset logic handled in `quotationNumbering.ts`, guarded by a DB unique constraint as the final backstop against races.
- Client statuses and lead sources are seeded as data rows in config tables (not enums), so admins can edit them without a migration.

---

Next step: I'll proceed to **Phase 4 (Auth/roles) and Phase 5 (app shell)** once you confirm the schema below looks right — or I can just continue straight through if you'd rather review as we go.
