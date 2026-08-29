-- ============================================================================
-- Atomic quotation number allocation.
-- Called via supabase.rpc('allocate_quotation_number') from the server only.
-- Row-level locking on quotation_number_sequences prevents two concurrent
-- "New Quotation" clicks from ever getting the same number, independent of
-- the unique constraint on quotations.quotation_number which remains as a
-- hard backstop.
-- ============================================================================
create or replace function allocate_quotation_number(p_prefix text default 'QT')
returns text as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
  v_number text;
begin
  insert into quotation_number_sequences (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = quotation_number_sequences.last_value + 1
  returning last_value into v_next;

  v_number := p_prefix || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
  return v_number;
end;
$$ language plpgsql security definer;

-- Booking numbers use the same pattern with their own sequence table.
create table booking_number_sequences (
  year int primary key,
  last_value int not null default 0
);

create or replace function allocate_booking_number()
returns text as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into booking_number_sequences (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = booking_number_sequences.last_value + 1
  returning last_value into v_next;

  return 'BK-' || v_year || '-' || lpad(v_next::text, 5, '0');
end;
$$ language plpgsql security definer;
