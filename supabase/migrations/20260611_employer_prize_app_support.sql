-- ============================================================
-- Employer prize app support
--
-- 1. Add reward_link column so the Shift app can deep-link to
--    the Tremendous gift card page.
-- 2. Add employee-facing read policy on employer_challenge_prizes
--    so the PostgREST join (winners → prizes → competitions)
--    works for regular users reading their own wins.
-- 3. Add 'employer_prize_fulfilled' to the notifications type
--    constraint so prize fulfillment triggers in-app notifications.
-- ============================================================

BEGIN;

-- ── reward_link column ─────────────────────────────────────
ALTER TABLE public.employer_prize_winners
  ADD COLUMN IF NOT EXISTS reward_link TEXT;

-- ── Employee read policy on prizes ─────────────────────────
-- Employees can already read their own employer_prize_winners
-- rows (epw_own_wins). This policy lets them also read the
-- prize metadata (name, description) for prizes they've won,
-- so the join returns data instead of empty.
CREATE POLICY ecp_winner_read ON public.employer_challenge_prizes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employer_prize_winners epw
      WHERE epw.prize_id = employer_challenge_prizes.id
        AND epw.user_id = auth.uid()
    )
  );

-- ── Extend notification type constraint ────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'wmu_invitation',
    'points_earned',
    'streak_milestone',
    'challenge_update',
    'challenge_complete',
    'reward_expiring',
    'tier_promotion',
    'weekly_summary',
    'competition_update',
    'community_event',
    'event_reminder',
    'achievement',
    'competition_prize_won',
    'general',
    'referral_prize_entry_earned',
    'referral_first_trip',
    'referral_prize_cap_reached',
    'referral_stage_signup',
    'referral_stage_first_trip',
    'referral_stage_seven_day_streak',
    'community_milestone',
    'employer_prize_fulfilled'
  )
);

COMMIT;
