# Employer Commute Advisor + Demo Generator — Spec
**For: Claude Code implementation**
**Version: March 2026**
**Depends on: commute-calculator-recommendation-spec.md,
shift-employer-platform-spec.md, groups table**

---

## Overview

Two related features:

1. **Co-branded Commute Advisor** — a personalized version of
   `/commute-advisor` for employer platform subscribers, accessible at
   `/commute-advisor/[employer-slug]`. Pre-fills the destination address,
   incorporates employer-specific benefits into the recommendation and
   cost calculation, and displays savings with and without employer benefits.

2. **Demo generator** — an internal tool at `/admin/demo-generator` that
   creates personalized demo URLs for sales outreach. Uses Clearbit for
   logos and query parameters for dynamic pre-population. No database
   record required for demo links.

---

## Part 1: Co-branded Commute Advisor

### URL structure

`/commute-advisor/[slug]` — where `slug` matches `groups.slug`

Public, no authentication required. Employees share the link freely.

### Data model additions

Add `employer_benefits` JSONB column to the `groups` table:

```sql
ALTER TABLE groups
  ADD COLUMN employer_benefits JSONB DEFAULT '{}';

ALTER TABLE groups
  ADD COLUMN commute_advisor_enabled BOOLEAN DEFAULT true;

-- Example employer_benefits structure:
-- {
--   "destination_address": "157 Berkeley St, Boston, MA 02116",
--   "destination_lat": 42.3497,
--   "destination_lng": -71.0722,
--   "transit_subsidy_monthly": 45,
--   "transit_subsidy_type": "pre_tax",
--   "transit_subsidy_label": "Pre-tax transit benefit (saves ~$15/month in taxes)",
--   "bluebikes_subsidized": true,
--   "bluebikes_subsidy_type": "full",
--   "bluebikes_subsidy_label": "Free Bluebikes annual membership for all employees",
--   "bike_parking": true,
--   "bike_parking_details": "Secure cage, Level B1, Building A",
--   "showers": true,
--   "shower_details": "2nd floor locker rooms, Building A",
--   "free_parking": false,
--   "parking_cost_monthly": null,
--   "shuttle_routes": [
--     {
--       "name": "South Station Express",
--       "from_stop": "South Station (Red/Silver Line)",
--       "schedule": "Departs 7:30, 8:00, 8:30am · Returns 5:00, 5:30, 6:00pm",
--       "details": "Free shuttle, no reservation needed"
--     }
--   ],
--   "other_benefits": "Commuter Choice program — ask HR for details",
--   "hr_contact_name": "Sarah Johnson",
--   "hr_contact_email": "commuter-benefits@company.com"
-- }
```

### Page behavior

On load, fetch the `groups` record matching the slug:

```typescript
const { data: group } = await supabase
  .from('groups')
  .select('name, logo_url, slug, employer_benefits, status, tier')
  .eq('slug', params.slug)
  .eq('status', 'active')
  .eq('commute_advisor_enabled', true)
  .single()

// If not found or not active: redirect to /commute-advisor
// If found: render co-branded version
```

### Visual differences from public version

**Header:**
```
[GSI logo + wordmark]    [Employer logo]
"Commute Advisor for [Company Name] employees"
```

Employer logo served from `groups.logo_url` (Supabase Storage).
If no logo: show company name in display font instead.

**Destination field:**
Pre-filled with `employer_benefits.destination_address`.
Field is editable — employees working remotely or at a different
office can change it. Label: "Your workplace" instead of "Where do you work?"

**"Your employer benefits" section:**
Appears below the address inputs, above the submit button.
Shows a summary of what the employer provides, as a checklist:

```
YOUR [COMPANY NAME] BENEFITS
✓  Pre-tax transit benefit — saves ~$15/month
✓  Free Bluebikes annual membership
✓  Bike parking: Secure cage, Level B1
✓  Showers: 2nd floor locker rooms
✓  Free shuttle from South Station
```

Only show benefits that are configured (non-null/non-false values).
If no benefits are configured, hide this section entirely.

**Recommendation output — two cost columns:**

For Standard tier employers only, the savings breakdown shows
two columns side by side:

```
┌────────────────────────┬──────────────────────────┐
│  WITHOUT YOUR BENEFITS │  WITH YOUR BENEFITS       │
│                        │                           │
│  Transit: $90/mo       │  Transit: $45/mo          │
│  Annual savings: $420  │  Annual savings: $1,260   │
│                        │                           │
│                        │  Your employer saves you  │
│                        │  an extra $840/year       │
└────────────────────────┴──────────────────────────┘
```

For Basic tier: show only the "with benefits" column, no comparison.

**Barrier responses — employer-specific:**

When an employer has relevant amenities configured, override the
generic barrier response with a specific one:

- Barrier "logistics" + showers configured:
  "[Company] has showers and bike storage at [address details].
  No need to worry about arriving sweaty."

- Barrier "safety" + bike_parking configured:
  "Secure bike parking at [details] means your bike is safe
  while you're at work."

- Barrier "time" + shuttle configured:
  "[Company] runs a free shuttle from [stop]. Combined with
  the Red Line, your door-to-door time is [X] minutes."

**Footer of recommendation:**
"Questions about your commute benefits? Contact [hr_contact_name]
at [hr_contact_email]." — only shown if hr_contact fields are set.

**Shift CTA (modified):**
"Track your commute with Shift — [Company] employees who use Shift
can join the [Company] challenge and compete with teammates."
Links to `/shift` or app store as appropriate.

---

### Employer portal: Commute Advisor configuration

Add a new section to the employer portal dashboard (between
"Your challenge" and "Employee leaderboard").

**Section: Commute Advisor**

Eyebrow: "COMMUTE ADVISOR"
Description: "Customize the Commute Advisor for your employees.
Share this link in your onboarding kit or HR portal:
`gogreenstreets.org/commute-advisor/[slug]` [Copy link button]"

**Configuration form fields:**

*Workplace location (required for pre-fill):*
- Workplace address (Google Places Autocomplete, same as calculator)
  → stores address + geocoded lat/lng in employer_benefits

*Transit benefits:*
- Monthly transit subsidy ($) — number input, nullable
- Subsidy type — dropdown: Pre-tax benefit / Direct subsidy / None
- Display label — text input, pre-filled suggestion based on type

*Bike benefits:*
- Bluebikes membership — toggle: Fully subsidized / Partially subsidized / Not offered
- Bike parking available — toggle
- Bike parking details — text input (shown if toggle on)
- Showers available — toggle
- Shower details — text input (shown if toggle on)

*Shuttle routes:*
- Add shuttle route button → inline form:
  - Route name
  - From stop (text)
  - Schedule (text)
  - Details (text)
- List of saved routes with delete option
- Maximum 3 shuttle routes

*Parking:*
- Free parking offered — toggle
  (If on: shows a note "Free parking will be shown as a cost comparison
  factor — employees who drive will see a lower savings estimate")

*HR contact (optional):*
- Contact name
- Contact email
- Helper text: "Shown at the bottom of the Commute Advisor so employees
  know who to contact about benefits."

*Other benefits:*
- Free text field for anything not covered above

**Save button:** PATCH to `groups.employer_benefits` via Supabase client.
Show a success toast and update the preview link.

**Preview button:** Opens `/commute-advisor/[slug]` in a new tab.

---

## Part 2: Demo generator

### URL

`/admin/demo-generator`

This is an internal tool — not linked from the public nav or footer.
Accessible only to users with `role = 'admin'` in the Supabase `users` table.
Redirect to `/` if not authenticated or not admin.

### Purpose

Generates personalized demo URLs for sales outreach. Each URL opens
`/commute-advisor/demo` with query parameters that pre-populate the
employer name, address, and logo.

### Demo generator form

**Fields:**
- Company name* (text input)
- Company domain* (text input, e.g. `libertymutual.com`)
  → used to fetch logo via Clearbit
- Office address* (Google Places Autocomplete)
- Notes (text, optional — for your own reference, not included in URL)

**Logo preview:**
As soon as the domain field loses focus, fetch and preview the logo:
```typescript
const logoUrl = `https://logo.clearbit.com/${domain}`
// Show preview image — if 404, show "No logo found" message
// Clearbit logos are publicly accessible, no API key needed
```

**Generate button:** Creates the demo URL and shows it with a copy button.

**Generated URL format:**
```
https://www.gogreenstreets.org/commute-advisor/demo
  ?company=Liberty+Mutual
  &address=157+Berkeley+St,+Boston,+MA+02116
  &lat=42.3497
  &lng=-71.0722
  &logo=https%3A%2F%2Flogo.clearbit.com%2Flibertymutual.com
```

**Recent demos list:**
Store generated demos in browser localStorage (not Supabase — no need
to persist these server-side). Show the last 20 with company name,
date generated, and copy button. Clear button to remove all.

---

### Demo page: `/commute-advisor/demo`

Reads query parameters on load and renders the co-branded Commute Advisor
experience without requiring a `groups` database record.

```typescript
// In page component:
const searchParams = useSearchParams()
const demoGroup = {
  name: searchParams.get('company') ?? 'Your Company',
  logo_url: searchParams.get('logo') ?? null,
  slug: 'demo',
  tier: 'standard', // always show full Standard features in demo
  employer_benefits: {
    destination_address: searchParams.get('address') ?? null,
    destination_lat: parseFloat(searchParams.get('lat') ?? '0'),
    destination_lng: parseFloat(searchParams.get('lng') ?? '0'),
    // Demo benefits — realistic but fictional
    transit_subsidy_monthly: 45,
    transit_subsidy_type: 'pre_tax',
    transit_subsidy_label: 'Pre-tax transit benefit',
    bluebikes_subsidized: true,
    bluebikes_subsidy_type: 'full',
    bluebikes_subsidy_label: 'Free Bluebikes annual membership',
    bike_parking: true,
    bike_parking_details: 'Secure bike storage on-site',
    showers: true,
    shower_details: 'Locker rooms with showers available',
  }
}
```

**Demo banner:**
A subtle banner at the top of the page (lime background, navy text):
"This is a personalized preview for [Company Name] · [Contact us to get started →]"
The CTA links to `/contact?inquiry=employer`.

The banner makes clear it's a demo without undermining the experience —
the rest of the page looks and functions exactly like a real employer
Commute Advisor.

**No "Your employer benefits" checklist** on the demo — the demo benefits
are pre-set. The checklist would reveal the fictional data. Just let the
recommendation and cost calculation reflect the benefits silently.

---

## Tier access control

| Feature | Basic ($1k) | Standard ($3k) |
|---|---|---|
| Co-branded Commute Advisor | ✓ | ✓ |
| Pre-filled destination | ✓ | ✓ |
| Employer benefits configuration | ✓ | ✓ |
| Benefits checklist shown to employees | ✓ | ✓ |
| Employer-specific barrier responses | ✓ | ✓ |
| Side-by-side savings (with/without benefits) | — | ✓ |
| "Your employer saves you $X/year" callout | — | ✓ |

Enforce via `groups.tier` check in the page component.

---

## Updated employer platform tier table

Replace the three-tier table in `shift-employer-platform-spec.md`
with this two-tier version:

| Feature | Basic ($1k) | Standard ($3k) |
|---|---|---|
| Invite code + group joining | ✓ | ✓ |
| Internal leaderboard | ✓ | ✓ |
| Standalone challenge creation | ✓ | ✓ |
| Co-branded Commute Advisor | ✓ | ✓ |
| Employee invitation PDF | ✓ | ✓ |
| Impact report PDF | — | ✓ |
| Logo on public leaderboard | — | ✓ |
| Side-by-side benefits savings display | — | ✓ |
| Priority support | — | ✓ |
| Custom challenge branding | — | ✓ |

---

## Build sequence

**Phase 1 — Data model**
1. Add `employer_benefits` and `commute_advisor_enabled` columns to `groups`
2. Update RLS: `employer_benefits` readable by anon (needed for public page)
   but writable only by group admin or GSI admin

**Phase 2 — Co-branded page**
1. `/commute-advisor/[slug]` page — fetch group, render co-branded header
2. Pre-filled destination field
3. "Your employer benefits" checklist section
4. Modified cost calculation using employer benefits data
5. Employer-specific barrier responses

**Phase 3 — Standard tier features**
1. Side-by-side savings comparison (with/without benefits)
2. "Your employer saves you $X/year" callout card

**Phase 4 — Employer portal configuration**
1. Commute Advisor section in employer portal dashboard
2. Benefits configuration form
3. Preview link + copy button
4. PATCH to `groups.employer_benefits` on save

**Phase 5 — Demo generator**
1. `/commute-advisor/demo` page with query parameter handling
2. Demo banner with CTA
3. `/admin/demo-generator` internal tool
4. Clearbit logo fetch + preview
5. Generated URL with copy button
6. Recent demos list (localStorage)

---

## Implementation notes

**Clearbit logo API:**
`https://logo.clearbit.com/{domain}` — no API key, returns PNG.
Returns 404 if no logo found. Handle gracefully with a fallback.
Do not store Clearbit URLs in the database — fetch at render time.
The demo generator stores the Clearbit URL in the query parameter
so the demo page doesn't need to re-fetch.

**employer_benefits RLS:**
The co-branded page is public (no auth). The `employer_benefits` column
contains no sensitive data (it's commute benefit info, not PII).
A targeted RLS policy can allow anon reads of specific columns:
```sql
CREATE POLICY "public_read_benefits" ON groups
  FOR SELECT
  USING (status = 'active' AND commute_advisor_enabled = true);
```
Only expose: `name, logo_url, slug, employer_benefits, tier`.
Do NOT expose: `admin_email, admin_phone, notes, stripe_*` columns.
Use a database view or select specific columns in the query.

**Cost calculation with employer benefits:**
The existing savings calculation uses hardcoded transit costs.
Modify to accept an optional `employerBenefits` parameter:
```typescript
function calculateTransitCost(
  daysPerWeek: number,
  employerBenefits?: EmployerBenefits
): number {
  const monthlyPassCost = employerBenefits?.transit_subsidy_monthly
    ? 90 - employerBenefits.transit_subsidy_monthly
    : 90
  // ... rest of calculation
}
```

**Demo page benefits:**
The fictional demo benefits (pre-tax transit, free Bluebikes, bike parking,
showers) are hardcoded in the demo page component. They represent a
realistic but generic employer benefit package. Do not make them
configurable via query params — the demo should always show the same
"with benefits" story.

---

*Cross-references: commute-calculator-recommendation-spec.md ·
shift-employer-platform-spec.md · groups table*
