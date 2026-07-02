-- ── 1. Raise winner_count ceiling from 50 → 500 ────────────────
-- The inline CHECK has an auto-generated name; find and drop it.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.employer_challenge_prizes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%winner_count%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.employer_challenge_prizes DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.employer_challenge_prizes
  ADD CONSTRAINT employer_challenge_prizes_winner_count_check
  CHECK (winner_count BETWEEN 1 AND 500);


-- ── 2. Add budget_cap_cents (optional) ─────────────────────────
ALTER TABLE public.employer_challenge_prizes
  ADD COLUMN IF NOT EXISTS budget_cap_cents int
  CHECK (budget_cap_cents IS NULL OR budget_cap_cents > 0);


-- ── 3. Update draw RPC: threshold for all modes + budget cap ───
DROP FUNCTION IF EXISTS public.draw_employer_challenge_prizes(uuid, text);

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

  -- Threshold applies to ALL modes (not just drawing)
  IF v_prize.min_threshold IS NOT NULL THEN
    DELETE FROM _eligible WHERE metric_val < v_prize.min_threshold;
  END IF;

  SELECT least(v_prize.winner_count, count(*))::int
  INTO v_actual_winners FROM _eligible;

  -- Budget cap: limit winners so total cost stays within budget
  IF v_prize.budget_cap_cents IS NOT NULL AND v_prize.amount_cents IS NOT NULL THEN
    v_actual_winners := least(v_actual_winners,
      floor(v_prize.budget_cap_cents / v_prize.amount_cents)::int);
  END IF;

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
