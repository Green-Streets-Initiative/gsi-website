-- Contextual "bike instead" promos for the /nearby + Around You disruption
-- detail. When a rider opens a matching MBTA disruption, the app/web surface a
-- sponsor promo (e.g. Bluebikes' $10 MBTA-closure credit) as an alternative.
-- Deliberately separate from sponsor_offers (lead-capture) and rewards
-- (XP/tier-gated): this is a plain public offer, matched to an alert by
-- effect/route and gated by an active time window. Rows are managed in the
-- Supabase dashboard. Idempotent — safe to re-run.
create table if not exists public.nearby_promos (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  start_at timestamptz,
  end_at timestamptz,
  -- Match: shown when a visible alert's effect is in target_effects (or it's
  -- empty = any) AND the alert's route_ids intersect target_route_ids (or it's
  -- empty = any line).
  target_effects text[] not null default '{}',
  target_route_ids text[] not null default '{}',
  provider text,
  title text not null,
  subtitle text,
  code text,
  amount text,
  sponsor text,
  sponsor_logo_url text,
  cta_label text,
  cta_url text,
  cta_url_ios text,
  cta_url_android text,
  fine_print text,
  updated_at timestamptz not null default now()
);

alter table public.nearby_promos enable row level security;

-- Anon + authenticated see only active, in-window rows, so an expired or
-- deactivated promo disappears from both surfaces with no code change (the card
-- self-sunsets when end_at passes). Writes stay dashboard/service-role only.
drop policy if exists "public_read_live_promos" on public.nearby_promos;
create policy "public_read_live_promos" on public.nearby_promos
  for select using (
    active
    and (start_at is null or now() >= start_at)
    and (end_at is null or now() <= end_at)
  );

grant select on public.nearby_promos to anon, authenticated;

-- Seed: Bluebikes free $10 credit for MBTA closure support (sponsored by Blue
-- Cross Blue Shield of MA). Any major disruption, any line; valid Aug 20-30,
-- 2026 (ET), while supplies last. Fixed id so re-running is a no-op.
insert into public.nearby_promos (
  id, active, start_at, end_at, target_effects, target_route_ids, provider,
  title, subtitle, code, amount, sponsor, cta_label,
  cta_url, cta_url_ios, cta_url_android, fine_print
) values (
  '0a1b2c3d-0000-4000-a000-000000000b26',
  true,
  '2026-08-20T04:00:00Z',   -- 2026-08-20 00:00 ET
  '2026-08-31T03:59:59Z',   -- 2026-08-30 23:59 ET
  array['SHUTTLE','SUSPENSION','STATION_CLOSURE'],
  array[]::text[],
  'bluebikes',
  'Free $10 Bluebikes credit',
  'MBTA closure support',
  'BCBSMAORANGE26',
  '$10',
  'Blue Cross Blue Shield of Massachusetts',
  'Get the Bluebikes app',
  'https://bluebikes.com',
  'https://apps.apple.com/us/app/bluebikes/id1094911566',
  'https://play.google.com/store/apps/details?id=com.motivateco.bostonbikeapp',
  'Valid Aug 20–30, 2026 · while supplies last'
)
on conflict (id) do nothing;
