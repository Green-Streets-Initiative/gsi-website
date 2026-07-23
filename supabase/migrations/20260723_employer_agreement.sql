-- ============================================================
-- Employer Platform Agreement — click-wrap acceptance tracking
-- ============================================================
-- The agreement is accepted electronically in the portal by the first
-- admin to log in (when required). agreement_required defaults FALSE so
-- existing pilot/demo groups are untouched; it flips to true when a
-- group is provisioned or adopted through Stripe (employer-webhook),
-- and can be toggled manually in shift-school for hand-done deals.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS agreement_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_version text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_accepted_by_email text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_name text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_title text;

COMMENT ON COLUMN public.groups.agreement_required IS
  'Portal blocks admin use until the Employer Platform Agreement is accepted (paid accounts).';
COMMENT ON COLUMN public.groups.agreement_version IS
  'Version identifier of the agreement text that was accepted (see gsi-website src/lib/employer-agreement.ts).';
