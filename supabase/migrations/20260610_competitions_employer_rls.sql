-- Allow employer admins to manage their own competitions.
-- The competitions table has RLS enabled but was missing policies
-- for authenticated employer admins, blocking challenge creation.

DO $$ BEGIN
  CREATE POLICY "employer_own_competitions" ON public.competitions
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.groups
        WHERE groups.id = competitions.group_id
          AND groups.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
