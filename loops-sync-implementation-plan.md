# Loops Sync — Implementation Plan

**Companion to:** `loops-sync-spec.md` (Draft v3, May 2026)
**Owner:** Keith Anderson · **Implementer:** Claude Code

## Decisions (locked in this round)

1. **App-user consent for v1: opt-out (auto-subscribe at signup).** All `app_signup` contacts get `loops_subscribed = true`. Known liability — explicit opt-in flow is a v2 task. **Mitigation:** every send must carry a working unsubscribe link (Loops handles); welcome email should be sent only after the user has been a Shift account for 24h+ (cold-start dampener); `notification_preferences.weekly_summary = false` is *not* honored in v1 (also v2).
2. **Org-type bundling for v1.** All non-school org types (`business`, `nonprofit`, `government`, `funder`, `employer`) bundle into a single `is_business_partner` boolean → "Business Partners" list. Schools stay separate. **v2 direction:** break out by *relationship*, not org type — separate Loops lists for Rewards Partners, Event Sponsors, Funders, etc., driven by `contact_relationships.relationship_type_id`. The view is structured to make that easy later.
3. **Account deletion behavior.** Hook `delete_user_account()` to mark the linked contact unsubscribed (`loops_subscribed = false`, `loops_unsubscribed_at = now()`, `loops_unsubscribe_reason = 'app_account_deleted'`). Contact row stays in CRM. Add `'app_account_deleted'` to the reason enum.
4. **K-12 emails, WMU respondents: out of scope for v1.** Volunteers are already covered (they go through `contacts` via the volunteer form).

## Spec corrections to apply

These bugs in the spec will be fixed in the implementation:

- **Prize donors ≠ individual donors.** The "Donors" Loops list is reserved for individual donors (people giving money to GSI). No `relationship_types.id = 'donor'` row is seeded yet, so `is_donor` will be `false` for everyone in v1. The view leaves the literal `'donor'` in place as a placeholder — the day someone seeds `INSERT INTO relationship_types (id) VALUES ('donor', ...)`, the Donors list starts populating automatically with no view changes.
- **Prize donors → Business Partners list.** Prize donors are brands (Bluebikes, gift-card sponsors, etc.). For v1 they belong on the Business Partners list, not Donors. The view's `is_business_partner` will OR in `contact_relationships.relationship_type_id = 'prize_donor' AND status IN ('active','won')` so prize_donor brands without a `sponsor_applications`/`partner_invitations`/`organizations.type='business'` link still get the Business Partners list.
- **Org-type check** in `is_business_partner` widened to include `nonprofit | government | funder | employer` (per Decision 2).
- **`SET search_path = public`** added to both trigger functions for Supabase advisor compliance.
- **Reason precedence** in inbound webhook: never downgrade `loops_unsubscribe_reason` from `hard_bounce`/`complaint` to `unsubscribed`/`deleted_in_loops`. Implemented in the receiver, not the schema.
- **Add `'app_account_deleted'` and `'merged_into_other_contact'` to the `loops_unsubscribe_reason` CHECK constraint.**
- **Email-change orphan unsubscribe.** When `sync_user_email_to_contact` re-links a user to an existing contact for the new email, also flip the orphaned contact to `loops_subscribed = false` so it stops receiving mail. Use `COALESCE` on both `loops_unsubscribed_at` and `loops_unsubscribe_reason` so a pre-existing unsubscribe state isn't overwritten by `'merged_into_other_contact'`.
- **Hash-based reconciliation skip.** Add `loops_payload_hash text` column to `contacts`. Reconciler computes hash of the outbound payload; skips the API call if it matches. Cuts daily reconciliation cost from ~150K calls/month to ~delta count.

## Open questions still

(none — pending Phase 0 verification.)

## Phase 0 — Verify (no code, ~10 min)

```sql
-- Run in Supabase SQL editor
select type, count(*) from organizations group by type order by 2 desc;
select id, label, sort_order from relationship_types order by sort_order;
select count(*) from contacts;
select count(*) from users where email is null;  -- expect 0
select count(*) from users u
  left join contacts c on lower(c.email) = lower(u.email)
  where c.id is null;  -- expect: count of users not yet in contacts
```

Numbers from this scan size Phase 1 backfill and confirm `'prize_donor'` is still the only relationship type.

## Phase 1 — Database migration

**File:** `supabase/migrations/00XYZ_loops_audience_layer.sql` in the Shift repo (canonical home for `contacts` migrations).

Single transaction, idempotent. Order:

1. Lowercase pass on `contacts.email`, `users.email`, `launch_waitlist.email`.
2. Extend `contacts.source` CHECK to add `'app_signup'`.
3. Add `users.contact_id uuid references contacts(id) on delete set null` + index.
4. Add `contacts.loops_unsubscribe_reason text` with CHECK including `'app_account_deleted'`.
5. Add `contacts.loops_payload_hash text` (for reconciler skip).
6. Create `contact_sync_log` and `contact_webhook_log` tables.
7. Backfill: link existing users to existing contacts by lowercased email.
8. Backfill: create contacts for users without a match (`source = 'app_signup'`, `loops_subscribed = true`, copy `created_at` from user).
9. Re-link the new contacts back to users.
10. Create trigger functions `ensure_contact_for_user` and `sync_user_email_to_contact` with `SECURITY DEFINER SET search_path = public`.
11. Attach the BEFORE INSERT and BEFORE UPDATE OF email triggers on `users`.
12. Modify `delete_user_account()` to unsubscribe the linked contact before the user row is deleted.
13. Create `v_contact_loops_payload` view (with corrected literals: `'prize_donor'` and broadened org-type check).
14. Comment block at the top documenting the v2 follow-ups (consent flow, relationship-based lists, K-12 audience, hash-based reconciliation).

**Why one migration, not two:** triggers, view, and `delete_user_account` modification all depend on `users.contact_id` and the new contacts.source enum. Splitting risks an intermediate state where new app signups create users but no linked contacts.

**Commit, push, run via `supabase db push --yes` against the linked project.**

## Phase 2 — Loops setup (manual, 15 min)

In Loops UI:
- Settings → Contact Properties: create `signupSource`, `classificationStatus`, `signupDate`, `linkedinUrl`, `neighborhood`, `phone`, `title`. (Use exact camelCase per §5 of the spec.)
- Settings → Mailing Lists: create Newsletter, Shift Updates, Business Partners, Schools, Donors. Capture each `LIST_ID`.
- Settings → API Keys: capture `LOOPS_API_KEY`.
- Settings → Webhooks: hold off until Phase 3 endpoint exists.

Add to `gsi-website/.env.local` and Vercel env:
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

## Phase 3 — gsi-website code

All paths in `/Users/keithanderson/gsi-website/`.

### `src/lib/loops.ts`
Thin `fetch` wrapper. No SDK. Exports:
- `upsertContact(payload): Promise<{ id: string }>` — `PUT /v1/contacts/update`
- `unsubscribe({ email, userId, reason }): Promise<void>`
- `verifyWebhookSignature(req: Request, body: string): boolean`
- Internal: rate-limit honoring (8 req/sec), retry on 429 with backoff (1s, 2s, 4s).

### `src/app/api/webhooks/loops/route.ts` (build first)
- Verify `Webhook-Signature` per Loops scheme. 401 on mismatch.
- Replay protection: dedupe on `Webhook-Id` against `contact_webhook_log.webhook_id`.
- Match contact by `contactIdentity.userId` (uuid → contacts.id), fallback to `contactIdentity.email`.
- Apply per spec table §9 — but with the precedence rule: never downgrade reason from `hard_bounce`/`complaint` to `unsubscribed`/`deleted_in_loops`. Implemented as a SQL `update ... where loops_unsubscribe_reason is null or loops_unsubscribe_reason in ('unsubscribed','deleted_in_loops')` filter when the incoming reason is the latter.
- Insert into `contact_webhook_log`.
- 200 even for unknown contacts (logged).

After this exists and is deployed, add the webhook subscription in Loops UI and verify with their test event.

### `src/app/api/internal/sync-contact-to-loops/route.ts`
Supabase DB webhook receiver.
- Verify `x-internal-secret`. 401 on mismatch.
- Branch on `type`:
  - `INSERT`/`UPDATE`: read `v_contact_loops_payload` by `record.id`. Build payload per §5. `upsertContact()`. Write returned id to `contacts.loops_contact_id`. Write computed `loops_payload_hash`.
  - `DELETE`: `unsubscribe({ email: old_record.email, userId: old_record.id, reason: 'supabase_deleted' })`.
- Log to `contact_sync_log` (action = sync/delete; status = success/failed; full request_body and response_body for debugging).
- Return 500 on Loops 5xx so Supabase retries; 200 on Loops 4xx (logged).

### Pre-flight UPDATE (run once, in production SQL editor)
```sql
update contacts
set loops_subscribed = true
where source = 'constant_contact_import'
  and loops_unsubscribed_at is null
  and loops_subscribed = false;
```

### `scripts/sync-contacts-to-loops.ts`
Idempotent bulk runner. Modes:
- `--dry` → fetch, build, print, no API calls
- `--limit N` → first N rows (for staging)
- `--since-id <uuid>` → resume
- `--reconcile` → skip rows whose payload_hash matches (daily-cron mode)

Throttle 8/sec, exponential backoff on 429. Print summary `synced: N, skipped: K, failed: M`.

### `src/app/api/cron/loops-reconcile/route.ts`
- Verify `Authorization: Bearer ${CRON_SECRET}` (Vercel cron pattern).
- Invoke the same logic as the bulk script in `--reconcile` mode.
- Return `{ synced, skipped, failed }`.

`vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/loops-reconcile", "schedule": "0 7 * * *" }] }
```

## Phase 4 — Wire up & verify

1. Configure Supabase DB Webhook (Studio → Database → Webhooks): table `public.contacts`, all events, POST to `https://gogreenstreets.org/api/internal/sync-contact-to-loops`, header `x-internal-secret: ${SUPABASE_WEBHOOK_SECRET}`.
2. Run pre-flight UPDATE.
3. Run `scripts/sync-contacts-to-loops.ts --dry --limit 5` → eyeball output.
4. Run `scripts/sync-contacts-to-loops.ts --limit 5` → confirm 5 contacts in Loops UI with right list memberships and properties.
5. Run full bulk sync.
6. End-to-end test:
   - Edit a contact's `first_name` in CRM admin → verify Loops update within 2s.
   - Unsubscribe one of the test contacts in Loops → verify Supabase row updated with `reason = 'unsubscribed'`.
   - Hard-delete an app account (with a test user) → verify contact `loops_subscribed = false, reason = 'app_account_deleted'`.
   - Wait for next day's cron at 07:00 → confirm `synced: 0, skipped: <total>, failed: 0` (hash-based skip working).

## Phase 5 — Send the campaign.

## Files I'll create/modify

| File | Action |
|---|---|
| `supabase/migrations/00XYZ_loops_audience_layer.sql` (Shift repo) | new |
| `gsi-website/src/lib/loops.ts` | new |
| `gsi-website/src/app/api/webhooks/loops/route.ts` | new |
| `gsi-website/src/app/api/internal/sync-contact-to-loops/route.ts` | new |
| `gsi-website/src/app/api/cron/loops-reconcile/route.ts` | new |
| `gsi-website/scripts/sync-contacts-to-loops.ts` | new |
| `gsi-website/vercel.json` | edit (add cron) |
| `gsi-website/.env.example` | edit (add Loops vars) |

## Estimate

Phase 1 migration: ~2 hours to write + review.
Phase 3 code: ~4 hours.
Phase 4 verification: ~1 hour.
Total: most of a focused day.

## v2 backlog (out of scope for this round)

- App-user explicit opt-in flow (in-app setting + onboarding screen).
- `notification_preferences.weekly_summary` honored in `v_contact_loops_payload`.
- Relationship-based lists (Rewards Partners, Event Sponsors, Funders, **Individual Donors**, **Prize Donors**, etc.) driven by `contact_relationships.relationship_type_id`. Requires seeding more relationship_types and corresponding pipeline_stages. Once `'donor'` (or `'individual_donor'`) is seeded, the v1 view's Donors list starts populating with no code change. Once a Prize Donors list is created in Loops, prize_donor brands can be split out from Business Partners.
- K-12 audience: backfill `classrooms.teacher_email`, `schools.admin_email`, `classroom_parents` linkage into `contacts` with new source values; add Teachers / Parents lists.
- WMU respondent campaign sends through Loops.
- Dedupe pass for orphaned contacts after email-change.
- Cross-table webhooks (organizations, contact_relationships) for true real-time list-membership updates if daily reconciliation drift becomes a problem.
