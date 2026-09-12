-- ============================================================================
-- Privacy & Security governance — additive only
-- Adds acknowledgment tracking for internal policy documents (Privacy &
-- Data Protection Policy, HIIKAP Terms of Use, Client Privacy Notice,
-- Security & Incident Procedure). Document content itself lives in code
-- (lib/content/privacy-documents.ts) rather than in the database, so this
-- migration does not create a "documents" table — only the acknowledgment
-- log, which is the only piece that needs to persist per user.
--
-- Does NOT touch, alter, or drop any existing table, column, enum,
-- function, trigger, or policy.
-- ============================================================================

create table policy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  document_key text not null,        -- e.g. 'internal-privacy-policy', 'terms-of-use'
  document_version text not null,    -- matches the version string in lib/content/privacy-documents.ts
  acknowledged_at timestamptz not null default now(),
  unique (user_id, document_key, document_version)
);
create index idx_policy_ack_user on policy_acknowledgments(user_id);
create index idx_policy_ack_document on policy_acknowledgments(document_key, document_version);

alter table policy_acknowledgments enable row level security;

-- Every authorized (active) HIIKAP user can see and record their own
-- acknowledgments. Admins can additionally see everyone's, for compliance
-- review purposes (e.g. confirming which staff have acknowledged the
-- current version after a policy update).
create policy policy_ack_select on policy_acknowledgments for select using (
  user_id = auth.uid() or auth_user_role() = 'admin'
);
create policy policy_ack_insert on policy_acknowledgments for insert with check (
  user_id = auth.uid()
);
