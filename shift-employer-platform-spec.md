# Shift Employer Platform — Spec
**For: Claude Code implementation**
**Version: March 2026**
**Depends on: shift-engagement-consolidated-spec.md, competitions table, groups table**

---

## Overview

The Shift employer platform lets companies run active transportation challenges
for their employees — either standalone or as part of a public flagship event
like Shift Your Summer. Employers self-configure via a web portal, employees
join via invite code, and GSI receives a fee for access.

Three distinct components:
1. **Employer portal** — web-based self-service setup and dashboard at
   `/shift/employers/portal`
2. **Employee experience** — in-app group joining, private leaderboard,
   and optional public competition participation
3. **GSI admin tooling** — lightweight admin view of all employer groups
   in the existing admin dashboard

---

## Data model

### New table: `groups`

```sql
CREATE TABLE groups (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT NOT NULL,           -- e.g. "Liberty Mutual"
  slug                TEXT UNIQUE NOT NULL,    -- e.g. "liberty-mutual"
  group_type          TEXT NOT NULL DEFAULT 'workplace',
                      -- 'workplace' | 'school' | 'neighborhood'
  logo_url            TEXT,
  website_url         TEXT,
  city                TEXT,
  state               TEXT DEFAULT 'MA',

  -- Admin contact (portal login)
  admin_name          TEXT,
  admin_email         TEXT NOT NULL,
  admin_phone         TEXT,

  -- Invite code for employee joining
  invite_code         TEXT UNIQUE NOT NULL,    -- 6-char alphanumeric, auto-generated

  -- Public leaderboard visibility (opt-in)
  public_leaderboard  BOOLEAN DEFAULT false,  -- appears on SYS Corporate Challenge tab

  -- Platform access
  tier                TEXT DEFAULT 'basic',   -- 'basic' ($1k) | 'standard' ($3k) | 'premium' ($5k)
  access_starts_at    TIMESTAMPTZ,
  access_ends_at      TIMESTAMPTZ,
  status              TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'inactive'

  -- Supabase Auth link
  user_id             UUID REFERENCES auth.users(id),

  -- Metadata
  notes               TEXT,                   -- GSI internal notes
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate invite code on insert
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invite_code
  BEFORE INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();
```

### New table: `group_members`

```sql
CREATE TABLE group_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id    UUID REFERENCES groups(id),
  user_id     UUID REFERENCES users(id),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);
```

### Update `competitions` table

The `matchup_group_ids` column already exists. When an employer group opts
into a flagship competition, their `groups.id` is added to this array.

```sql
-- Also add a direct group_id FK for standalone employer challenges
-- (already exists as nullable FK per original schema)
-- group_id NULL = flagship/public competition
-- group_id = UUID = employer-scoped standalone challenge
```

### RLS policies

```sql
-- Employers can only read/write their own group
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employer_own_group" ON groups
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "gsiadmin_all_groups" ON groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Group members: users can see their own memberships
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_memberships" ON group_members
  FOR SELECT USING (auth.uid() = user_id);

-- Admins of a group can see all members (aggregate only — no individual trip data)
CREATE POLICY "group_admin_members" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_id
      AND groups.user_id = auth.uid()
    )
  );
```

---

## Component 1: Employer portal

**URL:** `/shift/employers/portal`

Accessible only via Supabase Auth magic link. Redirect to
`/shift/employers` with an error message if accessed without a valid session.

### Employer signup flow (new employers)

Triggered from `/shift/employers` page — "Set up your account →" button.
Only available to employers who have been approved by GSI (status = 'active').

**Step 1 — Verify access**
Email input: "Enter the email address associated with your Shift employer account."
On submit: check if email exists in `groups.admin_email` AND `groups.status = 'active'`.
If yes: send magic link to that email.
If no: show message: "We don't have an account for that email. To get started,
contact us at info@gogreenstreets.org."

Do NOT reveal whether an email exists in the system — show the same
"check your inbox" message regardless.

**Magic link destination:** `/shift/employers/portal`

On first login: show a brief welcome screen confirming company name and
invite code before showing the full dashboard.

---

### Portal dashboard sections

**Header**
Company name + logo (if uploaded) + status badge (Active / Inactive)
Sign out button (top right)

---

**Section 1: Your invite code**

Large, prominent display of the 6-character invite code.
Copy button.

Instructional text:
"Share this code with your employees. They'll enter it in the Shift app
during onboarding or from the Community tab to join your group."

"Download employee invitation" button — generates a simple PDF one-pager
with the invite code, GSI branding, and instructions for downloading Shift.
Build as a client-side PDF using a simple template (no Puppeteer —
use jsPDF or a simple HTML-to-canvas approach).

---

**Section 2: Your challenge**

Two states:

*No active challenge:*
"You haven't set up a challenge yet."
"Create a challenge →" button → opens challenge creation form (see below)

*Active challenge:*
Challenge name, dates, metric, participant count, and a live stats summary:
- Total participants
- Total active trips
- Average Shift Rate across the group
- Top mode (walk / bike / transit)

"View full leaderboard →" → scrolls to leaderboard section below
"Edit challenge →" → opens edit form
"End challenge early" → confirmation modal

---

**Section 3: Challenge creation / edit form**

Fields:
- Challenge name* (text, e.g. "Liberty Mutual Summer Challenge 2026")
- Start date* (date picker)
- End date* (date picker)
- Metric* (dropdown):
  - Shift Rate (% of trips that are active) — recommended
  - Total active trips
  - Active days
  - Miles shifted
- Prize description (text, optional — e.g. "Gift cards for top 3 finishers")

**Public leaderboard opt-in:**
Toggle: "Include our company in the Shift Your Summer public leaderboard"
Helper text: "If enabled, your company will appear on the Corporate Challenge
tab at gogreenstreets.org/events/shift-your-summer alongside other
participating employers. Individual employee data is never shown publicly —
only your company's aggregate Shift Rate and trip count."

Default: OFF.

On save: creates a record in the `competitions` table with:
- `group_id` = this employer's group ID
- `name` = challenge name
- `metric` = selected metric
- `starts_at` / `ends_at` = selected dates
- `is_public` = false (employer challenges are never publicly browsable)
- `event_type` = 'employer'

If public leaderboard opt-in is ON: also adds `groups.id` to
`matchup_group_ids` on the active flagship competition (Shift Your Summer
or equivalent). Requires a flagship competition to exist — if none exists,
show a note: "Public leaderboard participation requires an active flagship
event. We'll add you when one is scheduled."

---

**Section 4: Employee leaderboard**

Shows individual employee standings within the group.
Calls `get_group_member_leaderboard(group_id, p_days)` RPC.

Columns: Rank · Display name · Tier icon · Shift Rate · Active trips

Note at top: "Only employees who have joined your group and completed
at least one trip are shown."

Toggle: show last 7 days / 30 days / full challenge period.

Privacy note below table:
"This leaderboard is visible only to you as the group administrator.
Employees cannot see each other's data except through the shared
in-app leaderboard."

---

**Section 5: Impact report**

Auto-generated. Updates on each page load.

Stats shown:
- Total employees joined
- Total active trips logged
- Total miles shifted
- Total CO₂ avoided (kg)
- Most popular mode
- Average Shift Rate across the group

"Download impact report" button — generates a simple PDF with these stats,
company logo, challenge dates, and GSI branding.
Label it: "[Company name] — Shift Challenge Impact Report — [Date]"

---

**Section 6: Account settings**

Editable fields:
- Company name
- Logo upload (stored in Supabase Storage, `employer-logos` bucket)
- Website URL
- Admin name and phone (email not editable — contact GSI to change)

Save button: PATCH to `groups` table via Supabase client.

---

## Component 2: Employee experience (in-app)

### Joining a group

Two entry points:

**During onboarding:**
After location permissions screen, show: "Does your employer participate
in Shift? Enter your invite code to join their challenge."
Skip link: "Skip for now"

**From Community tab (existing users):**
"Join an employer group" card → prompts for invite code → validates against
`groups.invite_code` → creates `group_members` record → shows confirmation.

Validation:
- If code matches an active group: join and confirm
- If code matches an inactive group: "This employer isn't currently active
  on Shift. Contact your HR team for more information."
- If code not found: "That code doesn't match any employer group.
  Double-check the code and try again."

A user can belong to one employer group at a time. Joining a new group
removes them from the previous one.

### In-app employer leaderboard

Visible in the Community tab after joining a group.
Shows the group's internal leaderboard — same data as the portal
leaderboard section, ranked by the challenge metric.

If the employer has opted into the public flagship leaderboard,
a banner appears: "Your team is competing in Shift Your Summer →"
linking to the public leaderboard page.

### Notifications

When an employer challenge is active, members receive:
- Challenge start notification: "Your [Company] Shift Challenge starts today.
  Every active trip counts."
- Weekly standings update (Saturday): "Week [N] standings: you're ranked
  #X on your team."
- Challenge end notification: "The [Company] Shift Challenge has ended.
  Final results are in."

These use the existing push notification infrastructure.

---

## Component 3: GSI admin tooling

Add an "Employer Groups" section to the existing admin dashboard.

**List view:**
Table of all groups with: company name, admin email, status, tier,
access period, employee count, active challenge (yes/no).

**Detail view (per group):**
- All group fields (editable by GSI admin)
- Invite code (visible, copyable)
- Status toggle: pending → active → inactive
- Notes field
- "Send magic link to admin" button — triggers Supabase Auth magic link
  to the admin email directly from the dashboard

**New group creation:**
GSI admin can create a new employer group after a sale is closed.
Fields: company name, admin email, tier, access start/end dates.
Invite code is auto-generated on save.
Status defaults to 'pending' until GSI manually activates.

---

## Employer portal page on website (/shift/employers/portal)

This is a Next.js page using Supabase Auth.

**Unauthenticated state:**
Show the email input + "Send login link" form only.
No other content — clean, minimal.

**Authenticated state:**
Full dashboard as described above.

**Session handling:**
Use Supabase Auth `onAuthStateChange` to detect session.
Store session in React state — no localStorage.
Auto-redirect to `/shift/employers` on sign-out.

---

## Sponsorship tiers and access control

Three tiers control feature access:

| Feature | Basic ($1k) | Standard ($3k) | Premium ($5k) |
|---|---|---|---|
| Invite code + group joining | ✓ | ✓ | ✓ |
| Internal leaderboard | ✓ | ✓ | ✓ |
| Challenge creation | ✓ | ✓ | ✓ |
| Public leaderboard opt-in | ✓ | ✓ | ✓ |
| Impact report (PDF) | — | ✓ | ✓ |
| Employee invitation PDF | — | ✓ | ✓ |
| Logo on public leaderboard | — | ✓ | ✓ |
| Priority support | — | — | ✓ |
| Custom challenge branding | — | — | ✓ |

Enforce via `groups.tier` field — check tier before rendering gated features
in the portal. Show a tasteful upgrade prompt for features above their tier:
"Available on Standard and above. Contact us to upgrade."

---

## Approval flow

Employers do NOT self-register. The flow is:

1. Employer contacts GSI via `/contact?inquiry=employer`
2. Keith closes the deal, collects payment
3. Keith creates the employer group in the GSI admin dashboard
   (name, admin email, tier, access dates)
4. System auto-generates invite code, sets status = 'pending'
5. Keith sets status = 'active' and clicks "Send magic link to admin"
6. Employer admin receives magic link, accesses portal, sets up challenge

This keeps GSI in control of who gets access while making the post-sale
experience self-service.

---

## URL structure

| URL | Description |
|---|---|
| `/shift/employers` | Marketing page (already built) |
| `/shift/employers/portal` | Employer portal (authenticated) |
| `/api/employer/challenge` | API route: create/update challenge |
| `/api/employer/report` | API route: generate impact report PDF |

---

---

## Stripe subscription integration

### Overview

Employer platform access is sold as an annual auto-renewing subscription.
Payment is collected via Stripe Checkout. Activation is automatic on
successful payment — no manual GSI intervention required for standard signups.
GSI retains the ability to create groups manually in the admin dashboard
for edge cases (invoiced deals, comped access, etc.).

### Stripe products

Create three products in Stripe Dashboard, one per tier:

| Product name | Price | Billing |
|---|---|---|
| Shift Employer — Basic | $1,000 / year | Annual, auto-renewing |
| Shift Employer — Standard | $3,000 / year | Annual, auto-renewing |
| Shift Employer — Premium | $5,000 / year | Annual, auto-renewing |

Store the Stripe Price IDs as environment variables:
```
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_STANDARD=price_xxx
STRIPE_PRICE_PREMIUM=price_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Purchase flow

**Entry point:** `/shift/employers` marketing page.
Add a pricing section with three tier cards, each with a
"Get started" button that initiates the Stripe Checkout flow.

**API route: `POST /api/employer/checkout`**

```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const { tier, adminEmail, companyName } = await req.json()

  const priceId = {
    basic: process.env.STRIPE_PRICE_BASIC,
    standard: process.env.STRIPE_PRICE_STANDARD,
    premium: process.env.STRIPE_PRICE_PREMIUM,
  }[tier]

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: adminEmail,
    metadata: {
      company_name: companyName,
      admin_email: adminEmail,
      tier: tier,
    },
    subscription_data: {
      metadata: {
        company_name: companyName,
        admin_email: adminEmail,
        tier: tier,
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/shift/employers/portal?setup=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/shift/employers`,
  })

  return Response.json({ url: session.url })
}
```

Redirect the browser to `session.url` on the client side.

### Webhook handler: `POST /api/stripe/webhook`

Handles four events:

**`checkout.session.completed`** — new subscription purchased:
```typescript
// 1. Create groups record
const group = await supabase.from('groups').insert({
  name: metadata.company_name,
  slug: slugify(metadata.company_name),
  admin_email: metadata.admin_email,
  tier: metadata.tier,
  status: 'active',
  access_starts_at: new Date(),
  access_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  stripe_customer_id: session.customer,
  stripe_subscription_id: session.subscription,
})

// 2. Create Supabase Auth user for the admin email
await supabase.auth.admin.inviteUserByEmail(metadata.admin_email, {
  redirectTo: `${SITE_URL}/shift/employers/portal`,
  data: { group_id: group.id, role: 'employer_admin' }
})

// 3. Send welcome email via Resend
await resend.emails.send({
  from: 'Shift <noreply@gogreenstreets.org>',
  to: metadata.admin_email,
  subject: 'Welcome to Shift — your employer portal is ready',
  html: buildWelcomeEmail(group)
})
```

**`invoice.payment_succeeded`** — annual renewal:
```typescript
// Update access_ends_at to new period end
await supabase.from('groups')
  .update({
    access_ends_at: new Date(invoice.period_end * 1000),
    status: 'active',
  })
  .eq('stripe_subscription_id', subscription_id)
```

**`customer.subscription.updated`** — upgrade or downgrade:
```typescript
// Update tier and access dates
// Stripe handles proration automatically:
// - Upgrade: charges the difference immediately, prorated
// - Downgrade: issues a credit applied to next invoice (no cash refund)
await supabase.from('groups')
  .update({ tier: newTier })
  .eq('stripe_subscription_id', subscription_id)
```

**`customer.subscription.deleted`** — cancellation:
```typescript
// Do NOT immediately deactivate — preserve access through period end
// access_ends_at is already set correctly from last invoice
// Just mark as cancelled so we know not to expect renewal
await supabase.from('groups')
  .update({ status: 'cancelled' })
  .eq('stripe_subscription_id', subscription_id)

// Send cancellation confirmation via Resend
```

### Data model additions for Stripe

Add to `groups` table:
```sql
ALTER TABLE groups
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN stripe_status TEXT; -- mirrors Stripe subscription status
```

### Employer portal: subscription management section

Add a new section to the portal dashboard between Account Settings
and the bottom of the page.

**Section: Subscription**

Shows:
- Current tier and price
- Next renewal date (from `access_ends_at`)
- "Upgrade plan →" button (if not on Premium)
- "Downgrade plan →" button (if not on Basic)
- "Cancel subscription" link (destructive, requires confirmation)

**Upgrade/downgrade flow:**
Call `POST /api/employer/change-plan` with the new tier.
API route uses Stripe's subscription update API with
`proration_behavior: 'always_invoice'` for upgrades
and `proration_behavior: 'create_prorations'` for downgrades
(credit applied to next invoice).

```typescript
// /api/employer/change-plan
const newPriceId = getPriceIdForTier(newTier)
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: subscriptionItemId, price: newPriceId }],
  proration_behavior: isUpgrade ? 'always_invoice' : 'create_prorations',
})
```

**Cancellation flow:**
"Cancel subscription" → confirmation modal:
"Are you sure? Your access will continue through [access_ends_at date].
No refund will be issued for the remaining period."

Confirm → call `POST /api/employer/cancel`:
```typescript
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
})
// Update groups.status = 'cancelled' in Supabase
// Send cancellation confirmation email via Resend
```

### Access enforcement

The portal dashboard checks `groups.status` and `groups.access_ends_at`
on every load:

```typescript
const now = new Date()
const hasAccess =
  (group.status === 'active' || group.status === 'cancelled') &&
  new Date(group.access_ends_at) > now

if (!hasAccess) {
  // Show expired state with "Renew subscription" CTA
  // linking to /api/employer/checkout for their previous tier
}
```

Note: `status = 'cancelled'` with `access_ends_at` in the future means
they cancelled but still have access. Show a banner:
"Your subscription has been cancelled. Access ends on [date]."

### Pricing section on /shift/employers (website update)

Add a pricing section below the employer FAQ on `/shift/employers`.

Three tier cards in a row:

**Basic — $1,000/year**
- Invite code + group joining
- Internal leaderboard
- Challenge creation
- Public leaderboard opt-in

**Standard — $3,000/year** (recommended badge)
- Everything in Basic
- Impact report PDF
- Employee invitation PDF
- Logo on public leaderboard

**Premium — $5,000/year**
- Everything in Standard
- Priority support
- Custom challenge branding

Each card has a "Get started →" button that POSTs to `/api/employer/checkout`
with the selected tier and prompts for company name + admin email before
redirecting to Stripe Checkout.

Add a note below the cards:
"Annual subscription, auto-renewing. Cancel anytime — access continues
through your paid period. Upgrade or downgrade at any time with prorated
billing."

### Environment variables to add to Vercel

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_BASIC
STRIPE_PRICE_STANDARD
STRIPE_PRICE_PREMIUM
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://www.gogreenstreets.org
```

### Webhook registration

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://www.gogreenstreets.org/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the signing secret and add as `STRIPE_WEBHOOK_SECRET` in Vercel.

---
## Build sequence

**Phase 1 — Foundation**
1. `groups` table migration + invite code trigger
2. `group_members` table migration
3. RLS policies for both tables
4. GSI admin: Employer Groups list view and new group creation

**Phase 2 — Portal**
1. `/shift/employers/portal` page with auth flow
2. Invite code display + copy button
3. Challenge creation form → writes to `competitions` table
4. Account settings section

**Phase 3 — Employee experience**
1. In-app invite code entry (onboarding + Community tab)
2. Group member leaderboard in Community tab
3. Employer challenge push notifications

**Phase 4 — Reporting**
1. Impact stats section in portal
2. Impact report PDF generation
3. Employee invitation PDF generation
4. Public leaderboard opt-in wiring to `matchup_group_ids`

**Phase 5 — Stripe integration**
1. Add Stripe dependency: `npm install stripe @stripe/stripe-js`
2. Create Stripe products and prices in dashboard, add price IDs to Vercel env
3. `/api/employer/checkout` route
4. `/api/stripe/webhook` route (all four events)
5. Subscription management section in portal
6. Pricing section on `/shift/employers` marketing page
7. Access enforcement on portal load
8. Test full flow: purchase → activation → renewal → upgrade → cancel

---

## Implementation notes

**Invite code collision:**
The auto-generate trigger uses 6 chars from MD5 — ~16M possible codes.
Add a unique constraint and a retry loop in the trigger to handle
the (extremely unlikely) collision case.

**Public leaderboard opt-in timing:**
The employer sets this when creating their challenge. If they opt in
after the flagship competition has already started, their group is added
to `matchup_group_ids` and will appear on the next page load of the
leaderboard. No retroactive trip counting needed — `get_event_standings`
is computed dynamically.

**PDF generation:**
Use jsPDF for client-side generation — no server dependency.
Keep templates simple: GSI logo, company logo, stats table, date.
Do not use Puppeteer or any headless browser approach.

**Magic link for admin access:**
Use the same Supabase Auth magic link pattern as the rewards partner portal.
`emailRedirectTo` should point to `/shift/employers/portal`.

**No individual employee data to employers:**
This is a hard requirement. The portal leaderboard shows display names
and aggregate stats only. No trip routes, no location data, no Shift Rate
breakdowns at the individual level beyond what appears on the leaderboard.
The RLS policies enforce this at the database level.

---

*Cross-references: shift-engagement-consolidated-spec.md ·
shift-leaderboard-page-spec.md · shift-rewards-partner-portal-spec.md*
