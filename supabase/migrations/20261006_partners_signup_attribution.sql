-- Self-serve partner signup is back (/nearby/partners, 2026-10-06) for the
-- New Routes property-manager and rental-agent outreach. Two columns so each
-- signup can be traced to the channel that sent it:
--   role        what kind of partner they are (picked on the form)
--   signup_utm  the utm tags on the visit that submitted the form
--               ({source, medium, campaign, content}), e.g. the Apollo email
--               that linked them. NULL for direct visits.
-- Neither column is granted to anon (20260819 switched anon to a column-level
-- grant), so both stay private to the service role and the admin dashboard.
-- Idempotent.

alter table public.partners
  add column if not exists role text
    check (role in ('property_manager', 'leasing_agent', 'broker', 'mover', 'other')),
  add column if not exists signup_utm jsonb;

comment on column public.partners.role is
  'Self-reported on /nearby/partners: property_manager | leasing_agent | broker | mover | other. NULL for admin-created rows.';
comment on column public.partners.signup_utm is
  'utm_* tags of the visit that submitted the self-serve form ({source, medium, campaign, content}); NULL if none.';
