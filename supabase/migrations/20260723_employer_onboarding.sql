-- ============================================================
-- Employer onboarding/success intake
-- ============================================================
-- Structured home for what used to live nowhere: the customer's own
-- definition of success, launch date, key dates, and champions —
-- captured on the kickoff call (GSI admin) or by the employer admin
-- in the portal's setup page. Shape (all keys optional):
-- {
--   success_definition: text,
--   headcount: int,                  -- approx employees, denominator for %
--   target_signup_pct: int,          -- launch-challenge signup goal
--   target_weekly_active_pct: int,   -- post-launch weekly active goal
--   launch_date: 'YYYY-MM-DD',
--   key_dates: [{label, date}],      -- ESG reporting, wellness week, etc.
--   champions: [text],               -- "Name <email>" lines
--   comms_channels: text,
--   kickoff_at: timestamptz,
--   notes: text
-- }

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.groups.onboarding IS
  'Employer onboarding intake: success definition, targets, launch/key dates, champions. Written by portal admins and GSI staff.';
