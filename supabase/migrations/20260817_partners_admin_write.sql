-- Admin CRUD for the partners table (Outreach Partners page in the GSI admin
-- dashboard at admin.gogreenstreets.org — code in Shift/shift-school/web).
-- Follows the per-verb is_gsi_admin() convention (Shift 00332 sponsor_offers).
-- The public policy stays: anon sees active rows only. Admins additionally
-- see inactive rows — without that, a deactivated partner vanishes from the
-- admin list and can never be reactivated.
-- Idempotent — safe to re-run.

drop policy if exists "partners_admin_select" on public.partners;
create policy "partners_admin_select" on public.partners
  for select using (is_gsi_admin());

drop policy if exists "partners_admin_insert" on public.partners;
create policy "partners_admin_insert" on public.partners
  for insert with check (is_gsi_admin());

drop policy if exists "partners_admin_update" on public.partners;
create policy "partners_admin_update" on public.partners
  for update using (is_gsi_admin());

drop policy if exists "partners_admin_delete" on public.partners;
create policy "partners_admin_delete" on public.partners
  for delete using (is_gsi_admin());

grant insert, update, delete on public.partners to authenticated;

-- Logo uploads from the admin browser (LogoUpload component, anon-key client
-- with the admin's session). The public partner-logos bucket has no storage
-- policies today — the website's partner-form API uploads via service role,
-- which bypasses RLS entirely and keeps working. Admin-gated on both verbs
-- (tighter than wmu-assets' any-authenticated; matches sponsor-logos deletes).
drop policy if exists "partner_logos_admin_insert" on storage.objects;
create policy "partner_logos_admin_insert" on storage.objects
  for insert with check (bucket_id = 'partner-logos' and is_gsi_admin());

drop policy if exists "partner_logos_admin_delete" on storage.objects;
create policy "partner_logos_admin_delete" on storage.objects
  for delete using (bucket_id = 'partner-logos' and is_gsi_admin());
