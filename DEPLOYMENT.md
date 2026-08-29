# Deployment guide

## 1. Create the Supabase project

1. New project at supabase.com.
2. Run the migrations in order via the SQL editor, or `supabase db push` if
   using the CLI:
   - `database/migrations/0001_init.sql` — schema, RLS, seed config rows.
   - `database/migrations/0002_numbering_functions.sql` — quotation/booking
     number allocation.
   - `database/migrations/0003_reporting_views.sql` — dashboard/report views.
3. Create a private Storage bucket named `quotation-files` (Storage → New
   bucket → uncheck "Public bucket"). Nothing currently uploads to it — it's
   provisioned for the `files` table's future use — but create it now so the
   bucket name is reserved and matches what the schema expects.

## 2. Create the four initial users

Supabase Auth doesn't let you set a `public.users` row from the SQL editor
alone — the `auth.users` row must exist first.

1. Authentication → Users → Add user, for each of Leo, Anne, Kirsi, JC (email
   + password, or send an invite).
2. Copy each generated `auth.users.id`, then in the SQL editor:
   ```sql
   insert into users (id, full_name, email, role) values
     ('<leo-uid>',   'Leo',   'leo@zenaratravel.com',   'admin'),
     ('<anne-uid>',  'Anne',  'anne@zenaratravel.com',  'agent'),
     ('<kirsi-uid>', 'Kirsi', 'kirsi@zenaratravel.com', 'agent'),
     ('<jc-uid>',    'JC',    'jc@zenaratravel.com',    'agent');
   ```
   Adjust roles as appropriate — the spec doesn't say which of the four
   should be admin; pick one (or more) as the agency prefers. Role and
   manager assignment can be changed anytime afterward from `/admin/users`.

## 3. Configure agency settings

Log in as an admin and fill in `/admin/settings` — agency name, contact
info, logo URL, terms and conditions, payment instructions, quotation number
prefix. These feed directly into every generated quotation PDF.

## 4. Environment variables

Copy `.env.example` to `.env.local` for local dev, or set these in the
Vercel project settings for production:

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API | **No — server only** |
| `NEXT_PUBLIC_SITE_URL` | Your production domain (for password-reset redirect links) | Yes |

The service role key bypasses RLS entirely. It's used in exactly one place
in this codebase (`lib/supabase/server-admin.ts`) and, as of this delivery,
isn't actually invoked by any route yet — it's provisioned for future
admin-only operations (e.g. inviting a user via the Auth admin API) that need
it. Treat any new import of that file as a security review item.

## 5. Deploy to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import into Vercel, framework preset "Next.js" (auto-detected).
3. Add the four environment variables above.
4. Deploy. `next/font/google` needs outbound internet access at build time
   (Vercel's build environment has this by default — no action needed there).

## 6. Post-deploy checklist

- [ ] Log in as each of the four users and confirm role-appropriate sidebar
      items appear (Admin section only for admins).
- [ ] Create a test client, create a test quotation, send it, confirm a
      follow-up was scheduled, download the PDF and confirm it contains no
      pricing/cost/markup figures.
- [ ] Confirm an agent account cannot see another agent's clients (log in as
      two different agents in two browser sessions).
- [ ] Run the Excel import against a small (5-10 row) real or sample file
      before trusting it with the full historical client list.
- [ ] Set Supabase Auth's site URL and redirect URLs (Authentication → URL
      Configuration) to match the production domain, or password reset links
      will point at `localhost`.

## Known gaps to close before relying on this in production

These are documented, not hidden — see `README.md`'s "Not yet built" section
and `TESTING.md` for the full list. The two most worth prioritizing first:

1. **No integration/E2E test suite yet** — the unit tests cover business
   logic and one critical security invariant (pricing isolation in the PDF
   path), but RLS policies, the immutability trigger, and the numbering
   sequence's concurrency safety are only validated by manual review and the
   database migration's own design, not by an automated test that would
   catch a regression. See `TESTING.md` for what a Phase 20 integration suite
   should cover.
2. **No user self-invite flow** — new teammates are provisioned manually in
   the Supabase dashboard (see step 2 above), then managed from `/admin/users`
   thereafter. Fine for a four-person team growing slowly; worth automating
   with the Auth admin API once onboarding becomes frequent enough to matter.
