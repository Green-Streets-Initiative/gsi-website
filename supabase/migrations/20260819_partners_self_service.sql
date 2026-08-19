-- Self-service partner signups (/partners on the website). Self-serve rows
-- insert as status='pending' via the service-role API route; dashboard/admin
-- inserts omit status and get the 'approved' default. Pending links work
-- immediately (the prospect is never blocked); setting 'rejected' silently
-- reverts the link to the default /nearby, same as an unknown slug.
-- Idempotent — safe to re-run.

alter table public.partners
  add column if not exists status text not null default 'approved'
    check (status in ('pending','approved','rejected')),
  add column if not exists contact_email text;

-- Pending shows immediately (self-serve links work on signup); rejected hides.
-- Scoped TO anon: authenticated reads go through partners_admin_select only
-- (the admin dashboard is the sole authenticated reader — checked both repos).
drop policy if exists "public_read_active_partners" on public.partners;
create policy "public_read_active_partners" on public.partners
  for select to anon
  using (active = true and status <> 'rejected');

-- contact_email is not anon-readable: column-level grant instead of the old
-- whole-table one. NOTE: anon select('*') on partners now errors (42501) —
-- the only anon reader, src/lib/nearby/partner.ts, selects explicit columns.
revoke select on public.partners from anon;
grant select (id, slug, name, logo_url, active, status, created_at)
  on public.partners to anon;
-- authenticated keeps its whole-table select (admin page uses select("*")).
