-- Drop public_group_advisor view (replaced by get_advisor_group_by_slug RPC)
--
-- The view was created by 20260410_employer_commute_advisor.sql to expose
-- a public-facing list of commute-advisor-enabled groups. Supabase's
-- linter flagged it as a SECURITY DEFINER view (a category warning —
-- the view bypasses RLS for whoever queries it).
--
-- Replacement: Shift migration 00336_advisor_group_by_slug_function.sql
-- added public.get_advisor_group_by_slug(p_slug text), a SECURITY DEFINER
-- function that returns the same shape via a parameterized RPC. Functions
-- aren't flagged the same way because input is bounded and only the
-- declared return columns can ever leak.
--
-- The gsi-website /commute-advisor/[slug] page is on the new RPC as of
-- commit a5552f0. With Vercel auto-deployed, no remaining caller exists.
-- Verified by greps in both Shift and gsi-website repos before writing
-- this migration.

DROP VIEW IF EXISTS public.public_group_advisor;
