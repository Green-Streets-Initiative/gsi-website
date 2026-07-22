-- ============================================================
-- Employer dashboard: team access + real trend data + CO2 fix
-- ============================================================
-- 1. get_employer_dashboard_data was the one employer RPC never
--    migrated to the group_admins model: it still allowed only
--    groups.user_id (the first admin to ever log in). Any other
--    invited admin/viewer got {error:'forbidden'} and a silently
--    blank Impact tab. Guard now matches every sibling RPC.
-- 2. Adds weekly_shift_rates (12 rolling weekly buckets) so the
--    portal's trend chart / PDF can show real history instead of
--    the synthetic placeholder series.
-- 3. co2_avoided_kg previously included carpool/other miles while
--    miles_shifted and the per-member CO2 column excluded them,
--    so the numbers could not be reconciled. All three now use
--    the same active-mode set (exclude drive/carpool/other).
-- Same 4-arg signature as 00236 in the Shift repo — no new
-- overload, deployed clients unaffected.

CREATE OR REPLACE FUNCTION public.get_employer_dashboard_data(
  p_group_id  uuid,
  p_days      int         DEFAULT 30,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_admin_id     uuid;
  v_window_start timestamptz;
  v_window_end   timestamptz;
  v_result       jsonb;
BEGIN
  SELECT user_id INTO v_admin_id
  FROM public.groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'group_not_found');
  END IF;

  -- Legacy owner check kept as a backstop for groups whose owner
  -- predates their group_admins row. COALESCE matters: with an
  -- unclaimed group (user_id NULL) the equality is NULL, and a
  -- bare IF NOT NULL would skip the forbidden branch entirely.
  IF NOT COALESCE(
    v_admin_id = auth.uid()
    OR public.is_group_team(p_group_id)
    OR public.is_gsi_admin(),
    false
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Resolve the window. Explicit starts/ends win over p_days.
  IF p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL THEN
    v_window_start := p_starts_at;
    v_window_end   := p_ends_at;
  ELSE
    v_window_start := now() - (greatest(p_days, 1) || ' days')::interval;
    v_window_end   := now();
  END IF;

  WITH members AS (
    SELECT user_id
    FROM public.group_members
    WHERE group_id = p_group_id
  ),
  member_trips AS (
    SELECT t.*
    FROM public.trips t
    JOIN members m ON m.user_id = t.user_id
    WHERE t.user_confirmed = true
      AND t.started_at >= v_window_start
      AND t.started_at <  v_window_end
  )
  SELECT jsonb_build_object(
    'period_days', p_days,
    'window_start', v_window_start,
    'window_end',   v_window_end,

    'member_count',
      (SELECT count(*) FROM members),

    'trips_this_period',
      (SELECT count(*) FROM member_trips),

    'active_trips_this_period',
      (SELECT count(*) FROM member_trips
        WHERE mode NOT IN ('drive', 'carpool', 'other')),

    'miles_shifted',
      (SELECT COALESCE(
         ROUND(SUM(
           CASE WHEN mode NOT IN ('drive', 'carpool', 'other')
             THEN distance_miles
             ELSE 0
           END
         )::numeric, 1),
         0
       )
       FROM member_trips),

    'co2_avoided_kg',
      (SELECT COALESCE(
         ROUND(SUM(
           CASE WHEN mode NOT IN ('drive', 'carpool', 'other')
             THEN distance_miles * 404 / 1000.0
             ELSE 0
           END
         )::numeric, 2),
         0
       )
       FROM member_trips),

    'mode_breakdown',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'mode', mode,
           'trip_count', trip_count
         ) ORDER BY trip_count DESC)
         FROM (
           SELECT mode::text AS mode, count(*) AS trip_count
           FROM member_trips
           GROUP BY mode
         ) m),
        '[]'::jsonb
      ),

    'shift_rate_trip_pct',
      (SELECT CASE
         WHEN count(*) = 0 THEN 0
         ELSE ROUND(
           count(*) FILTER (
             WHERE mode NOT IN ('drive', 'carpool', 'other')
           )::numeric * 100.0 / count(*),
           1
         )
       END
       FROM member_trips),

    -- Member-level 7d engagement is a "rolling now" metric and intentionally
    -- NOT scoped to the caller's window — the admin dashboard surfaces it as
    -- "who's been active this week?" regardless of the reporting period.
    'shift_rate_7d',
      (SELECT CASE
         WHEN count(*) = 0 THEN 0
         ELSE ROUND(
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.trips t
               WHERE t.user_id = m.user_id
                 AND t.user_confirmed = true
                 AND t.mode NOT IN ('drive', 'carpool', 'other')
                 AND t.started_at >= now() - interval '7 days'
             )
           )::numeric * 100.0 / count(*), 1)
       END
       FROM members m),

    'daily_trips_30d',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'day', day,
           'trips', trips,
           'active_trips', active_trips
         ) ORDER BY day)
         FROM (
           SELECT
             date_trunc('day', started_at)::date AS day,
             count(*) AS trips,
             count(*) FILTER (
               WHERE mode NOT IN ('drive', 'carpool', 'other')
             ) AS active_trips
           FROM public.trips t
           JOIN public.group_members gm ON gm.user_id = t.user_id
           WHERE gm.group_id = p_group_id
             AND t.user_confirmed = true
             AND t.started_at >= now() - interval '30 days'
           GROUP BY 1
         ) d),
        '[]'::jsonb
      ),

    -- 12 rolling weekly buckets (Mon-start; last bucket is the current
    -- partial week). shift_rate_pct is NULL for weeks with no trips so
    -- the chart can distinguish "no data" from "0% shifted".
    'weekly_shift_rates',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'week_start', week_start::date,
           'trips', trips,
           'active_trips', active_trips,
           'shift_rate_pct',
             CASE WHEN trips = 0 THEN NULL
               ELSE ROUND(active_trips::numeric * 100.0 / trips, 1)
             END
         ) ORDER BY week_start)
         FROM (
           SELECT
             ws.week_start,
             count(t.id) AS trips,
             count(t.id) FILTER (
               WHERE t.mode NOT IN ('drive', 'carpool', 'other')
             ) AS active_trips
           FROM generate_series(
             date_trunc('week', now()) - interval '11 weeks',
             date_trunc('week', now()),
             interval '1 week'
           ) AS ws(week_start)
           LEFT JOIN public.group_members gm
             ON gm.group_id = p_group_id
           LEFT JOIN public.trips t
             ON t.user_id = gm.user_id
            AND t.user_confirmed = true
            AND t.started_at >= ws.week_start
            AND t.started_at <  ws.week_start + interval '1 week'
           GROUP BY ws.week_start
         ) w),
        '[]'::jsonb
      )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_dashboard_data(
  uuid, int, timestamptz, timestamptz
) TO authenticated;

-- ============================================================
-- Nudge hardening: per-employee cooldown + opt-out
-- ============================================================
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.group_members.last_nudged_at IS
  'Last time an employer admin nudged this member (7-day cooldown enforced in /api/employer/nudge)';
COMMENT ON COLUMN public.group_members.nudge_opt_out IS
  'Member opted out of employer nudge emails via the unsubscribe link';

-- ============================================================
-- Commute Advisor lookup: accept an invite code as well as a slug.
-- The portal and admin dashboard both build advisor links with
-- `slug ?? invite_code`, so a newly provisioned group without a
-- slug produced a dead link. Same shape/grants as Shift 00336.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_advisor_group_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  tier text,
  status text,
  employer_benefits jsonb,
  commute_advisor_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    g.id,
    g.name,
    g.slug,
    g.logo_url,
    g.tier,
    g.status,
    g.employer_benefits,
    g.commute_advisor_enabled
  FROM public.groups g
  WHERE (g.slug = p_slug OR upper(g.invite_code) = upper(p_slug))
    AND g.status = 'active'
    AND g.commute_advisor_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_group_by_slug(text) TO authenticated, anon;

-- ============================================================
-- Hygiene: group_admins should never be readable by anon.
-- RLS policies already return zero rows for anon, but the grant
-- was a latent footgun if a permissive policy is ever added.
-- ============================================================
REVOKE SELECT ON public.group_admins FROM anon;
