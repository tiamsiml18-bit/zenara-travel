-- ============================================================================
-- Bookings soft-delete support — additive only
--
-- Enables the same soft-delete mechanism already used for quotations
-- (deleted_at / deleted_by, never a real DELETE) to work for bookings too.
-- Does NOT touch, alter, or drop any existing table, column, foreign key,
-- or policy belonging to any other table (quotations, clients, payments,
-- follow_ups, packages, tours, etc.).
-- ============================================================================

-- 1. Add deleted_by, mirroring quotations.deleted_by (which already exists
--    in the live database from an earlier manual change, predating this
--    migration folder's tracked history — this brings bookings to parity
--    with that same pattern). Nullable, so every existing row is
--    unaffected; no data is touched or backfilled.
alter table bookings add column deleted_by uuid references users(id);

-- 2. Replace the single combined bookings_all policy with three separate
--    policies — mirroring quotations' quotations_select / quotations_insert
--    / quotations_update split exactly:
--
--    The original bookings_all was `for all using (deleted_at is null and
--    (...))` with no separate WITH CHECK. Postgres reuses a FOR ALL
--    policy's USING expression as the WITH CHECK for writes when no
--    explicit WITH CHECK is given — so every UPDATE's new row was ALSO
--    required to satisfy "deleted_at is null", which made it structurally
--    impossible to ever set deleted_at to a non-null value. This is the
--    exact obstacle that blocked booking soft-delete from working at all.
--
--    Splitting into separate policies fixes that while changing nothing
--    else about who can read, insert, or update a booking:
--    - bookings_select: identical authorization rule, unchanged, still
--      requires deleted_at is null (a deleted booking stays invisible).
--    - bookings_insert: mirrors quotations_insert, preserving the existing
--      "convert quotation to booking" capability (an INSERT into bookings)
--      that would otherwise have zero applicable policy left and silently
--      break once bookings_all is dropped.
--    - bookings_update: identical authorization rule (admin, or the
--      assigned agent), with deleted_at deliberately NOT part of the
--      check — this is the one and only change in who-can-do-what, and it
--      only affects the ability to write deleted_at itself, not any other
--      column or any other user's access.
--
--    No policy for DELETE is created — same as quotations — so a hard
--    `DELETE FROM bookings` remains impossible under RLS for any role
--    other than the service-role key (which this feature never uses).
drop policy bookings_all on bookings;

create policy bookings_select on bookings for select using (
  deleted_at is null and (auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids()))
);

create policy bookings_insert on bookings for insert with check (
  auth_user_role() in ('admin', 'manager', 'agent')
);

create policy bookings_update on bookings for update using (
  auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids())
);
