-- Expand contacts.source CHECK constraint to allow new values:
--   'app_waitlist'        — set by /api/notify-launch when someone joins the Shift app launch waitlist
--   'wmu_field_recorder'  — set by /api/record/submit on newsletter opt-in (silently failing today)
--
-- Existing allowed values (preserved): constant_contact_import, apollo_import, agent_prospecting, manual.

alter table contacts drop constraint if exists contacts_source_check;

alter table contacts add constraint contacts_source_check
  check (source in (
    'constant_contact_import',
    'apollo_import',
    'agent_prospecting',
    'manual',
    'app_waitlist',
    'wmu_field_recorder'
  ));
