-- ============================================================================
-- Package Category (Domestic / International) — additive only
--
-- Adds a nullable classification to packages, used only to suggest a
-- starting Zenara Markup default (Domestic PHP 2,000 / International
-- PHP 5,000) when a package is selected in the quotation wizard — the
-- agent can always change that markup for any specific quotation, and an
-- unclassified (NULL) package intentionally leaves markup untouched
-- rather than guessing.
--
-- Deliberately NOT named package_type (already taken, meaning All-In vs
-- Land Arrangement) and NOT named trip_type (the quotation wizard's own,
-- unrelated Round Trip/One Way field in Flight Details) — package_category
-- avoids colliding with either existing concept.
--
-- Nullable, no default: unlike package_type's `default 'all_in'`, there
-- is no safe default here — forcing every existing package to Domestic
-- or International would silently mislabel roughly half of them either
-- way. Existing packages (11 total at the time of this migration) stay
-- NULL until manually classified by an admin via the package edit form,
-- which now requires this field for any new save going forward.
--
-- Does NOT touch, alter, or drop any existing table, column, enum,
-- policy, or row belonging to packages or any other table. No existing
-- package's data is modified by this migration.
-- ============================================================================

create type package_category as enum ('domestic', 'international');

alter table packages add column package_category package_category;
