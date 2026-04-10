-- Employer Commute Advisor: add benefits config and enable flag to groups
-- Run this migration in the Supabase SQL editor

-- Add employer_benefits JSONB column for commute benefit configuration
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS employer_benefits JSONB DEFAULT '{}';

-- Add commute_advisor_enabled flag (defaults to true for all groups)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS commute_advisor_enabled BOOLEAN DEFAULT true;

-- Create a view for public access to commute advisor data
-- This exposes only non-sensitive columns for the co-branded page
CREATE OR REPLACE VIEW public_group_advisor AS
SELECT
  id,
  name,
  slug,
  logo_url,
  tier,
  status,
  employer_benefits,
  commute_advisor_enabled
FROM groups
WHERE status = 'active'
  AND commute_advisor_enabled = true;

-- Grant anon access to the view
GRANT SELECT ON public_group_advisor TO anon;
GRANT SELECT ON public_group_advisor TO authenticated;

-- RLS policy: allow anon reads of commute advisor groups via the view
-- The view already filters to active + enabled groups
-- No additional RLS needed since views bypass table-level RLS

COMMENT ON COLUMN groups.employer_benefits IS 'JSONB config for co-branded Commute Advisor: destination address, transit subsidy, Bluebikes, bike parking, showers, shuttle routes, HR contact';
COMMENT ON COLUMN groups.commute_advisor_enabled IS 'Whether this group has a public Commute Advisor page at /commute-advisor/[slug]';
