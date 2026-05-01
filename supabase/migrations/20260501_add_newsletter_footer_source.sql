-- Expand contacts.source CHECK constraint to allow:
--   'newsletter_footer' — set by /api/newsletter-subscribe when someone joins the
--   newsletter via the global website footer signup form.
--
-- Existing allowed values are preserved.

alter table contacts drop constraint if exists contacts_source_check;

alter table contacts add constraint contacts_source_check
  check (source in (
    'constant_contact_import',
    'apollo_import',
    'agent_prospecting',
    'manual',
    'app_waitlist',
    'wmu_field_recorder',
    'newsletter_footer'
  ));
