-- ============================================================================
-- Atomic quotation create/update
--
-- Fixes three confirmed bugs in the quotation create/edit workflow,
-- investigated and reproduced against a local replica of production schema
-- before this migration was written:
--
--  1. createDraftQuotation()'s "compensating cleanup" (best-effort
--     `delete from quotations` in its catch block, meant to undo a
--     partially-created quotation on failure) is a silent no-op in
--     production: `quotations` has no DELETE policy for any role, so the
--     delete always matches 0 rows and returns no error. A failure partway
--     through quotation creation left a partially-created quotation sitting
--     in the database while the agent was told creation had failed.
--  2. updateDraftQuotation() (Save/Edit) has no rollback at all: it updates
--     `quotations`/`quotation_versions` first, deletes every child row,
--     then re-inserts them. A failure partway through that re-insert left
--     the quotation's top-level fields changed and its old child rows
--     already gone, while the agent was told the save had failed.
--  3. Both call the same insertVersionChildren() helper, whose ~10 child
--     writes run concurrently (Promise.all) from the Supabase JS client.
--     There is no multi-statement transaction available from that client,
--     so a single failing write could leave some child tables populated
--     and others not, with no way for the application to undo it.
--
-- Fix: move the entire write phase for "create" and "update" into one
-- Postgres function each. A PL/pgSQL function body runs as a single
-- transaction — any exception anywhere inside it aborts the whole function
-- automatically (real ROLLBACK), so either everything the agent submitted
-- is saved, or nothing is. This is the strongest guarantee the current
-- architecture supports (noted in the original code's own "NOTE ON
-- ATOMICITY" comment as the eventual fix), and it requires no RLS policy
-- changes: both functions are `security invoker`, so every statement
-- inside them is still checked against the exact same insert/update/select
-- policies that already governed these tables, evaluated under the calling
-- agent's own session (auth.uid()) exactly as before. No new DELETE policy
-- is added anywhere, and no existing policy is changed.
--
-- `revise_quotation_draft_atomic` is included too since reviseQuotation()
-- shares the same insertVersionChildren() child-write pattern as create,
-- so it has the identical partial-write exposure described in point 3.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Internal helper — not meant to be called directly. Inserts one child
-- table's rows from a JSONB array. Column mapping is delegated to Postgres'
-- own jsonb_populate_recordset (matched against the table's real columns),
-- so this never needs to hardcode each table's column list, only the
-- (whitelisted) table names and the one special case that needs upsert
-- semantics (quotation_tour_pricing, matching the existing
-- onConflict: 'quotation_version_id,source_tour_id' upsert already used by
-- insertVersionChildren() today — same columns, same conflict target).
-- ----------------------------------------------------------------------------
create or replace function _write_quotation_child_rows(p_table text, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cols text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  if p_table not in (
    'quotation_itinerary_days', 'quotation_tour_pricing', 'quotation_airfare_items',
    'quotation_hotel_items', 'quotation_transfer_items', 'quotation_inclusions',
    'quotation_exclusions', 'quotation_flight_segments', 'quotation_fees',
    'quotation_items', 'quotation_guest_pricing', 'quotation_guest_pricing_internal',
    'quotation_pricing_internal'
  ) then
    raise exception 'quotation child write: table % is not allowed', p_table;
  end if;

  -- Explicit column list, taken from the keys actually present on the
  -- first row (every row in the array shares the same shape -- they're
  -- all built from the same TS .map(...) call) rather than `select *`.
  -- jsonb_populate_recordset fills every column of the table's full row
  -- type, including id/created_at/etc that are never in the JSON, as
  -- NULL -- a bare `select *` would insert those NULLs verbatim instead
  -- of letting their column defaults (gen_random_uuid(), now(), ...)
  -- apply, which is exactly the trap this list avoids. This needs no
  -- per-table column names hardcoded: whatever keys the application put
  -- in the JSON (always including quotation_version_id, stamped in by
  -- insert_quotation_version_children_atomic) are exactly the columns
  -- written, same as the existing per-table .insert({...}) calls today.
  select string_agg(quote_ident(key), ', ') into v_cols
  from jsonb_object_keys(p_rows -> 0) as key;

  if p_table = 'quotation_tour_pricing' then
    execute format(
      'insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1) '
      || 'on conflict (quotation_version_id, source_tour_id) do update set '
      || 'tour_name = excluded.tour_name, rate_senior = excluded.rate_senior, '
      || 'rate_adult = excluded.rate_adult, rate_child = excluded.rate_child, '
      || 'rate_infant = excluded.rate_infant, rate_pwd = excluded.rate_pwd, '
      || 'sort_order = excluded.sort_order',
      p_table, v_cols, v_cols, p_table
    ) using p_rows;
    return;
  end if;

  execute format(
    'insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1)',
    p_table, v_cols, v_cols, p_table
  ) using p_rows;
end;
$$;

comment on function _write_quotation_child_rows(text, jsonb) is
  'Internal helper for the *_quotation_draft_atomic functions only — not meant to be called directly.';

-- ----------------------------------------------------------------------------
-- Replaces insertVersionChildren()'s childWrites block (+ its guest-pricing /
-- pricing-internal tail) with one call. p_children is a JSON object keyed by
-- table name, e.g. {"quotation_itinerary_days": [...], "quotation_fees": [...]}.
-- Unknown/omitted keys are simply skipped (mirrors the existing
-- `if (input.x.length > 0)` guards).
--
-- p_version_id is stamped onto every row server-side (overriding whatever
-- the JSON payload has for that field, including absent/null), because for
-- create_quotation_draft_atomic the version id does not exist yet at the
-- moment the application builds this payload -- it's only known once this
-- same function has inserted the quotation_versions row, a few lines
-- earlier in the same transaction. This also means the caller never needs
-- to thread the freshly-created id back into ten different arrays itself.
-- ----------------------------------------------------------------------------
create or replace function insert_quotation_version_children_atomic(p_version_id uuid, p_children jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  k text;
  stamped jsonb;
begin
  for k in select jsonb_object_keys(coalesce(p_children, '{}'::jsonb)) loop
    select coalesce(jsonb_agg(elem || jsonb_build_object('quotation_version_id', p_version_id)), '[]'::jsonb)
      into stamped
      from jsonb_array_elements(p_children -> k) elem;
    perform _write_quotation_child_rows(k, stamped);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- createDraftQuotation()'s entire write phase, atomically: insert
-- quotations -> insert quotation_versions -> insert every child table ->
-- link current_version_id. On any failure, nothing is left behind (true
-- ROLLBACK) -- replaces the old "insert, then best-effort delete on
-- failure" pattern whose delete never actually worked.
-- ----------------------------------------------------------------------------
create or replace function create_quotation_draft_atomic(
  p_quotation jsonb,
  p_version jsonb,
  p_children jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quotation_id uuid;
  v_version_id uuid;
begin
  -- Explicit column lists only (never `select *`): jsonb_populate_record
  -- fills every column of the target row type, including id/created_at/
  -- updated_at/etc that aren't in the JSON, as NULL -- a bare `insert ...
  -- select *` would then try to insert those NULLs verbatim instead of
  -- letting their column defaults (gen_random_uuid(), now(), ...) apply.
  -- Listing columns explicitly, matching exactly what
  -- createDraftQuotation()'s own .insert({...}) objects set today, avoids
  -- that trap and leaves every other column on its normal default.
  insert into quotations (quotation_number, client_id, package_id, status, assigned_agent_id)
  select quotation_number, client_id, package_id, status, assigned_agent_id
  from jsonb_populate_record(null::quotations, p_quotation)
  returning id into v_quotation_id;

  insert into quotation_versions (
    quotation_id, version_number, version_label, status, client_name_snapshot, destination,
    package_type, travel_start_date, travel_end_date, valid_until, num_adults, num_children,
    num_seniors, num_infants, num_pwd, hotel_name, num_bedrooms, price_per_person, total_price,
    notes, created_by, consultant_id, consultant_name_snapshot
  )
  select
    v_quotation_id, version_number, version_label, status, client_name_snapshot, destination,
    package_type, travel_start_date, travel_end_date, valid_until, num_adults, num_children,
    num_seniors, num_infants, num_pwd, hotel_name, num_bedrooms, price_per_person, total_price,
    notes, created_by, consultant_id, consultant_name_snapshot
  from jsonb_populate_record(null::quotation_versions, p_version)
  returning id into v_version_id;

  perform insert_quotation_version_children_atomic(v_version_id, p_children);

  update quotations set current_version_id = v_version_id where id = v_quotation_id;

  return jsonb_build_object('quotationId', v_quotation_id, 'versionId', v_version_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- updateDraftQuotation()'s entire write phase, atomically: update
-- quotations/quotation_versions -> delete every existing child row ->
-- re-insert from p_children. On any failure, the update and the delete
-- roll back together with the insert -- the quotation is left exactly as
-- it was before the edit, never half-rebuilt.
-- ----------------------------------------------------------------------------
create or replace function update_quotation_draft_atomic(
  p_quotation_id uuid,
  p_version_id uuid,
  p_quotation jsonb,
  p_version jsonb,
  p_children jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update quotations q
  set (client_id, package_id) = (
    select client_id, package_id from jsonb_populate_record(null::quotations, p_quotation) x
  )
  where q.id = p_quotation_id;

  update quotation_versions v
  set (
    client_name_snapshot, destination, package_type, travel_start_date, travel_end_date,
    valid_until, num_adults, num_children, num_seniors, num_infants, num_pwd,
    hotel_name, num_bedrooms, price_per_person, total_price, notes,
    consultant_id, consultant_name_snapshot
  ) = (
    select
      client_name_snapshot, destination, package_type, travel_start_date, travel_end_date,
      valid_until, num_adults, num_children, num_seniors, num_infants, num_pwd,
      hotel_name, num_bedrooms, price_per_person, total_price, notes,
      consultant_id, consultant_name_snapshot
    from jsonb_populate_record(null::quotation_versions, p_version) x
  )
  where v.id = p_version_id;

  delete from quotation_itinerary_days where quotation_version_id = p_version_id;
  delete from quotation_inclusions where quotation_version_id = p_version_id;
  delete from quotation_exclusions where quotation_version_id = p_version_id;
  delete from quotation_flight_segments where quotation_version_id = p_version_id;
  delete from quotation_fees where quotation_version_id = p_version_id;
  delete from quotation_items where quotation_version_id = p_version_id;
  delete from quotation_guest_pricing where quotation_version_id = p_version_id;
  delete from quotation_guest_pricing_internal where quotation_version_id = p_version_id;
  delete from quotation_tour_pricing where quotation_version_id = p_version_id;
  delete from quotation_airfare_items where quotation_version_id = p_version_id;
  delete from quotation_hotel_items where quotation_version_id = p_version_id;
  delete from quotation_transfer_items where quotation_version_id = p_version_id;
  delete from quotation_pricing_internal where quotation_version_id = p_version_id;

  perform insert_quotation_version_children_atomic(p_version_id, p_children);
end;
$$;

-- ----------------------------------------------------------------------------
-- reviseQuotation()'s version-creation write phase, atomically: insert the
-- new quotation_versions row -> insert every child table. (reviseQuotation
-- itself still performs its own quotations-row update afterward, same as
-- today -- only the version+children half, the part that shares
-- insertVersionChildren()'s partial-write exposure, moves into the
-- transaction here.)
-- ----------------------------------------------------------------------------
create or replace function revise_quotation_draft_atomic(
  p_version jsonb,
  p_children jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id uuid;
begin
  insert into quotation_versions (
    quotation_id, version_number, version_label, status, client_name_snapshot, destination,
    package_type, travel_start_date, travel_end_date, valid_until, num_adults, num_children,
    num_seniors, num_infants, num_pwd, hotel_name, num_bedrooms, price_per_person, total_price,
    notes, created_by, consultant_id, consultant_name_snapshot
  )
  select
    quotation_id, version_number, version_label, status, client_name_snapshot, destination,
    package_type, travel_start_date, travel_end_date, valid_until, num_adults, num_children,
    num_seniors, num_infants, num_pwd, hotel_name, num_bedrooms, price_per_person, total_price,
    notes, created_by, consultant_id, consultant_name_snapshot
  from jsonb_populate_record(null::quotation_versions, p_version)
  returning id into v_version_id;

  perform insert_quotation_version_children_atomic(v_version_id, p_children);

  return v_version_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Execution permissions.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default, and
-- this project's default privileges for the public schema additionally grant
-- it to anon, authenticated and service_role explicitly. These functions are
-- only ever called from the signed-in application (server client =
-- `authenticated`) or from trusted server code (`service_role`), so anon and
-- PUBLIC are revoked -- matching what migrations 0005/0064/0065 already did
-- for allocate_quotation_number() and check_rate_limit().
--
-- All five need the same grant, including the two helpers: the functions are
-- `security invoker`, so the helpers run (and are permission-checked) as the
-- calling user. Revoking anon/PUBLIC does not weaken row-level security,
-- which still applies to every statement inside them exactly as before.
--
-- Separately, all five functions pin `set search_path = public` (as this
-- project's existing trigger functions already do), so a caller's own
-- search_path can never redirect the unqualified table names used inside.
-- ----------------------------------------------------------------------------
revoke execute on function _write_quotation_child_rows(text, jsonb) from public, anon;
revoke execute on function insert_quotation_version_children_atomic(uuid, jsonb) from public, anon;
revoke execute on function create_quotation_draft_atomic(jsonb, jsonb, jsonb) from public, anon;
revoke execute on function update_quotation_draft_atomic(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function revise_quotation_draft_atomic(jsonb, jsonb) from public, anon;

grant execute on function _write_quotation_child_rows(text, jsonb) to authenticated, service_role;
grant execute on function insert_quotation_version_children_atomic(uuid, jsonb) to authenticated, service_role;
grant execute on function create_quotation_draft_atomic(jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function update_quotation_draft_atomic(uuid, uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function revise_quotation_draft_atomic(jsonb, jsonb) to authenticated, service_role;
