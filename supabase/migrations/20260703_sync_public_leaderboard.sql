-- RPC to sync a group's public leaderboard visibility.
-- Runs as SECURITY DEFINER so it can update flagship competitions
-- that the calling user doesn't own (RLS blocks client-side updates).
CREATE OR REPLACE FUNCTION public.sync_group_public_leaderboard(
  p_group_id   uuid,
  p_wants_public boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify caller is a group admin or GSI admin
  IF NOT (public.is_group_admin(p_group_id) OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Update the group's own flag
  UPDATE public.groups
  SET public_leaderboard = p_wants_public
  WHERE id = p_group_id;

  -- Add or remove the group from all active/upcoming flagship competitions
  IF p_wants_public THEN
    UPDATE public.competitions
    SET matchup_group_ids = matchup_group_ids || jsonb_build_array(p_group_id::text)
    WHERE is_public = true
      AND group_id IS NULL
      AND ends_at > now()
      AND NOT (matchup_group_ids @> jsonb_build_array(p_group_id::text));
  ELSE
    UPDATE public.competitions
    SET matchup_group_ids = (
      SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(matchup_group_ids) AS elem
      WHERE elem #>> '{}' <> p_group_id::text
    )
    WHERE is_public = true
      AND group_id IS NULL
      AND ends_at > now()
      AND matchup_group_ids @> jsonb_build_array(p_group_id::text);
  END IF;
END;
$$;
