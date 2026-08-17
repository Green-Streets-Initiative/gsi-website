-- Outreach-partner co-branding for /nearby (brokers, property managers, movers).
-- Deliberately separate from sponsors (Rewards Partners) and organizations (CRM):
-- those carry rewards/CRM baggage and their own RLS postures. Rows are managed in
-- the Supabase dashboard; logos live in the public partner-logos bucket.
-- Idempotent — safe to re-run.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

-- Anon sees only active partners, so deactivating a row reverts that partner's
-- co-branded URLs to the default page with no code change. Writes stay
-- dashboard/service-role only (no anon policies beyond this select).
drop policy if exists "public_read_active_partners" on public.partners;
create policy "public_read_active_partners" on public.partners
  for select using (active = true);

grant select on public.partners to anon, authenticated;
