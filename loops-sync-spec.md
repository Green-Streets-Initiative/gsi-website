# Supabase ↔ Loops Sync Spec

**Status:** Draft v3, May 2026
**Owner:** Keith Anderson
**Scope:** Bidirectional sync between Supabase contacts and Loops audience, with `contacts` as the single canonical email-bearing layer (CRM contacts and app users both).

**Changes since v2**
- `contacts` is now the canonical audience layer for everyone with an email — CRM contacts and Shift app users alike. New `users.contact_id` FK links the two; new `app_signup` source value covers post-launch app signups; triggers ensure every new user has a contact and that email changes propagate.
- Email normalization (lowercase pass on `contacts.email` and `users.email`) is now part of the migration, not a separate hygiene item.
- `is_shift_user` flag in `v_contact_loops_payload` simplified to use `users.contact_id` linkage instead of cross-table email joins.

**Changes since v1**
- Field mapping rewritten against the real `contacts` schema. Existing `loops_*` columns reused; no new `subscription_state` column.
- Mailing list assignment uses a SQL view (`v_contact_loops_payload`) joining `contacts` to `organizations`, `contact_relationships`, `users`, `launch_waitlist`, `sponsor_applications`, and `partner_invitations`.
- Added `loops_unsubscribe_reason` to distinguish unsubscribe vs bounce vs complaint.
- Pre-flight `UPDATE` for Constant Contact migrants, since `loops_subscribed` defaults to `false`.

---

## 1. Goals

1. Source of truth for contact data is Supabase. Source of truth for engagement state (subscribed / unsubscribed / bounced / complained) is Loops, mirrored back to Supabase via the existing `loops_*` columns.
2. Every person with an email — whether CRM contact or Shift app user — is represented as a row in `contacts` with consistent identity, properties, and mailing list memberships in Loops.
3. When someone unsubscribes, hard-bounces, or complains in Loops, that state reflects in Supabase within seconds.
4. Implementable by Keith + Claude Code without an iPaaS layer.

## 2. Out of scope for v1

- Bi-directional sync of custom properties from Loops back to Supabase (Supabase is authoritative for everything except subscription state).
- Per-mailing-list opt-in UI in CRM admin (track separately).
- Real-time recomputation of list membership when `organizations`, `contact_relationships`, or `users` change. v1 catches `contacts` writes only; membership drift from related-table edits is reconciled by a daily job (§7.4).
- Backfilling `launch_waitlist` rows into `contacts`. Out of scope for now; the view checks `launch_waitlist` directly.

---

## 3. Architecture

```
                ┌─────────────────────────────────────────┐
                │           Supabase (Postgres)           │
                │   contacts (canonical), users, …        │
                │   v_contact_loops_payload (view)        │
                └────────────┬────────────────────────────┘
                             │
                Database Webhook (INSERT/UPDATE/DELETE on contacts)
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ Next.js API route (Vercel)                             │
  │ POST /api/internal/sync-contact-to-loops               │
  │  - Verifies x-internal-secret                          │
  │  - Reads v_contact_loops_payload by row id             │
  │  - PUT https://app.loops.so/api/v1/contacts/update     │
  │  - Stores returned id into contacts.loops_contact_id   │
  │  - Logs to contact_sync_log                            │
  └────────────────────────────────────────────────────────┘

                             ▲
              Outbound webhook │ (contact.unsubscribed,
                               │  email.hardBounced, …)
                               │
  ┌────────────────────────────────────────────────────────┐
  │ Loops                                                  │
  └────────────┬───────────────────────────────────────────┘
               │
               ▼
  ┌────────────────────────────────────────────────────────┐
  │ Next.js API route (Vercel)                             │
  │ POST /api/webhooks/loops                               │
  │  - Verifies Webhook-Signature                          │
  │  - Updates loops_subscribed / loops_unsubscribed_at /  │
  │    loops_unsubscribe_reason                            │
  │  - Logs to contact_webhook_log                         │
  └────────────────────────────────────────────────────────┘
```

---

## 4. Identity & idempotency

- Pass both `email` and `userId` on every sync. `userId` = `contacts.id` (UUID).
- Use `PUT /api/v1/contacts/update` — upsert behavior makes the sync idempotent.
- Set Loops `source` to `"supabase-crm"` on every sync. Don't confuse with `contacts.source` — that maps to a custom property `signupSource`.
- Capture returned `id` from Loops into `contacts.loops_contact_id` for cross-reference.

## 5. Field mapping (Supabase → Loops)

| Supabase (column or computed)         | Loops field            | Notes |
| ------------------------------------- | ---------------------- | ----- |
| `id`                                  | `userId`               | Stable identifier |
| `email`                               | `email`                | Required |
| `first_name`                          | `firstName`            | |
| `last_name`                           | `lastName`             | |
| `loops_subscribed`                    | `subscribed`           | Direct boolean |
| (constant) `"supabase-crm"`           | `source`               | Provenance label in Loops UI |
| computed `user_group` (see §6.1)      | `userGroup`            | Single value per contact |
| `neighborhood`                        | `neighborhood`         | Custom property |
| `phone`                               | `phone`                | Custom property |
| `title`                               | `title`                | Custom property |
| `source` (CRM-side)                   | `signupSource`         | Custom — values: `constant_contact_import`, `apollo_import`, `agent_prospecting`, `manual`, `app_waitlist`, `wmu_field_recorder`, `newsletter_footer`, `app_signup` |
| `classification_status`               | `classificationStatus` | Custom — values: `unclassified`, `enriched`, `qualified` |
| `created_at` (ISO)                    | `signupDate`           | Custom |
| `linkedin_url`                        | `linkedinUrl`          | Custom |

**Custom property prerequisite:** create each in Loops first (Settings → Contact Properties). Use the camelCase API names exactly as listed.

## 6. Mailing lists & userGroup derivation

### 6.1 The view

```sql
CREATE OR REPLACE VIEW public.v_contact_loops_payload
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.title,
  c.neighborhood,
  c.source           AS signup_source,
  c.classification_status,
  c.linkedin_url,
  c.loops_subscribed,
  c.loops_contact_id,
  c.created_at,

  -- Mailing list flags
  (
    EXISTS (SELECT 1 FROM users u WHERE u.contact_id = c.id)
    OR c.source IN ('app_waitlist', 'app_signup')
    OR EXISTS (SELECT 1 FROM launch_waitlist lw WHERE lower(lw.email) = lower(c.email))
  ) AS is_shift_user,

  (
    EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = c.organization_id AND o.type = 'business'
    )
    OR EXISTS (
      SELECT 1 FROM sponsor_applications sa
      WHERE lower(sa.contact_email) = lower(c.email)
        AND sa.status IN ('pending', 'approved')
    )
    OR EXISTS (
      SELECT 1 FROM partner_invitations pi
      WHERE lower(pi.contact_email) = lower(c.email)
        AND pi.status IN ('pending', 'accepted')
    )
  ) AS is_business_partner,

  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = c.organization_id AND o.type = 'school'
  ) AS is_school,

  EXISTS (
    SELECT 1 FROM contact_relationships cr
    WHERE cr.contact_id = c.id
      AND cr.relationship_type_id = 'donor'   -- confirm; see open questions
      AND cr.status IN ('active', 'won')
  ) AS is_donor,

  -- userGroup priority: Donor > Business > School > Shift User > Subscriber
  CASE
    WHEN EXISTS (
      SELECT 1 FROM contact_relationships cr
      WHERE cr.contact_id = c.id
        AND cr.relationship_type_id = 'donor'
        AND cr.status IN ('active', 'won')
    ) THEN 'Donor'
    WHEN EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = c.organization_id AND o.type = 'business'
    ) THEN 'Business'
    WHEN EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = c.organization_id AND o.type = 'school'
    ) THEN 'School'
    WHEN EXISTS (SELECT 1 FROM users u WHERE u.contact_id = c.id) THEN 'Shift User'
    ELSE 'Subscriber'
  END AS user_group
FROM contacts c;
```

### 6.2 Mailing list mapping

| Loops list           | Boolean source from view |
| -------------------- | ------------------------ |
| Newsletter           | always `true` (every synced contact is a candidate; the master `subscribed` flag controls deliverability) |
| Shift Updates        | `is_shift_user` |
| Business Partners    | `is_business_partner` |
| Schools              | `is_school` |
| Donors               | `is_donor` |

Always send explicit `true`/`false` for each list ID — never omit a list, since explicit booleans are how membership stays in lockstep with the source data.

```json
{
  "email": "...",
  "userId": "...",
  "mailingLists": {
    "[NEWSLETTER_LIST_ID]":         true,
    "[SHIFT_UPDATES_LIST_ID]":      true,
    "[BUSINESS_PARTNERS_LIST_ID]":  false,
    "[SCHOOLS_LIST_ID]":            false,
    "[DONORS_LIST_ID]":             false
  }
}
```

---

## 7. Bulk sync (initial migration)

One-time runner, idempotent, resumable. Same script doubles as the daily reconciliation job (§7.4).

- Location: `scripts/sync-contacts-to-loops.ts`
- Reads from `v_contact_loops_payload`, paginated 100 rows at a time
- For each row: build payload per §5 plus list flags per §6.2, then `PUT /v1/contacts/update`
- Throttle: 8 req/sec (Loops cap is 10/sec)
- On 429: exponential backoff (1s, 2s, 4s), retry
- On 4xx other than 429: log to `contact_sync_log` as `failed`, continue
- On success: log to `contact_sync_log` and write returned Loops ID into `contacts.loops_contact_id`
- Print summary: `synced: N, failed: M, total: T`

**Estimated runtime:** ~4 minutes for 1,927 contacts at 8 req/sec. After the unification migration in §10.2 also pulls in app users, that count grows by however many app users exist that aren't already CRM contacts.

**Resumability:** accept `--since-id <uuid>` to resume from a specific contact ID.

### 7.3 Pre-flight UPDATE

`loops_subscribed` defaults to `false`. The Constant Contact import was opted-in. Before the bulk sync:

```sql
UPDATE contacts
SET loops_subscribed = true
WHERE source = 'constant_contact_import'
  AND loops_unsubscribed_at IS NULL;
```

App-signup contacts created during the unification migration (§10.2) are inserted with `loops_subscribed = true` already, so they don't need this step.

### 7.4 Daily reconciliation

Run the bulk sync nightly to catch membership drift from changes to related tables. The script is idempotent. Vercel Cron hitting an admin endpoint with `--reconcile` works.

## 8. Real-time push (Supabase → Loops)

**Configure** in Supabase Studio → Database → Webhooks:
- Name: `loops-sync-contact`
- Table: `public.contacts`
- Events: Insert, Update, Delete
- Method: POST
- URL: `https://gogreenstreets.org/api/internal/sync-contact-to-loops`
- Headers: `x-internal-secret: ${SUPABASE_WEBHOOK_SECRET}`

**Receiver** at `/api/internal/sync-contact-to-loops`:

1. Verify `x-internal-secret`. Reject 401 on mismatch.
2. Parse webhook body (`type`, `record`, `old_record`).
3. Branch:
   - `INSERT` / `UPDATE`: query `v_contact_loops_payload` by `record.id` to get the full computed payload. Build Loops body. `PUT /v1/contacts/update`.
   - `DELETE`: send `PUT /v1/contacts/update` with `{ email: old_record.email, userId: old_record.id, subscribed: false, source: "supabase-crm-deleted" }`. Don't hard-delete from Loops.
4. On 200 from Loops: write returned `id` into `contacts.loops_contact_id` (skip on DELETE).
5. Log to `contact_sync_log`.
6. On Loops 5xx: return 500 (Supabase will retry).
7. On Loops 4xx (non-429): log and return 200.

**Latency target:** <2s end-to-end.

**Limitation:** catches `contacts` writes only. Org-type changes or new `contact_relationships` rows won't trigger immediate re-sync; daily reconciliation handles drift. Note that `users` writes flow through to `contacts` via the triggers in §10.2, so app-side changes do propagate.

## 9. Real-time pull (Loops → Supabase)

**Subscribe** in Loops Settings → Webhooks:

| Event                  | Action in Supabase |
| ---------------------- | ------------------ |
| `contact.unsubscribed` | `loops_subscribed = false`, `loops_unsubscribed_at = now()`, `loops_unsubscribe_reason = 'unsubscribed'` |
| `contact.deleted`      | Same fields, reason = `'deleted_in_loops'` |
| `email.hardBounced`    | Same fields, reason = `'hard_bounce'` (Loops also fires `contact.unsubscribed`; handler must be idempotent) |
| `email.complained`     | Same fields, reason = `'complaint'` |
| `contact.created`      | Log only |
| `contact.updated`      | Log only (drift detection) |

**Receiver** at `/api/webhooks/loops`:

1. Verify `Webhook-Signature` per Loops's signing scheme. Reject 401 on mismatch.
2. Replay protection: check `Webhook-Id` against `contact_webhook_log.webhook_id`. Skip with 200 if seen.
3. Match Supabase contact by `contactIdentity.userId` (preferred) or `contactIdentity.email` (fallback).
4. Apply action.
5. Insert into `contact_webhook_log`.
6. Return 200.

Edge case: webhook arrives for an unknown contact — log and return 200.

## 10. Database changes

### 10.1 Audience-layer additions

```sql
-- Granular suppression reason
alter table contacts
  add column if not exists loops_unsubscribe_reason text
    check (loops_unsubscribe_reason in (
      'unsubscribed', 'deleted_in_loops', 'hard_bounce', 'complaint'
    ));

-- Outbound sync log (Supabase → Loops)
create table if not exists contact_sync_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  email text,
  action text not null,
  status text not null,
  loops_contact_id text,
  error_message text,
  request_body jsonb,
  response_body jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_contact_sync_log_contact on contact_sync_log (contact_id);
create index if not exists idx_contact_sync_log_created on contact_sync_log (created_at desc);

-- Inbound webhook log (Loops → Supabase)
create table if not exists contact_webhook_log (
  id uuid primary key default gen_random_uuid(),
  webhook_id text unique not null,
  event_name text not null,
  contact_id uuid references contacts(id) on delete set null,
  email text,
  payload jsonb,
  processed_at timestamptz default now()
);
create index if not exists idx_contact_webhook_log_event on contact_webhook_log (event_name);
create index if not exists idx_contact_webhook_log_processed on contact_webhook_log (processed_at desc);
```

### 10.2 Contacts/users unification

Run in this order. Each step is idempotent and safe to re-run.

```sql
-- Step 1: Lowercase normalization on existing data
update contacts set email = lower(email) where email <> lower(email);
update users    set email = lower(email) where email is not null and email <> lower(email);
update launch_waitlist set email = lower(email) where email <> lower(email);

-- Step 2: Extend contacts.source enum
alter table contacts drop constraint contacts_source_check;
alter table contacts add constraint contacts_source_check
  check (source in (
    'constant_contact_import','apollo_import','agent_prospecting',
    'manual','app_waitlist','wmu_field_recorder','newsletter_footer',
    'app_signup'   -- NEW
  ));

-- Step 3: Soft FK from users to contacts
alter table users
  add column if not exists contact_id uuid references contacts(id) on delete set null;
create index if not exists idx_users_contact_id on users (contact_id);

-- Step 4: Backfill — link existing users to existing contacts by email
update users u
set contact_id = c.id
from contacts c
where lower(c.email) = lower(u.email)
  and u.contact_id is null;

-- Step 5: Backfill — create contacts for users without a match
with new_contacts as (
  insert into contacts (email, first_name, last_name, source, loops_subscribed, created_at)
  select lower(u.email), u.first_name, u.last_name, 'app_signup', true, u.created_at
  from users u
  where u.contact_id is null and u.email is not null
  on conflict (email) do nothing
  returning id, email
)
update users u
set contact_id = nc.id
from new_contacts nc
where lower(u.email) = nc.email
  and u.contact_id is null;

-- Step 6: Trigger — every new user gets a linked contact
create or replace function ensure_contact_for_user()
returns trigger as $$
declare v_contact_id uuid;
begin
  if new.email is null then return new; end if;
  new.email := lower(new.email);

  select id into v_contact_id
  from contacts where email = new.email
  limit 1;

  if v_contact_id is null then
    insert into contacts (email, first_name, last_name, source, loops_subscribed)
    values (new.email, new.first_name, new.last_name, 'app_signup', true)
    returning id into v_contact_id;
  end if;

  new.contact_id := v_contact_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists ensure_contact_for_user_trigger on users;
create trigger ensure_contact_for_user_trigger
before insert on users
for each row execute function ensure_contact_for_user();

-- Step 7: Trigger — propagate user email changes to the linked contact
create or replace function sync_user_email_to_contact()
returns trigger as $$
declare v_existing_contact_id uuid;
begin
  if new.email is null then return new; end if;
  new.email := lower(new.email);

  if new.email is distinct from old.email then
    -- Does another contact already own the new email?
    select id into v_existing_contact_id
    from contacts
    where email = new.email
      and id is distinct from new.contact_id
    limit 1;

    if v_existing_contact_id is not null then
      -- Re-link the user to that contact; old contact stays as-is
      new.contact_id := v_existing_contact_id;
    elsif new.contact_id is not null then
      -- Update the linked contact's email in lockstep
      update contacts
      set email = new.email, updated_at = now()
      where id = new.contact_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists sync_user_email_to_contact_trigger on users;
create trigger sync_user_email_to_contact_trigger
before update of email on users
for each row execute function sync_user_email_to_contact();
```

### 10.3 The view

Defined in §6.1. Create after §10.2 completes.

## 11. Environment variables

```
LOOPS_API_KEY=
LOOPS_WEBHOOK_SECRET=
SUPABASE_WEBHOOK_SECRET=

LOOPS_LIST_NEWSLETTER_ID=
LOOPS_LIST_SHIFT_UPDATES_ID=
LOOPS_LIST_BUSINESS_PARTNERS_ID=
LOOPS_LIST_SCHOOLS_ID=
LOOPS_LIST_DONORS_ID=
```

## 12. Implementation order

1. **In Loops**: create the 5 mailing lists; capture IDs in env.
2. **In Loops**: create custom contact properties (`neighborhood`, `phone`, `title`, `signupSource`, `classificationStatus`, `signupDate`, `linkedinUrl`).
3. **Supabase**: run §10.1 (audience-layer additions: `loops_unsubscribe_reason`, log tables).
4. **Supabase**: run §10.2 (contacts/users unification: lowercase pass, source enum, FK, backfill, triggers).
5. **Supabase**: create `v_contact_loops_payload` view (§6.1).
6. **Build `/api/webhooks/loops` receiver.** Subscribe to events in Loops. Test with Loops's manual test event. *Do this before bulk sync* — any unsubscribes during migration must be captured.
7. **Run pre-flight UPDATE** (§7.3) to mark CC imports as `loops_subscribed = true`.
8. **Build `scripts/sync-contacts-to-loops.ts`.** Dry-run against 5 contacts. Confirm in Loops UI. Then run the full set.
9. **Build `/api/internal/sync-contact-to-loops` receiver.** Configure Supabase DB webhook. Test with a CRM admin edit.
10. **Schedule daily reconciliation** (Vercel Cron, hitting an admin endpoint that runs the bulk script with `--reconcile`).
11. Send the campaign.

## 13. Open questions

- **`relationship_types` seed values**: confirm `'donor'` is a valid `relationship_type_id`. Are there other types worth mapping (volunteer, sponsor, board member)?
- **Pre-flight `loops_subscribed` UPDATE**: any subset of `constant_contact_import` contacts to exclude (known unsubscribes recorded outside `loops_unsubscribed_at`)?
- **Cross-table webhooks**: start with daily reconciliation only, or also wire DB webhooks on `organizations`, `contact_relationships`, `sponsor_applications`, `partner_invitations`? Recommend daily-only; add table-specific webhooks if drift becomes a real problem.
- **Double opt-in**: enable for the `newsletter_footer` source signups? Recommend yes for that source; existing CRM contacts and admin-added contacts should not require it.
