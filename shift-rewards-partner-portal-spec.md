# Shift Rewards Partner Portal — Spec
**URL: /shift/rewards-partners**
**For: Claude Code implementation**
**Version: March 2026**

---

## Overview

A self-service portal for local businesses to apply to join the Shift rewards
partner network, view current partners, and manage their existing partnership.
Lives under the Shift hub at /shift/rewards-partners.

Linked from:
- /shift hub page — "For local businesses" card/section
- Footer — under the Shift column
- NOT in the primary nav

---

## Page sections

### 1. Hero

Background: dark navy (#191A2E)
Eyebrow: "FOR LOCAL BUSINESSES"
Headline: "Reach active commuters in your neighborhood."
Subhead: "Join the Shift rewards network — put your business in front of people
who walk, bike, and ride transit every day. Free to join. No POS integration.
No complicated setup."

Three benefit callouts (small cards or icon + text rows):
- "Visibility where it counts" — Your business appears in the Shift rewards catalog,
  surfaced to active commuters near you.
- "Foot traffic that's earned" — Shift users redeem points by coming in. They're
  motivated, local, and regular.
- "Monthly impact reports" — See how many Shift users redeemed offers at your
  location each month, with neighborhood-level reach data.

CTA: "Become a rewards partner →" — smooth scrolls to the intake form section

---

### 2. Current partners

Headline: "Who's already in the network"
Subhead: "These businesses offer rewards to Shift users across Greater Boston."

Display: logo grid, 4-6 columns on desktop, 2-3 on mobile.
Each item: logo image (from sponsor.logo_url via Supabase Storage) + business name
below. If no logo_url, show a placeholder tile with the business name in text.

Data query:
```sql
SELECT name, logo_url, website_url
FROM sponsors
WHERE status = 'active'
AND sponsor_type IN ('community_reward', 'local')
ORDER BY agreement_signed_at ASC
```

Clicking a logo opens the business website_url in a new tab (if website_url exists).
No click behavior if website_url is null.

If zero active partners: hide this section entirely — don't show an empty grid.

---

### 3. How it works

Three steps, light card treatment:
1. "Apply online" — Fill out the short application below. Tell us about your
   business and the offer you'd like to make to Shift users.
2. "We review and confirm" — A GSI team member reviews your application, confirms
   the details, and sets up your listing in the rewards catalog. We'll be in touch
   within a few business days.
3. "Users come in" — Shift users see your offer in the app, earn points on active
   trips, and redeem at your location by showing their phone. Your staff confirms
   the screen and honors the offer. That's it.

---

### 4. Intake form

Section headline: "Apply to join the network"
Section subhead: "Takes about 5 minutes. Free to participate."

Build as a multi-step form (3 steps) to reduce visual overwhelm.
Show a step indicator at the top (Step 1 of 3, Step 2 of 3, Step 3 of 3).

#### Step 1 — Your business

Fields:
- Business name* (text input)
- Address* (text input)
- City* (text input, pre-filled "Cambridge" but editable)
- Business website (text input, optional, placeholder "https://")
- How did you hear about Shift? (text input — maps to referral_source)

#### Step 2 — Your offer

Explanatory copy above the fields:
"Tell us what you'd like to offer Shift users. Keep it simple and specific —
'10% off any purchase' or 'Free coffee with any food order' work well.
You'll be able to update this anytime from your partner dashboard."

Fields:
- Offer description* (textarea, max 200 chars, char counter shown,
  placeholder "e.g. Free pastry with any coffee purchase")
- Offer limits (text input, optional,
  placeholder "e.g. One per customer per week")

Contact fields (this person receives the magic link for future logins):
- Your name* (text input — maps to contact_name)
- Your title* (text input — maps to signer_title)
- Email address* (text input — maps to contact_email)
  Helper text: "We'll use this to send you a login link to manage your listing."
- Phone number (text input, optional — maps to contact_phone)

#### Step 3 — Agreement

Display the full agreement text (see Agreement Copy section below).

Fields:
- Legal name of signer* (text input — maps to signer_name)
- Checkbox: "I have read and agree to the Shift Rewards Partner Agreement"*
  (maps to agreement_accepted: true — do not allow form submission unless checked)

Submit button: "Submit application"
Button state: disabled until all required fields are valid and checkbox is checked.

#### On submission

POST to Supabase Edge Function:
```
POST https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sponsor-intake
Content-Type: application/json

{
  "business_name": <string>,
  "address": <string>,
  "city": <string>,
  "contact_name": <string>,
  "contact_email": <string>,
  "contact_phone": <string | null>,
  "offer_description": <string>,
  "offer_limits": <string | null>,
  "referral_source": <string | null>,
  "signer_name": <string>,
  "signer_title": <string>,
  "agreement_accepted": true,
  "website_url": <string | null>
}
```

**Data model note:** This Edge Function writes to `sponsor_applications`, not directly
to `sponsors` or `rewards`. The offer fields (`offer_description`, `offer_limits`)
live on `sponsor_applications`. When a GSI admin approves an application in the admin
dashboard, the offer data flows into the `rewards` table:
- `sponsor_applications.offer_description` → `rewards.name` + `rewards.description`
- `sponsor_applications.offer_limits` → appended to `rewards.description`
The `sponsors` table itself has no offer fields — it is purely the business entity
(name, contact, address, logo, status).

Success state: replace the form with a confirmation message:
"Thanks, [business_name]! We'll review your application and be in touch
within a few business days. Check your email — we'll send a confirmation
and a link to your partner dashboard once you're approved."

Error state: show an inline error message below the submit button:
"Something went wrong — please try again or email us at [info@gogreenstreets.org]."
Do not clear the form on error.

---

### 5. Existing partner login

Section headline: "Already a rewards partner?"
Subhead: "Log in to update your offer, edit your contact info, or manage your listing."

Simple email input + "Send login link" button.
On submit: trigger Supabase Auth magic link for the entered email.
Only works if the email matches an existing sponsor.contact_email in the database —
but do NOT reveal whether an email is in the system (show the same success message
regardless):
"If that email is associated with a Shift rewards partner account, you'll receive
a login link shortly. Check your inbox."

---

## Partner dashboard (/shift/rewards-partners/dashboard)

Accessible only via magic link. Supabase Auth session required.
Redirect to /shift/rewards-partners with an error message if accessed without a
valid session.

On load: fetch the sponsor record matching the authenticated user's email
(join on sponsors.contact_email = auth.users.email, or via sponsors.user_id
once the user_id FK is populated on approval).

### Dashboard sections

**Header:**
Business name + status badge (green "Active" or gray "Paused")

**Current offer card:**
Fetch the active reward for this partner:
```sql
SELECT r.name, r.description
FROM rewards r
JOIN sponsors s ON r.sponsor_id = s.id
WHERE s.contact_email = <authenticated_user_email>
AND r.is_active = true  -- verify column name with Code
ORDER BY r.created_at DESC
LIMIT 1
```
If no active reward exists yet (application pending approval), show:
"Your offer is under review. We'll notify you when it's live in the catalog."
If an active reward exists, show rewards.name and rewards.description with an
"Edit offer" button.

**Edit offer form (inline, replaces card on edit):**
- Offer description (textarea, max 200 chars, maps to rewards.name + rewards.description)
- Offer limits (text input, optional — appended to rewards.description on save)
- "Save changes" + "Cancel" buttons
On save: PATCH to the `rewards` table via Supabase client, updating the relevant
reward record linked to this sponsor. Do NOT write back to sponsor_applications —
that table is the original intake record and should be treated as append-only.

**Contact and business info:**
Shows: contact_name, contact_email, contact_phone, address, website_url
"Edit" button → opens inline edit form
Editable fields: all of the above except contact_email
  (email changes require re-verification — show helper text:
  "To change your login email, contact us at info@gogreenstreets.org")

**Partnership status:**
Two action buttons:
- "Pause my listing" (if status = 'active') — sets status = 'inactive',
  removes from public partner grid, shows confirmation message:
  "Your listing is paused. Shift users won't see your offer until you reactivate."
- "Reactivate listing" (if status = 'inactive') — sets status = 'active'
- "End my partnership" — opens a confirmation modal:
  "Are you sure? This will permanently remove your listing from the Shift
  rewards catalog. This action can't be undone."
  On confirm: sets status = 'inactive', adds a note in sponsors.notes:
  "Partnership ended by partner on [date]"
  Note: do NOT delete the record — preserve for historical reporting.

**Sign out:** button in top right, clears Supabase Auth session.

---

## Agreement copy

Display this verbatim in Step 3 of the intake form, in a scrollable box
(max-height: 240px, overflow-y: scroll) with a visible scrollbar so signers
know there's content to read:

---

**Shift Rewards Partner Agreement**
*Green Streets Initiative — [Current Year]*

By submitting this application, you ("Partner") agree to the following terms
with Green Streets Initiative ("GSI"), a 501(c)(3) nonprofit organization based
in Cambridge, Massachusetts.

**1. Program participation**
Partner agrees to honor the offer described in this application ("the Offer")
to verified Shift app users who present a valid redemption confirmation on their
device. GSI will display the Offer in the Shift rewards catalog once this
application is reviewed and approved.

**2. Offer terms**
Partner may set reasonable limits on the Offer (e.g., one per customer per week).
GSI is not responsible for disputes between Partner and customers regarding Offer
redemption. Partner may update or remove the Offer at any time via the partner
dashboard.

**3. No cost to Partner**
Participation in the Shift rewards network is free. GSI does not charge Partner
for listing, impressions, or redemptions.

**4. GSI's role**
GSI operates the Shift app and rewards catalog. GSI does not guarantee any minimum
number of redemptions or user visits to Partner's location. GSI may remove any
Partner listing that violates these terms or that GSI determines is inconsistent
with its mission.

**5. Data and reporting**
GSI will provide Partner with monthly reports showing aggregate redemption counts
and Shift user reach at Partner's location. GSI does not share individual user data
with Partners.

**6. Termination**
Either party may end this agreement at any time. Partner may pause or end their
listing via the partner dashboard. GSI may remove a listing with written notice
to Partner's contact email.

**7. No exclusivity**
This agreement does not create an exclusive relationship. GSI may partner with
other businesses in Partner's category or neighborhood.

**8. Governing law**
This agreement is governed by the laws of the Commonwealth of Massachusetts.

By checking the box below, you confirm that you are authorized to enter into this
agreement on behalf of the business named in this application, and that you have
read and agree to these terms.

---

## Implementation notes

**Supabase client**
Use the existing Supabase client already configured in the project.
For the partner dashboard, use Supabase Auth's magic link flow:
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: enteredEmail,
  options: {
    emailRedirectTo: `${window.location.origin}/shift/rewards-partners/dashboard`
  }
})
```

**Logo images**
Sponsor logos are stored in Supabase Storage at the path in sponsors.logo_url.
Use the Supabase Storage public URL pattern to render them:
```typescript
const logoUrl = supabase.storage
  .from('sponsor-logos')
  .getPublicUrl(sponsor.logo_url).data.publicUrl
```
Verify the bucket name with Code — it may differ from 'sponsor-logos'.

**Form validation**
- Email: standard RFC 5322 validation
- Offer description: max 200 characters, enforce client-side
- All required fields: validate before enabling submit button
- Agreement checkbox: must be checked — do not allow submission otherwise

**Data model summary**
- `sponsor_applications` — intake form submissions (offer_description, offer_limits,
  signer info, agreement). Append-only — never update after submission.
- `sponsors` — approved business entities (name, contact, address, logo, status).
  No offer fields.
- `rewards` — active offers linked to sponsors via rewards.sponsor_id. This is
  what the partner dashboard reads and edits for offer management.
- Approval flow: admin reviews sponsor_applications → creates sponsors record →
  creates rewards record. All handled in admin dashboard, not here.

**No admin functionality on this page**
The public-facing page and partner dashboard are self-service only.
Approval, point value assignment, and admin notes are handled in the
existing admin dashboard — not here.

**Add to /shift hub page**
Add a "For local businesses" section to /shift above the general FAQ,
linking to /shift/rewards-partners. Short version:
- Eyebrow: "FOR LOCAL BUSINESSES"
- Headline: "Join the Shift rewards network."
- Body: "Offer discounts to active commuters in your neighborhood.
  Free to join. No POS integration required."
- CTA: "Learn more →" linking to /shift/rewards-partners

**Add to footer**
Add "Rewards partners" link to the footer under the Shift column,
pointing to /shift/rewards-partners.

**Navigation**
Do NOT add to the primary nav — this page is for a targeted audience
and should remain discoverable but not prominent.
