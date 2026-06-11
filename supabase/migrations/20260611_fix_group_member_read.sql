-- Fix: let group members SELECT their own group row.
--
-- The 20260611_group_admins migration replaced employer_own_group
-- (auth.uid() = user_id) with is_group_team(), which only checks
-- group_admins. Regular Shift users are in group_members, not
-- group_admins, so they lost read access to their groups —
-- breaking community leaderboards in the Shift app.

CREATE POLICY "member_read_own_group" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
    )
  );
