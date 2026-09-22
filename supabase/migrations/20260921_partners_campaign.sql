-- Co-branding stops meaning "runs the New Routes campaign".
--
-- Until now isNewRoutesContext() returned true on the mere PRESENCE of a
-- ?partner= slug, so every co-branded snapshot — page and print sheet —
-- carried "Just moved? Unlock $15 for getting around" and the NEWROUTES code.
-- That is right for the movers channel (brokers, property managers) and wrong
-- for a partner who just wants a co-branded snapshot to introduce their own
-- community to what's near them.
--
-- `campaign` makes it explicit: null = co-brand only, 'newroutes' = also runs
-- the campaign. Every row that exists today was created under the old rule, so
-- they all backfill to 'newroutes' and nothing live changes behaviour. New
-- rows default to null.
--
-- Idempotent — safe to re-run. The backfill is INSIDE the add-column branch on
-- purpose: re-running a bare `update ... where campaign is null` would quietly
-- enrol every deliberately-campaign-free partner into New Routes.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'partners' and column_name = 'campaign'
  ) then
    alter table public.partners add column campaign text;
    update public.partners set campaign = 'newroutes';
  end if;
end $$;

-- Only campaigns the web surfaces actually implement. A typo must fail loudly
-- rather than silently becoming "no campaign".
alter table public.partners drop constraint if exists partners_campaign_check;
alter table public.partners add constraint partners_campaign_check
  check (campaign is null or campaign in ('newroutes'));

-- anon holds COLUMN-level grants on this table (20260819_partners_self_service
-- revoked the whole-table one), so a new column is invisible to the public
-- lookup until granted. Without this, the co-brand select errors 42501 and
-- every partner link silently loses its logo.
grant select (campaign) on public.partners to anon;
