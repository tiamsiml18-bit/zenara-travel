-- ============================================================================
-- Detailed Itineraries — new feature, additive only
--
-- Adds a dedicated "Detailed Itinerary" workflow for confirmed + paid
-- bookings: an operational, day-of-travel document (hotel confirmation
-- numbers, driver contacts, pickup times, etc.) distinct from the
-- client-facing Quotation and its PDF. Per the approved architecture
-- investigation:
--
--   - Anchored to bookings.id (never quotations.id or
--     quotation_version_id directly) — a Detailed Itinerary only exists
--     for a trip that has actually been booked, and bookings.quotation_version_id
--     is the frozen snapshot of what the client actually paid for.
--   - Stores ONLY new operational information that has no existing home
--     anywhere in the quotation/booking schema. Flight- and day-level
--     operational detail reference the existing quotation_flight_segments /
--     quotation_itinerary_days rows by id rather than copying their
--     content (airline, flight number, times, day title/description/
--     activities all continue to be read live from those tables).
--
-- Does NOT touch, alter, or drop any existing table, column, enum, policy,
-- function, or row belonging to quotations, quotation_versions, bookings,
-- payments, or any other existing table. No existing data is modified.
-- ============================================================================

create type detailed_itinerary_status as enum ('draft', 'ready_for_review', 'approved', 'sent', 'updated');

-- ----------------------------------------------------------------------------
-- Parent record — one per booking (never per quotation/version). The
-- absence of a row is "Not Created"; no status value represents that state.
-- ----------------------------------------------------------------------------
create table detailed_itineraries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  status detailed_itinerary_status not null default 'draft',

  -- Automation bookkeeping — when the 14-day cron job created this draft,
  -- and the idempotency guard that stops it from ever being created twice
  -- for the same booking (see the unique constraint below).
  generated_at timestamptz not null default now(),

  approved_by uuid references users(id),
  approved_at timestamptz,
  sent_at timestamptz,

  -- Travel Reminders — one set per trip, so flat columns on the parent
  -- rather than a child table (there is exactly one of each per booking,
  -- not a repeating list).
  airport_instructions text,
  contact_instructions text,
  important_reminders text,
  guide_instructions text,

  -- Hotel — operational detail only; hotel_name itself is never duplicated
  -- here, it continues to be read from quotation_versions.hotel_name via
  -- bookings.quotation_version_id.
  hotel_address text,
  hotel_phone text,
  hotel_checkin_info text,
  hotel_confirmation_number text,
  hotel_booking_number text,
  hotel_pin text,

  -- Freeform notes shown on the Detailed Itinerary PDF only.
  custom_notes text,

  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One Detailed Itinerary per booking. This is also what makes the cron
  -- job's "insert if none exists" step safe to run more than once without
  -- creating duplicates (see also idx_detailed_itineraries_booking below,
  -- which backs this constraint).
  constraint detailed_itineraries_one_per_booking unique (booking_id)
);
create index idx_detailed_itineraries_status on detailed_itineraries(status);

-- ----------------------------------------------------------------------------
-- Flight operational detail — one row per quotation flight segment it
-- augments. Never copies airline/flight number/times/route; those stay on
-- quotation_flight_segments and are read live through the FK below.
-- ----------------------------------------------------------------------------
create table detailed_itinerary_flight_details (
  id uuid primary key default gen_random_uuid(),
  detailed_itinerary_id uuid not null references detailed_itineraries(id) on delete cascade,
  quotation_flight_segment_id uuid not null references quotation_flight_segments(id),
  booking_reference text,
  terminal text,
  special_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_flight_details_unique unique (detailed_itinerary_id, quotation_flight_segment_id)
);
create index idx_di_flight_details_itinerary on detailed_itinerary_flight_details(detailed_itinerary_id);

-- ----------------------------------------------------------------------------
-- Daily operational detail — one row per quotation itinerary day it
-- augments. Never copies title/description/activities; those stay on
-- quotation_itinerary_days and are read live through the FK below.
-- ----------------------------------------------------------------------------
create table detailed_itinerary_daily_details (
  id uuid primary key default gen_random_uuid(),
  detailed_itinerary_id uuid not null references detailed_itineraries(id) on delete cascade,
  quotation_itinerary_day_id uuid not null references quotation_itinerary_days(id),
  pickup_time text,
  meeting_point text,
  meals text,
  free_time text,
  operational_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_daily_details_unique unique (detailed_itinerary_id, quotation_itinerary_day_id)
);
create index idx_di_daily_details_itinerary on detailed_itinerary_daily_details(detailed_itinerary_id);

-- ----------------------------------------------------------------------------
-- Transfers — an entirely new operational concept (the existing
-- quotation_transfer_items table is pricing-only: cost/markup, never who's
-- driving or when), so this is a plain child list with no FK back to any
-- quotation table.
-- ----------------------------------------------------------------------------
create table detailed_itinerary_transfers (
  id uuid primary key default gen_random_uuid(),
  detailed_itinerary_id uuid not null references detailed_itineraries(id) on delete cascade,
  sort_order integer not null default 0,
  pickup_location text,
  pickup_time text,
  driver_guide_name text,
  contact_number text,
  meeting_point text,
  vehicle_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_di_transfers_itinerary on detailed_itinerary_transfers(detailed_itinerary_id);

-- ============================================================================
-- updated_at auto-touch — reuses the existing touch_updated_at() function
-- from 0001_init.sql unchanged; just applying it to these new tables.
-- ============================================================================
create trigger trg_touch_detailed_itineraries before update on detailed_itineraries for each row execute function touch_updated_at();
create trigger trg_touch_di_flight_details before update on detailed_itinerary_flight_details for each row execute function touch_updated_at();
create trigger trg_touch_di_daily_details before update on detailed_itinerary_daily_details for each row execute function touch_updated_at();
create trigger trg_touch_di_transfers before update on detailed_itinerary_transfers for each row execute function touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — mirrors the existing bookings/payments pattern
-- exactly (admin, or the booking's assigned agent / their team), reusing
-- auth_user_role() and auth_user_team_ids() from 0001_init.sql unchanged.
-- ============================================================================
alter table detailed_itineraries enable row level security;
alter table detailed_itinerary_flight_details enable row level security;
alter table detailed_itinerary_daily_details enable row level security;
alter table detailed_itinerary_transfers enable row level security;

create policy detailed_itineraries_all on detailed_itineraries for all using (
  exists (
    select 1 from bookings b
    where b.id = detailed_itineraries.booking_id
      and b.deleted_at is null
      and (auth_user_role() = 'admin' or b.assigned_agent_id in (select auth_user_team_ids()))
  )
);

create policy di_flight_details_all on detailed_itinerary_flight_details for all using (
  exists (
    select 1 from detailed_itineraries di
    join bookings b on b.id = di.booking_id
    where di.id = detailed_itinerary_flight_details.detailed_itinerary_id
      and b.deleted_at is null
      and (auth_user_role() = 'admin' or b.assigned_agent_id in (select auth_user_team_ids()))
  )
);

create policy di_daily_details_all on detailed_itinerary_daily_details for all using (
  exists (
    select 1 from detailed_itineraries di
    join bookings b on b.id = di.booking_id
    where di.id = detailed_itinerary_daily_details.detailed_itinerary_id
      and b.deleted_at is null
      and (auth_user_role() = 'admin' or b.assigned_agent_id in (select auth_user_team_ids()))
  )
);

create policy di_transfers_all on detailed_itinerary_transfers for all using (
  exists (
    select 1 from detailed_itineraries di
    join bookings b on b.id = di.booking_id
    where di.id = detailed_itinerary_transfers.detailed_itinerary_id
      and b.deleted_at is null
      and (auth_user_role() = 'admin' or b.assigned_agent_id in (select auth_user_team_ids()))
  )
);
