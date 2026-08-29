-- ============================================================================
-- Zenara Travel and Tours — Initial Schema
-- Phase 2-3: normalized schema, RLS, indexes, versioning triggers
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- fuzzy/full-text search

-- ============================================================================
-- ENUMS
-- ============================================================================
create type user_role as enum ('admin', 'manager', 'agent');
create type quotation_status as enum
  ('draft','sent','viewed','follow_up','negotiating','confirmed','paid','cancelled','lost','expired');
create type booking_status as enum ('pending','confirmed','in_progress','completed','cancelled');
create type payment_status as enum ('unpaid','partial','paid','refunded');
create type followup_status as enum ('pending','due','overdue','completed','skipped');
create type followup_outcome as enum
  ('no_response','interested','requested_changes','negotiating','confirmed','lost','follow_up_later');
create type activity_type as enum
  ('client_created','quotation_created','quotation_sent','quotation_revised','quotation_duplicated',
   'quotation_status_changed','client_status_changed','followup_completed','booking_created',
   'payment_added','note_added','manual');

-- ============================================================================
-- CORE: USERS (mirrors auth.users, extends with app role/team data)
-- ============================================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'agent',
  manager_id uuid references users(id),        -- for team scoping
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_manager on users(manager_id);

-- ============================================================================
-- CONFIG TABLES (admin-editable lookups, not hard enums)
-- ============================================================================
create table client_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0
);
insert into client_sources (name, sort_order) values
  ('Facebook Ads',1),('Messenger',2),('Instagram',3),('WhatsApp',4),
  ('Referral',5),('Walk-in',6),('Other',7);

create table client_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true
);
insert into client_statuses (name, sort_order) values
  ('New Lead',1),('Contacted',2),('Quotation Draft',3),('Quotation Sent',4),
  ('Follow-up Due',5),('Negotiating',6),('Confirmed',7),('Paid',8),
  ('Cancelled',9),('Lost',10),('Expired',11);

create table agency_settings (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null default 'Zenara Travel and Tours',
  logo_url text,
  phone text, email text, facebook text, instagram text, whatsapp text,
  messenger text, website text, address text,
  quotation_footer text,
  terms_and_conditions text default 'Rates are subject to availability and may change without prior notice until booking is confirmed.',
  payment_instructions text,
  default_currency text not null default 'PHP',
  quotation_number_prefix text not null default 'QT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quotation_settings (
  id uuid primary key default gen_random_uuid(),
  followup_schedule_days int[] not null default '{1,3,7,14}',
  default_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- quotation number sequence, reset conceptually per year via numbering scheme "QT-{year}-{seq}"
create table quotation_number_sequences (
  year int primary key,
  last_value int not null default 0
);

-- ============================================================================
-- CLIENTS
-- ============================================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile_number text,
  email text,
  messenger_handle text,
  instagram_handle text,
  whatsapp_number text,
  source_id uuid references client_sources(id),
  destination text,
  travel_start_date date,
  travel_end_date date,
  num_adults int default 1 check (num_adults >= 0),
  num_children int default 0 check (num_children >= 0),
  quoted_price numeric(12,2) check (quoted_price is null or quoted_price >= 0),
  status_id uuid references client_statuses(id),
  assigned_agent_id uuid references users(id),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_travel_dates check (travel_end_date is null or travel_start_date is null or travel_end_date >= travel_start_date)
);
create index idx_clients_agent on clients(assigned_agent_id) where deleted_at is null;
create index idx_clients_status on clients(status_id) where deleted_at is null;
create index idx_clients_search on clients using gin (full_name gin_trgm_ops, coalesce(email,'') gin_trgm_ops, coalesce(mobile_number,'') gin_trgm_ops);
create index idx_clients_created on clients(created_at desc);

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  author_id uuid references users(id),
  note text not null,
  created_at timestamptz not null default now()
);
create index idx_client_notes_client on client_notes(client_id);

create table client_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  activity_type activity_type not null,
  description text not null,
  user_id uuid references users(id),
  related_quotation_id uuid,   -- FK added after quotations table exists
  created_at timestamptz not null default now()
);
create index idx_client_activities_client on client_activities(client_id, created_at desc);

-- ============================================================================
-- HOTELS (lightweight lookup only, per spec)
-- ============================================================================
create table hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_hotels_search on hotels using gin (name gin_trgm_ops);

-- ============================================================================
-- PACKAGES (reusable templates)
-- ============================================================================
create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  num_days int not null check (num_days > 0),
  num_nights int not null check (num_nights >= 0),
  default_notes text,
  is_active boolean not null default true,
  created_by uuid references users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_packages_destination on packages(destination) where deleted_at is null;
create index idx_packages_active on packages(is_active) where deleted_at is null;

create table package_itineraries (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  day_number int not null,
  title text not null,
  description text,
  activities text[] not null default '{}',
  unique (package_id, day_number)
);

create table package_inclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  item text not null,
  sort_order int not null default 0
);

create table package_exclusions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  item text not null,
  sort_order int not null default 0
);

-- ============================================================================
-- QUOTATIONS  (envelope + immutable versions)
-- ============================================================================
create table quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,     -- e.g. QT-2026-00001
  client_id uuid not null references clients(id),
  package_id uuid references packages(id),   -- null if fully custom
  current_version_id uuid,                    -- FK added after quotation_versions exists
  status quotation_status not null default 'draft',
  assigned_agent_id uuid references users(id),
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_quotations_client on quotations(client_id);
create index idx_quotations_agent on quotations(assigned_agent_id);
create index idx_quotations_status on quotations(status);
create index idx_quotations_number on quotations(quotation_number);

create table quotation_versions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  version_number int not null,               -- 1, 2, 3...
  version_label text not null,               -- 'Original' / 'Rev 2' / 'Rev 3'
  status quotation_status not null default 'draft',

  -- client-facing snapshot (frozen at send time, never retro-updated)
  client_name_snapshot text not null,
  destination text not null,
  travel_start_date date not null,
  travel_end_date date not null,
  num_adults int not null check (num_adults >= 0),
  num_children int not null default 0 check (num_children >= 0),
  hotel_name text,
  num_bedrooms int,
  price_per_person numeric(12,2) check (price_per_person is null or price_per_person >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  currency text not null default 'PHP',
  notes text,

  sent_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (quotation_id, version_number),
  constraint chk_qv_dates check (travel_end_date >= travel_start_date)
);
create index idx_qv_quotation on quotation_versions(quotation_id);

alter table quotations
  add constraint fk_quotations_current_version
  foreign key (current_version_id) references quotation_versions(id);

alter table client_activities
  add constraint fk_activities_quotation
  foreign key (related_quotation_id) references quotations(id);

-- Trip/day-level line items (e.g. optional add-ons; kept generic per spec's quotation_items)
create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references quotation_versions(id) on delete cascade,
  label text not null,
  description text,
  quantity int not null default 1,
  unit_price numeric(12,2) not null default 0,
  sort_order int not null default 0
);

create table quotation_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references quotation_versions(id) on delete cascade,
  day_number int not null,
  day_date date,
  title text not null,
  description text,
  activities text[] not null default '{}',
  unique (quotation_version_id, day_number)
);
create index idx_qid_version on quotation_itinerary_days(quotation_version_id);

create table quotation_inclusions (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references quotation_versions(id) on delete cascade,
  item text not null,
  sort_order int not null default 0
);

create table quotation_exclusions (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references quotation_versions(id) on delete cascade,
  item text not null,
  sort_order int not null default 0
);

-- PRIVATE pricing — physically separate table, never joined into client-safe/PDF queries
create table quotation_pricing_internal (
  quotation_version_id uuid primary key references quotation_versions(id) on delete cascade,
  supplier_cost numeric(12,2) not null default 0 check (supplier_cost >= 0),
  markup numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  profit numeric(12,2) generated always as (selling_price - supplier_cost) stored,
  profit_margin_pct numeric(5,2) generated always as (
    case when selling_price > 0 then round(((selling_price - supplier_cost) / selling_price) * 100, 2) else 0 end
  ) stored,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- IMMUTABILITY TRIGGER: block edits to a version once it has left 'draft'
-- ============================================================================
create or replace function prevent_sent_version_mutation() returns trigger as $$
begin
  if OLD.status <> 'draft' then
    raise exception 'Quotation version % is % and cannot be modified directly. Create a new revision instead.', OLD.version_label, OLD.status;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_prevent_sent_version_mutation
  before update of client_name_snapshot, destination, travel_start_date, travel_end_date,
    num_adults, num_children, hotel_name, num_bedrooms, price_per_person, total_price, notes
  on quotation_versions
  for each row execute function prevent_sent_version_mutation();

-- child tables (itinerary/inclusions/exclusions/items) inherit the same protection
create or replace function prevent_child_mutation_if_version_locked() returns trigger as $$
declare v_status quotation_status;
begin
  select status into v_status from quotation_versions where id = coalesce(NEW.quotation_version_id, OLD.quotation_version_id);
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Cannot modify content of a version that is no longer draft. Create a new revision.';
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

create trigger trg_lock_itinerary before insert or update or delete on quotation_itinerary_days
  for each row execute function prevent_child_mutation_if_version_locked();
create trigger trg_lock_inclusions before insert or update or delete on quotation_inclusions
  for each row execute function prevent_child_mutation_if_version_locked();
create trigger trg_lock_exclusions before insert or update or delete on quotation_exclusions
  for each row execute function prevent_child_mutation_if_version_locked();
create trigger trg_lock_items before insert or update or delete on quotation_items
  for each row execute function prevent_child_mutation_if_version_locked();

-- ============================================================================
-- FOLLOW-UPS
-- ============================================================================
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  client_id uuid not null references clients(id),
  agent_id uuid references users(id),
  due_date date not null,
  status followup_status not null default 'pending',
  outcome followup_outcome,
  method text,                 -- 'Messenger' | 'WhatsApp' | 'Email' | 'Call' etc (free text, admin-configurable list later)
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_followups_due on follow_ups(due_date, status);
create index idx_followups_agent on follow_ups(agent_id, status);
create index idx_followups_quotation on follow_ups(quotation_id);

-- ============================================================================
-- BOOKINGS & PAYMENTS
-- ============================================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  client_id uuid not null references clients(id),
  quotation_id uuid not null references quotations(id),
  quotation_version_id uuid not null references quotation_versions(id),
  destination text not null,
  travel_start_date date not null,
  travel_end_date date not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_status payment_status not null default 'unpaid',
  status booking_status not null default 'pending',
  assigned_agent_id uuid references users(id),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bookings_client on bookings(client_id);
create index idx_bookings_quotation on bookings(quotation_id);
create index idx_bookings_status on bookings(status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text,
  notes text,
  recorded_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_payments_booking on payments(booking_id);

-- ============================================================================
-- FILES (polymorphic, non-sensitive quotation-related attachments only)
-- ============================================================================
create table files (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,   -- 'quotation_version' | 'package' | 'client'
  entity_id uuid not null,
  storage_path text not null,   -- Supabase Storage path (private bucket)
  file_name text not null,
  content_type text,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_files_entity on files(entity_type, entity_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
create index idx_audit_created on audit_logs(created_at desc);

-- ============================================================================
-- updated_at auto-touch trigger (generic, applied to tables that have the column)
-- ============================================================================
create or replace function touch_updated_at() returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'users','clients','packages','quotations','quotation_versions',
    'bookings','agency_settings','quotation_settings'
  ]) loop
    execute format('create trigger trg_touch_%1$s before update on %1$s for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Helper functions
create or replace function auth_user_role() returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_user_team_ids() returns setof uuid as $$
  -- returns the set of user ids this caller can see data for:
  -- admin -> handled separately (sees all), manager -> self + direct reports, agent -> self
  select id from users where id = auth.uid()
  union
  select id from users where manager_id = auth.uid();
$$ language sql stable security definer;

alter table users enable row level security;
alter table clients enable row level security;
alter table client_notes enable row level security;
alter table client_activities enable row level security;
alter table packages enable row level security;
alter table package_itineraries enable row level security;
alter table package_inclusions enable row level security;
alter table package_exclusions enable row level security;
alter table quotations enable row level security;
alter table quotation_versions enable row level security;
alter table quotation_items enable row level security;
alter table quotation_itinerary_days enable row level security;
alter table quotation_inclusions enable row level security;
alter table quotation_exclusions enable row level security;
alter table quotation_pricing_internal enable row level security;
alter table follow_ups enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table files enable row level security;
alter table audit_logs enable row level security;
alter table hotels enable row level security;
alter table client_sources enable row level security;
alter table client_statuses enable row level security;
alter table agency_settings enable row level security;
alter table quotation_settings enable row level security;

-- USERS
create policy users_select on users for select using (
  auth_user_role() = 'admin' or id = auth.uid() or id in (select auth_user_team_ids())
);
create policy users_update_admin on users for update using (auth_user_role() = 'admin');

-- CLIENTS (own / team / all)
create policy clients_select on clients for select using (
  deleted_at is null and (
    auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids())
  )
);
create policy clients_insert on clients for insert with check (
  auth_user_role() in ('admin','manager','agent')
);
create policy clients_update on clients for update using (
  auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids())
);

-- Same pattern for notes/activities via client_id join
create policy client_notes_all on client_notes for all using (
  exists (select 1 from clients c where c.id = client_notes.client_id
    and (auth_user_role() = 'admin' or c.assigned_agent_id in (select auth_user_team_ids())))
);
create policy client_activities_all on client_activities for all using (
  exists (select 1 from clients c where c.id = client_activities.client_id
    and (auth_user_role() = 'admin' or c.assigned_agent_id in (select auth_user_team_ids())))
);

-- PACKAGES: everyone can read active packages, only admin/manager can write
create policy packages_select on packages for select using (deleted_at is null);
create policy packages_write on packages for insert with check (auth_user_role() in ('admin','manager'));
create policy packages_update on packages for update using (auth_user_role() in ('admin','manager'));
create policy package_children_select on package_itineraries for select using (true);
create policy package_incl_select on package_inclusions for select using (true);
create policy package_excl_select on package_exclusions for select using (true);

-- QUOTATIONS
create policy quotations_select on quotations for select using (
  deleted_at is null and (
    auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids())
  )
);
create policy quotations_insert on quotations for insert with check (
  auth_user_role() in ('admin','manager','agent')
);
create policy quotations_update on quotations for update using (
  auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids())
);

create policy quotation_versions_all on quotation_versions for all using (
  exists (select 1 from quotations q where q.id = quotation_versions.quotation_id
    and (auth_user_role() = 'admin' or q.assigned_agent_id in (select auth_user_team_ids())))
);
create policy quotation_items_all on quotation_items for all using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_items.quotation_version_id
    and (auth_user_role() = 'admin' or q.assigned_agent_id in (select auth_user_team_ids())))
);
create policy quotation_itin_all on quotation_itinerary_days for all using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_itinerary_days.quotation_version_id
    and (auth_user_role() = 'admin' or q.assigned_agent_id in (select auth_user_team_ids())))
);
create policy quotation_incl_all on quotation_inclusions for all using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_inclusions.quotation_version_id
    and (auth_user_role() = 'admin' or q.assigned_agent_id in (select auth_user_team_ids())))
);
create policy quotation_excl_all on quotation_exclusions for all using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_exclusions.quotation_version_id
    and (auth_user_role() = 'admin' or q.assigned_agent_id in (select auth_user_team_ids())))
);

-- PRICING: extra-restricted — admin, manager, or the owning agent only
create policy pricing_select on quotation_pricing_internal for select using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_pricing_internal.quotation_version_id
    and (auth_user_role() in ('admin','manager') or q.assigned_agent_id = auth.uid()))
);
create policy pricing_write on quotation_pricing_internal for all using (
  exists (select 1 from quotation_versions v join quotations q on q.id = v.quotation_id
    where v.id = quotation_pricing_internal.quotation_version_id
    and (auth_user_role() in ('admin','manager') or q.assigned_agent_id = auth.uid()))
);

-- FOLLOW-UPS
create policy followups_all on follow_ups for all using (
  auth_user_role() = 'admin' or agent_id in (select auth_user_team_ids())
);

-- BOOKINGS & PAYMENTS
create policy bookings_all on bookings for all using (
  deleted_at is null and (auth_user_role() = 'admin' or assigned_agent_id in (select auth_user_team_ids()))
);
create policy payments_all on payments for all using (
  exists (select 1 from bookings b where b.id = payments.booking_id
    and (auth_user_role() = 'admin' or b.assigned_agent_id in (select auth_user_team_ids())))
);

-- FILES: readable if the parent entity is readable (simplified: admin/manager/agent all authenticated)
create policy files_select on files for select using (auth.uid() is not null);
create policy files_insert on files for insert with check (auth.uid() is not null);

-- AUDIT LOG: admin/manager read, insert via service role generally, but allow authenticated insert of own actions
create policy audit_select on audit_logs for select using (auth_user_role() in ('admin','manager'));
create policy audit_insert on audit_logs for insert with check (auth.uid() is not null);

-- LOOKUPS: readable by all authenticated users, writable by admin only
create policy hotels_select on hotels for select using (auth.uid() is not null);
create policy hotels_write on hotels for all using (auth_user_role() = 'admin');
create policy sources_select on client_sources for select using (auth.uid() is not null);
create policy sources_write on client_sources for all using (auth_user_role() = 'admin');
create policy statuses_select on client_statuses for select using (auth.uid() is not null);
create policy statuses_write on client_statuses for all using (auth_user_role() = 'admin');
create policy agency_settings_select on agency_settings for select using (auth.uid() is not null);
create policy agency_settings_write on agency_settings for all using (auth_user_role() = 'admin');
create policy quotation_settings_select on quotation_settings for select using (auth.uid() is not null);
create policy quotation_settings_write on quotation_settings for all using (auth_user_role() = 'admin');

-- ============================================================================
-- SEED: agency settings row + quotation settings row
-- ============================================================================
insert into agency_settings (agency_name, default_currency, quotation_number_prefix) values
  ('Zenara Travel and Tours', 'PHP', 'QT');
insert into quotation_settings (followup_schedule_days) values ('{1,3,7,14}');
