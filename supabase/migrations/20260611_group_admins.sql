-- ============================================================
-- group_admins — multi-admin support for employer portal
--
-- Replaces the single admin_email column on groups as the auth
-- gatekeeper. Each row grants one email access to a group with
-- a role of 'admin' (full access) or 'viewer' (read-only,
-- no billing or settings edits).
-- ============================================================

BEGIN;

-- ── Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_admins (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  name       TEXT,
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, email),
  CONSTRAINT group_admins_role_check CHECK (role IN ('admin', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_group_admins_email ON public.group_admins (email);
CREATE INDEX IF NOT EXISTS idx_group_admins_group_id ON public.group_admins (group_id);


-- ── Helper functions ───────────────────────────────────────────
-- SECURITY DEFINER so RLS policies can query group_admins without
-- circular dependency issues.

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_admins
    WHERE group_id = p_group_id
      AND email = (auth.jwt() ->> 'email')
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_team(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_admins
    WHERE group_id = p_group_id
      AND email = (auth.jwt() ->> 'email')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_team(UUID) TO authenticated;


-- ── Migrate existing data ──────────────────────────────────────

INSERT INTO public.group_admins (group_id, email, role, name)
SELECT id, admin_email, 'admin', admin_name
FROM public.groups
WHERE admin_email IS NOT NULL
ON CONFLICT (group_id, email) DO NOTHING;


-- ── RLS on group_admins ────────────────────────────────────────

ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY ga_admin_all ON public.group_admins
  FOR ALL USING (public.is_group_admin(group_id));

CREATE POLICY ga_viewer_own ON public.group_admins
  FOR SELECT USING (email = (auth.jwt() ->> 'email'));

CREATE POLICY ga_gsi_admin ON public.group_admins
  FOR ALL USING (public.is_gsi_admin());


-- ── Update RLS on groups ───────────────────────────────────────
-- Was: auth.uid() = user_id
-- Now: user's email appears in group_admins

DROP POLICY IF EXISTS "employer_own_group" ON public.groups;
CREATE POLICY "employer_own_group" ON public.groups
  FOR ALL USING (public.is_group_team(id));


-- ── Update RLS on group_members ────────────────────────────────
-- Was: groups.user_id = auth.uid()
-- Now: user is in group_admins for that group

DROP POLICY IF EXISTS "group_admin_members" ON public.group_members;
CREATE POLICY "group_admin_members" ON public.group_members
  FOR SELECT USING (public.is_group_team(group_id));


-- ── Update RLS on employer_challenge_prizes ────────────────────
-- Was: groups.user_id = auth.uid()
-- Now: user is in group_admins (any role can view)

DROP POLICY IF EXISTS ecp_employer_admin ON public.employer_challenge_prizes;
CREATE POLICY ecp_employer_team ON public.employer_challenge_prizes
  FOR ALL USING (public.is_group_team(group_id));


-- ── Update RLS on employer_prize_winners ───────────────────────
-- Was: join through prizes → groups → user_id = auth.uid()
-- Now: join through prizes → group_admins

DROP POLICY IF EXISTS epw_employer_admin ON public.employer_prize_winners;
CREATE POLICY epw_employer_team ON public.employer_prize_winners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.employer_challenge_prizes ecp
      WHERE ecp.id = employer_prize_winners.prize_id
        AND public.is_group_team(ecp.group_id)
    )
  );


-- ── Update RLS on competitions ─────────────────────────────────
-- Was: groups.user_id = auth.uid()

DROP POLICY IF EXISTS "employer_own_competitions" ON public.competitions;
CREATE POLICY "employer_own_competitions" ON public.competitions
  FOR ALL USING (public.is_group_team(group_id));


-- ── Update link_employer_on_login() RPC ────────────────────────
-- Was: WHERE admin_email = v_email
-- Now: WHERE id IN (SELECT group_id FROM group_admins WHERE email = v_email)

CREATE OR REPLACE FUNCTION public.link_employer_on_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.groups
  SET user_id = auth.uid(),
      updated_at = now()
  WHERE id IN (
    SELECT group_id FROM public.group_admins
    WHERE email = v_email
  )
  AND user_id IS NULL;
END;
$$;


-- ── Update get_employer_challenge_member_stats() ───────────────
-- Was: v_admin_id = auth.uid()
-- Now: is_group_admin(v_group_id) OR is_gsi_admin()

CREATE OR REPLACE FUNCTION public.get_employer_challenge_member_stats(
  p_competition_id uuid
)
RETURNS TABLE (
  user_id          uuid,
  display_name     text,
  total_trips      bigint,
  active_trips     bigint,
  shift_rate_pct   numeric(5,1),
  active_days      bigint,
  miles_shifted    numeric(8,1)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_group_id   uuid;
  v_starts_at  timestamptz;
  v_ends_at    timestamptz;
BEGIN
  SELECT c.group_id, c.starts_at, c.ends_at
  INTO v_group_id, v_starts_at, v_ends_at
  FROM public.competitions c
  WHERE c.id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT (public.is_group_team(v_group_id) OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_ends_at > now() THEN
    v_ends_at := now();
  END IF;

  RETURN QUERY
  SELECT
    gm.user_id,
    u.display_name,
    COALESCE(tp.total, 0)::bigint           AS total_trips,
    COALESCE(tp.active, 0)::bigint          AS active_trips,
    CASE
      WHEN COALESCE(tp.total, 0) = 0 THEN 0
      ELSE ROUND(COALESCE(tp.active, 0)::numeric * 100.0 / tp.total, 1)
    END                                     AS shift_rate_pct,
    COALESCE(tp.active_day_count, 0)::bigint AS active_days,
    COALESCE(tp.active_miles, 0)::numeric(8,1) AS miles_shifted
  FROM public.group_members gm
  JOIN public.users u ON u.id = gm.user_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)                                              AS total,
      count(*) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      )                                                     AS active,
      count(DISTINCT date_trunc('day', t.started_at)) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      )                                                     AS active_day_count,
      COALESCE(SUM(t.distance_miles) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      ), 0)                                                 AS active_miles
    FROM public.trips t
    WHERE t.user_id = gm.user_id
      AND t.user_confirmed = true
      AND t.started_at >= v_starts_at
      AND t.started_at < v_ends_at
  ) tp ON true
  WHERE gm.group_id = v_group_id;
END;
$$;


-- ── Update draw_employer_challenge_prizes() ────────────────────
-- Was: v_admin_id = auth.uid()
-- Now: is_group_admin (admin role required for draws)

CREATE OR REPLACE FUNCTION public.draw_employer_challenge_prizes(
  p_prize_id uuid,
  p_seed     text DEFAULT NULL
)
RETURNS TABLE (
  winner_user_id uuid,
  winner_name    text,
  winner_metric  text,
  winner_value   numeric,
  winner_amount  int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_prize           record;
  v_competition     record;
  v_pool            record;
  v_total_cost      int;
  v_actual_winners  int;
  v_draw_seed       text;
BEGIN
  SELECT * INTO v_prize
  FROM public.employer_challenge_prizes
  WHERE id = p_prize_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'prize_not_found';
  END IF;

  IF v_prize.draw_status <> 'pending' THEN
    RAISE EXCEPTION 'already_drawn';
  END IF;

  IF NOT (public.is_group_admin(v_prize.group_id) OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_competition
  FROM public.competitions WHERE id = v_prize.competition_id;

  IF v_competition.ends_at > now() THEN
    RAISE EXCEPTION 'challenge_not_ended';
  END IF;

  v_draw_seed := COALESCE(p_seed, gen_random_uuid()::text);

  CREATE TEMP TABLE _eligible ON COMMIT DROP AS
  SELECT
    ms.user_id,
    ms.display_name,
    CASE v_prize.metric
      WHEN 'pct_non_car'  THEN ms.shift_rate_pct
      WHEN 'trips'        THEN ms.active_trips::numeric
      WHEN 'active_days'  THEN ms.active_days::numeric
      WHEN 'miles'        THEN ms.miles_shifted
    END AS metric_val,
    md5(v_draw_seed || ms.user_id::text) AS sort_key
  FROM public.get_employer_challenge_member_stats(v_prize.competition_id) ms
  WHERE ms.total_trips > 0;

  IF v_prize.award_mode = 'drawing' AND v_prize.min_threshold IS NOT NULL THEN
    DELETE FROM _eligible WHERE metric_val < v_prize.min_threshold;
  END IF;

  SELECT least(v_prize.winner_count, count(*))::int
  INTO v_actual_winners FROM _eligible;

  IF v_actual_winners = 0 THEN
    UPDATE public.employer_challenge_prizes
    SET draw_status = 'drawn', drawn_at = now(), drawn_by = auth.uid()
    WHERE id = p_prize_id;
    RETURN;
  END IF;

  IF v_prize.funded_from_pool AND v_prize.amount_cents IS NOT NULL THEN
    v_total_cost := v_prize.amount_cents * v_actual_winners;

    SELECT * INTO v_pool
    FROM public.reward_pools
    WHERE owner_type = 'employer'
      AND owner_group_id = v_prize.group_id
      AND active = true
    FOR UPDATE;

    IF NOT FOUND OR v_pool.balance_cents < v_total_cost THEN
      RAISE EXCEPTION 'insufficient_pool_balance';
    END IF;

    UPDATE public.reward_pools
    SET balance_cents = balance_cents - v_total_cost,
        lifetime_spent_cents = lifetime_spent_cents + v_total_cost
    WHERE id = v_pool.id;
  END IF;

  IF v_prize.award_mode = 'merit' THEN
    INSERT INTO public.employer_prize_winners (
      prize_id, user_id, metric, metric_value, amount_cents, drawn_at
    )
    SELECT
      p_prize_id,
      e.user_id,
      v_prize.metric,
      e.metric_val,
      v_prize.amount_cents,
      now()
    FROM _eligible e
    ORDER BY e.metric_val DESC
    LIMIT v_actual_winners;
  ELSE
    INSERT INTO public.employer_prize_winners (
      prize_id, user_id, metric, metric_value, amount_cents, drawn_at
    )
    SELECT
      p_prize_id,
      e.user_id,
      v_prize.metric,
      e.metric_val,
      v_prize.amount_cents,
      now()
    FROM _eligible e
    ORDER BY e.sort_key
    LIMIT v_actual_winners;
  END IF;

  UPDATE public.employer_challenge_prizes
  SET draw_status = 'drawn', drawn_at = now(), drawn_by = auth.uid()
  WHERE id = p_prize_id;

  RETURN QUERY
  SELECT
    w.user_id       AS winner_user_id,
    u.display_name  AS winner_name,
    w.metric        AS winner_metric,
    w.metric_value  AS winner_value,
    w.amount_cents  AS winner_amount
  FROM public.employer_prize_winners w
  JOIN public.users u ON u.id = w.user_id
  WHERE w.prize_id = p_prize_id
  ORDER BY w.metric_value DESC;
END;
$$;


-- ── Update get_employer_prize_eligible_count() ─────────────────

CREATE OR REPLACE FUNCTION public.get_employer_prize_eligible_count(
  p_competition_id    uuid,
  p_metric            text DEFAULT 'pct_non_car',
  p_min_threshold     numeric DEFAULT 50
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count    int;
  v_group_id uuid;
BEGIN
  SELECT c.group_id INTO v_group_id
  FROM public.competitions c
  WHERE c.id = p_competition_id;

  IF NOT (public.is_group_admin(v_group_id) OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_employer_challenge_member_stats(p_competition_id) ms
  WHERE ms.total_trips > 0
    AND CASE p_metric
      WHEN 'pct_non_car'  THEN ms.shift_rate_pct
      WHEN 'trips'        THEN ms.active_trips::numeric
      WHEN 'active_days'  THEN ms.active_days::numeric
      WHEN 'miles'        THEN ms.miles_shifted
    END >= p_min_threshold;

  RETURN v_count;
END;
$$;

COMMIT;
