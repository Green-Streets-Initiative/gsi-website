-- Schema additions for the Shift Your Summer partner intake form.
-- See: src/app/events/shift-your-summer/partners/page.tsx
--      src/app/api/partner-form/route.ts
--
-- Adds two new relationship types (prize_donor, team_participant) and an
-- "Inbound interest" stage at the front of every used type's pipeline so we
-- can distinguish form submissions from outbound prospects in the CRM.

-- 1. New relationship types ──────────────────────────────────────
INSERT INTO relationship_types (id, label, description, sort_order)
VALUES
  ('prize_donor',
   'Prize Donor',
   'Organizations donating prizes to flagship events (grand prizes, weekly prizes, reward catalog items)',
   5),
  ('team_participant',
   'Team Participant',
   'Organizations whose employees compete as a custom team in flagship events (separate from full Shift employer platform engagement)',
   6)
ON CONFLICT (id) DO NOTHING;

-- 2. New "Inbound interest" stage at the front of each relevant pipeline ──
-- sort_order = 0 keeps existing stages (1..n) unchanged.
INSERT INTO pipeline_stages (relationship_type_id, name, sort_order, is_terminal, terminal_outcome)
VALUES
  ('flagship_sponsor',  'Inbound interest', 0, false, NULL),
  ('prize_donor',       'Inbound interest', 0, false, NULL),
  ('team_participant',  'Inbound interest', 0, false, NULL);

-- 3. Full pipeline for the two brand-new types ──────────────────
-- prize_donor: Inbound → Confirmed → Donation received → Awarded (terminal won)
INSERT INTO pipeline_stages (relationship_type_id, name, sort_order, is_terminal, terminal_outcome)
VALUES
  ('prize_donor', 'Confirmed',         1, false, NULL),
  ('prize_donor', 'Donation received', 2, false, NULL),
  ('prize_donor', 'Awarded',           3, true,  'won');

-- team_participant: Inbound → Onboarding → Active (terminal won)
INSERT INTO pipeline_stages (relationship_type_id, name, sort_order, is_terminal, terminal_outcome)
VALUES
  ('team_participant', 'Onboarding', 1, false, NULL),
  ('team_participant', 'Active',     2, true,  'won');

-- 4. Type-specific submission data ──────────────────────────────
ALTER TABLE contact_relationships
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 5. Logo URL for organizations ─────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url text;
