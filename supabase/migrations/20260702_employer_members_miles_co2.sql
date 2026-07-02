-- Add miles_in_period and co2_avoided_in_period to get_employer_members
-- Also broaden auth check to include group_admins (viewers) via is_group_team()

CREATE OR REPLACE FUNCTION public.get_employer_members(p_group_id uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(
   user_id              uuid,
   display_name         text,
   avatar_url           text,
   email                text,
   joined_at            timestamp with time zone,
   trips_in_period      bigint,
   active_trips_in_period bigint,
   last_active_at       timestamp with time zone,
   miles_in_period       numeric(8,1),
   co2_avoided_in_period numeric(8,1)
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id      uuid;
  v_is_gsi        boolean;
  v_is_portal     boolean;
  v_window_start  timestamptz;
BEGIN
  SELECT g.user_id INTO v_admin_id
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  v_is_gsi := public.is_gsi_admin();
  v_is_portal := v_admin_id = auth.uid();

  IF NOT (v_is_gsi OR v_is_portal OR public.is_group_team(p_group_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_window_start := now() - (greatest(p_days, 1) || ' days')::interval;

  RETURN QUERY
  SELECT
    u.id                                                 AS user_id,
    u.display_name                                       AS display_name,
    u.avatar_url                                         AS avatar_url,
    CASE WHEN v_is_gsi THEN u.email ELSE NULL END        AS email,
    gm.joined_at                                         AS joined_at,
    COALESCE(tp.trips, 0)                                AS trips_in_period,
    COALESCE(tp.active_trips, 0)                         AS active_trips_in_period,
    CASE WHEN v_is_gsi THEN tp.last_trip_at ELSE NULL END AS last_active_at,
    COALESCE(tp.active_miles, 0)::numeric(8,1)           AS miles_in_period,
    ROUND(COALESCE(tp.active_miles, 0) * 0.404, 1)::numeric(8,1) AS co2_avoided_in_period
  FROM public.group_members gm
  JOIN public.users u ON u.id = gm.user_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)                                           AS trips,
      count(*) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      )                                                  AS active_trips,
      max(t.started_at)                                  AS last_trip_at,
      COALESCE(SUM(t.distance_miles) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      ), 0)                                              AS active_miles
    FROM public.trips t
    WHERE t.user_id = gm.user_id
      AND t.user_confirmed = true
      AND t.started_at >= v_window_start
  ) tp ON true
  WHERE gm.group_id = p_group_id
  ORDER BY active_trips_in_period DESC, gm.joined_at ASC;
END;
$$;
