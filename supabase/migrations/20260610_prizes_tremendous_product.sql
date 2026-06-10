-- Add Tremendous product selection to employer challenge prizes.
-- Stores which reward product the admin chose when configuring a
-- pool-funded prize, so the fulfillment flow knows what to order.

ALTER TABLE public.employer_challenge_prizes
  ADD COLUMN tremendous_product_id text;
