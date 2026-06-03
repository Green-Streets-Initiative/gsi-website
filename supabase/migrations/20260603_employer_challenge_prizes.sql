-- ============================================================
-- Employer Challenge Prizes — self-service prize drawings
-- ============================================================
-- Employers (Premium tier) can attach a funded prize drawing to
-- their challenge: set a per-winner amount, winner count, and a
-- minimum Shift Rate threshold. When the challenge ends, winners
-- are drawn from the eligible pool (random, not ranked) and
-- prizes are debited from the employer's reward_pools balance.
--
-- Standard-tier employers keep the existing text-only
-- prize_description field on competitions for manual fulfillment.

BEGIN;

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employer_challenge_prizes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  group_id            uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT 'Gift Card Drawing',
  amount_cents        int NOT NULL CHECK (amount_cents > 0),
  winner_count        int NOT NULL DEFAULT 1 CHECK (winner_count BETWEEN 1 AND 50),
  min_shift_rate_pct  int NOT NULL DEFAULT 50 CHECK (min_shift_rate_pct BETWEEN 0 AND 100),
  funded_from_pool    boolean NOT NULL DEFAULT true,
  auto_draw           boolean NOT NULL DEFAULT true,
  draw_status         text NOT NULL DEFAULT 'pending'
    CHECK (draw_status IN ('pending', 'drawn', 'fulfilled')),
  drawn_at            timestamptz,
  drawn_by            uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_prize_per_challenge UNIQUE (competition_id)
);

CREATE TABLE IF NOT EXISTS public.employer_prize_winners (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id              uuid NOT NULL REFERENCES public.employer_challenge_prizes(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents          int NOT NULL,
  shift_rate_pct        numeric(5,1),
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

-- updated_at trigger
CREATE TRIGGER tg_ecp_updated_at
  BEFORE UPDATE ON public.employer_challenge_prizes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.employer_challenge_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_prize_winners ENABLE ROW LEVEL SECURITY;

-- Employer admin: full access to own group's prizes
CREATE POLICY ecp_employer_admin ON public.employer_challenge_prizes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = employer_challenge_prizes.group_id
        AND groups.user_id = auth.uid()
    )
  );

-- GSI admin: full access
CREATE POLICY ecp_gsi_admin ON public.employer_challenge_prizes
  FOR ALL USING (public.is_gsi_admin());

-- Winners: employer admin can see all; employees can see own wins
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

-- ── RPCs ────────────────────────────────────────────────────

-- Get the per-member shift rate for a challenge period, used by
-- the drawing RPC and the portal's "X employees eligible" count.
CREATE OR REPLACE FUNCTION public.get_employer_challenge_member_rates(
  p_competition_id uuid
)
RETURNS TABLE (
  user_id        uuid,
  display_name   text,
  total_trips    bigint,
  active_trips   bigint,
  shift_rate_pct numeric(5,1)
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

  -- Cap end to now if challenge is still running
  IF v_ends_at > now() THEN
    v_ends_at := now();
  END IF;

  RETURN QUERY
  SELECT
    gm.user_id,
    u.display_name,
    COALESCE(tp.total, 0)::bigint AS total_trips,
    COALESCE(tp.active, 0)::bigint AS active_trips,
    CASE
      WHEN COALESCE(tp.total, 0) = 0 THEN 0
      ELSE ROUND(COALESCE(tp.active, 0)::numeric * 100.0 / tp.total, 1)
    END AS shift_rate_pct
  FROM public.group_members gm
  JOIN public.users u ON u.id = gm.user_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) AS total,
      count(*) FILTER (
        WHERE t.mode NOT IN ('drive', 'carpool', 'other')
      ) AS active
    FROM public.trips t
    WHERE t.user_id = gm.user_id
      AND t.user_confirmed = true
      AND t.started_at >= v_starts_at
      AND t.started_at < v_ends_at
  ) tp ON true
  WHERE gm.group_id = v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_challenge_member_rates(uuid) TO authenticated;


-- Draw winners for an employer challenge prize.
CREATE OR REPLACE FUNCTION public.draw_employer_challenge_prizes(
  p_prize_id uuid,
  p_seed     text DEFAULT NULL
)
RETURNS TABLE (
  winner_user_id uuid,
  winner_name    text,
  shift_rate     numeric(5,1),
  amount_cents   int
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
  -- Lock the prize row
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

  -- Verify ownership
  SELECT user_id INTO v_admin_id
  FROM public.groups WHERE id = v_prize.group_id;

  IF NOT (v_admin_id = auth.uid() OR public.is_gsi_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Verify challenge has ended
  SELECT * INTO v_competition
  FROM public.competitions WHERE id = v_prize.competition_id;

  IF v_competition.ends_at > now() THEN
    RAISE EXCEPTION 'challenge_not_ended';
  END IF;

  -- Build eligible pool: members with shift rate >= threshold
  v_draw_seed := COALESCE(p_seed, gen_random_uuid()::text);

  CREATE TEMP TABLE _eligible ON COMMIT DROP AS
  SELECT
    mr.user_id,
    mr.display_name,
    mr.shift_rate_pct,
    md5(v_draw_seed || mr.user_id::text) AS sort_key
  FROM public.get_employer_challenge_member_rates(v_prize.competition_id) mr
  WHERE mr.total_trips > 0
    AND mr.shift_rate_pct >= v_prize.min_shift_rate_pct;

  -- Cap winners at eligible count
  SELECT least(v_prize.winner_count, count(*))::int
  INTO v_actual_winners FROM _eligible;

  IF v_actual_winners = 0 THEN
    -- No eligible winners — mark as drawn with zero winners
    UPDATE public.employer_challenge_prizes
    SET draw_status = 'drawn',
        drawn_at = now(),
        drawn_by = auth.uid()
    WHERE id = p_prize_id;

    RETURN;
  END IF;

  -- Check pool balance if funded
  v_total_cost := v_prize.amount_cents * v_actual_winners;

  IF v_prize.funded_from_pool THEN
    SELECT * INTO v_pool
    FROM public.reward_pools
    WHERE owner_type = 'employer'
      AND owner_group_id = v_prize.group_id
      AND active = true
    FOR UPDATE;

    IF NOT FOUND OR v_pool.balance_cents < v_total_cost THEN
      RAISE EXCEPTION 'insufficient_pool_balance';
    END IF;

    -- Debit pool
    UPDATE public.reward_pools
    SET balance_cents = balance_cents - v_total_cost,
        lifetime_spent_cents = lifetime_spent_cents + v_total_cost
    WHERE id = v_pool.id;
  END IF;

  -- Insert winners (deterministic shuffle via md5)
  INSERT INTO public.employer_prize_winners (
    prize_id, user_id, amount_cents, shift_rate_pct, drawn_at
  )
  SELECT
    p_prize_id,
    e.user_id,
    v_prize.amount_cents,
    e.shift_rate_pct,
    now()
  FROM _eligible e
  ORDER BY e.sort_key
  LIMIT v_actual_winners;

  -- Mark prize as drawn
  UPDATE public.employer_challenge_prizes
  SET draw_status = 'drawn',
      drawn_at = now(),
      drawn_by = auth.uid()
  WHERE id = p_prize_id;

  -- Return winners
  RETURN QUERY
  SELECT
    w.user_id AS winner_user_id,
    u.display_name AS winner_name,
    w.shift_rate_pct AS shift_rate,
    w.amount_cents
  FROM public.employer_prize_winners w
  JOIN public.users u ON u.id = w.user_id
  WHERE w.prize_id = p_prize_id
  ORDER BY w.shift_rate_pct DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.draw_employer_challenge_prizes(uuid, text) TO authenticated;


-- Get eligible count for portal display ("X employees currently eligible")
CREATE OR REPLACE FUNCTION public.get_employer_prize_eligible_count(
  p_competition_id uuid,
  p_min_shift_rate_pct int DEFAULT 50
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
  FROM public.get_employer_challenge_member_rates(p_competition_id) mr
  WHERE mr.total_trips > 0
    AND mr.shift_rate_pct >= p_min_shift_rate_pct;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employer_prize_eligible_count(uuid, int) TO authenticated;

COMMIT;
