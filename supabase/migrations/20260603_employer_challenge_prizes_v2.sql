-- ============================================================
-- Employer Challenge Prizes v2 — multi-prize, multi-metric
-- ============================================================
-- Replaces v1 (20260603_employer_challenge_prizes.sql).
-- Safe to run: drops v1 tables (no production data exists yet).
--
-- Changes from v1:
--   • Multiple prizes per challenge (removed unique constraint)
--   • award_mode: 'merit' (top N) or 'drawing' (random eligible)
--   • metric: independent of challenge metric (pct_non_car/trips/active_days/miles)
--   • min_threshold: generic numeric threshold (replaces min_shift_rate_pct)
--   • funded_from_pool defaults false (optional, not required)
--   • amount_cents nullable (null when self-fulfilled)
--   • prize_description for self-fulfilled prizes
--   • Winner rows store metric + metric_value instead of shift_rate_pct

BEGIN;

-- ── Drop v1 ─────────────────────────────────────────────────

DROP TABLE IF EXISTS public.employer_prize_winners CASCADE;
DROP TABLE IF EXISTS public.employer_challenge_prizes CASCADE;
DROP FUNCTION IF EXISTS public.get_employer_challenge_member_rates(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.draw_employer_challenge_prizes(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_employer_prize_eligible_count(uuid, int) CASCADE;

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE public.employer_challenge_prizes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  group_id            uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT 'Gift Card Drawing',
  award_mode          text NOT NULL DEFAULT 'drawing'
    CHECK (award_mode IN ('merit', 'drawing')),
  metric              text NOT NULL DEFAULT 'pct_non_car'
    CHECK (metric IN ('pct_non_car', 'trips', 'active_days', 'miles')),
  min_threshold       numeric,
  winner_count        int NOT NULL DEFAULT 1 CHECK (winner_count BETWEEN 1 AND 50),
  funded_from_pool    boolean NOT NULL DEFAULT false,
  amount_cents        int CHECK (amount_cents IS NULL OR amount_cents > 0),
  prize_description   text,
  auto_draw           boolean NOT NULL DEFAULT true,
  draw_status         text NOT NULL DEFAULT 'pending'
    CHECK (draw_status IN ('pending', 'drawn', 'fulfilled')),
  drawn_at            timestamptz,
  drawn_by            uuid REFERENCES auth.users(id),
  display_order       int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employer_prize_winners (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id              uuid NOT NULL REFERENCES public.employer_challenge_prizes(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric                text NOT NULL,
  metric_value          numeric NOT NULL,
  amount_cents          int,
  drawn_at              timestamptz NOT NULL DEFAULT now(),
  fulfillment_status    text NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'fulfilled', 'forfeited')),
  fulfilled_at          timestamptz,
  tremendous_order_id   text,
  notification_sent     boolean NOT NULL DEFAULT false,
  CONSTRAINT one_win_per_user_per_prize UNIQUE (prize_id, user_id)
);

CREATE INDEX idx_ecp_competition ON public.employer_challenge_prizes(competition_id);
CREATE INDEX idx_ecp_group ON public.employer_challenge_prizes(group_id);
CREATE INDEX idx_epw_prize ON public.employer_prize_winners(prize_id);
CREATE INDEX idx_epw_user ON public.employer_prize_winners(user_id);

CREATE TRIGGER tg_ecp_updated_at
  BEFORE UPDATE ON public.employer_challenge_prizes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.employer_challenge_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_prize_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY ecp_employer_admin ON public.employer_challenge_prizes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = employer_challenge_prizes.group_id
        AND groups.user_id = auth.uid()
    )
  );

CREATE POLICY ecp_gsi_admin ON public.employer_challenge_prizes
  FOR ALL USING (public.is_gsi_admin());

CREATE POLICY epw_employer_admin ON public.employer_prize_winners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.employer_challenge_prizes ecp
      JOIN public.groups g ON g.id = ecp.group_id
      WHERE ecp.id = employer_prize_winners.prize_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY epw_own_wins ON public.employer_prize_winners
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY epw_gsi_admin ON public.employer_prize_winners
  FOR ALL USING (public.is_gsi_admin());

-- ── RPC: per-member stats for a challenge ───────────────────

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
  v_admin_id   uuid;
BEGIN
  SELECT c.group_id, c.starts_at, c.ends_at, g.user_id
  INTO v_group_id, v_starts_at, v_ends_at, v_admin_id
  FROM public.competitions c
  JOIN public.groups g ON g.id = c.group_id
  WHERE c.id = p_competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition_not_found';
  END IF;

  IF NOT (v_admin_id = auth.uid() OR public.is_gsi_admin()) THEN
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

GRANT EXECUTE ON FUNCTION public.get_employer_challenge_member_stats(uuid) TO authenticated;


-- ── RPC: draw winners ───────────────────────────────────────

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
  v_admin_id        uuid;
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

  SELECT user_id INTO v_admin_id
  FROM public.groups WHERE id = v_prize.group_id;

  IF NOT (v_admin_id = auth.uid() OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_competition
  FROM public.competitions WHERE id = v_prize.competition_id;

  IF v_competition.ends_at > now() THEN
    RAISE EXCEPTION 'challenge_not_ended';
  END IF;

  v_draw_seed := COALESCE(p_seed, gen_random_uuid()::text);

  -- Build eligible pool with the metric value used for this prize
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

  -- Apply threshold filter for drawing mode
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

  -- Check pool balance if funded
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

  -- Insert winners
  IF v_prize.award_mode = 'merit' THEN
    -- Top N by metric value (descending)
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
    -- Drawing: deterministic shuffle
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

GRANT EXECUTE ON FUNCTION public.draw_employer_challenge_prizes(uuid, text) TO authenticated;


-- ── RPC: eligible count ─────────────────────────────────────

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
  v_count int;
  v_admin_id uuid;
BEGIN
  SELECT g.user_id INTO v_admin_id
  FROM public.competitions c
  JOIN public.groups g ON g.id = c.group_id
  WHERE c.id = p_competition_id;

  IF NOT (v_admin_id = auth.uid() OR public.is_gsi_admin()) THEN
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

GRANT EXECUTE ON FUNCTION public.get_employer_prize_eligible_count(uuid, text, numeric) TO authenticated;

COMMIT;
