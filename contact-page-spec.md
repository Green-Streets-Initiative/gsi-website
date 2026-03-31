# /contact Page Spec
**For: Claude Code implementation**
**Version: March 2026**

---

## Overview

A contact page that handles seven distinct inquiry types with conditional
fields based on inquiry type. Submissions write to Supabase and trigger
a Resend email notification to keith@gogreenstreets.org.

The page also serves as the catch-all destination for all CTA links across
the site that use query parameters (?inquiry=employer, ?inquiry=school, etc.)
— the form should read the query param on load and pre-select the matching
inquiry type automatically.

---

## URL

`/contact`

Linked from:
- Primary nav (replace or supplement "Get involved" — see nav note below)
- All employer CTAs: `/contact?inquiry=employer`
- All school CTAs: `/contact?inquiry=school`
- Rewards partner CTAs: `/contact?inquiry=rewards-partner`
- Footer "Contact" link
- /about placeholder page (once built)

**Nav note:** The current nav has "Get involved" linking to /get-involved
(not yet built). Add "Contact" to the nav now. Once /get-involved is built,
keep both — Contact in the nav, Get Involved as a separate page.

---

## Page layout

Simple, focused. Not a long marketing page — people arriving here have
already decided to reach out.

### Header
- Headline: "Get in touch"
- Subhead: "Whether you're an employer, a school, a local business, or just
  curious — we'd love to hear from you. We'll get back to you within
  2 business days."

### Form
Full-width card on a navy background. Clean, generous spacing.

### Below form
Two small info blocks side by side:
- "Email us directly" — info@gogreenstreets.org (mailto link)
- "Based in" — Cambridge, MA

---

## Form fields

### Always-visible fields

**Your name** *(required)*
Text input. Placeholder: "First and last name"

**Email address** *(required)*
Email input. Placeholder: "your@email.com"

**I'm reaching out about** *(required)*
Dropdown or segmented selector. Options in this order:
- Employer partnership
- School program
- Rewards partner (local business)
- Media / press
- Donate / funding
- Volunteer
- General / other

**Message** *(required)*
Textarea, min 4 rows. Placeholder varies by inquiry type (see below).

### Conditional fields

Shown/hidden based on selected inquiry type. Animate in smoothly
(opacity + height transition, not a jarring jump).

**Employer partnership → show:**
- Company name *(required)* — text input
- Approximate team size — dropdown:
  [ Under 50 · 50–200 · 200–500 · 500+ ]

**School program → show:**
- School name *(required)* — text input
- Grade levels served — multi-select checkboxes:
  [ K–2 · 3–5 · 6–8 · High school ]

**Rewards partner (local business) → show:**
- Business name *(required)* — text input
- Neighborhood / city — text input, placeholder "e.g. Cambridge, Somerville"
- Note below field: "Prefer to apply directly?
  [Complete the rewards partner application →] links to /shift/rewards-partners"

**All other types:** no conditional fields.

### Message placeholder by inquiry type

| Inquiry type | Placeholder |
|---|---|
| Employer partnership | "Tell us about your organization and what you're hoping to accomplish." |
| School program | "Tell us about your school and what you're interested in." |
| Rewards partner | "Tell us about your business and the offer you have in mind." |
| Media / press | "Tell us about your story or request." |
| Donate / funding | "Tell us about your organization or what you'd like to support." |
| Volunteer | "Tell us about yourself and how you'd like to help." |
| General / other | "What's on your mind?" |

### Submit button

Label: "Send message"
Full width on mobile, right-aligned on desktop.
Disabled state while submitting — show a subtle spinner inside the button.
Button color: lime (#BAF14D), navy text.

---

## Query parameter pre-selection

On page load, read the `inquiry` query parameter and pre-select the
matching option in the dropdown:

```typescript
// URL param → dropdown value mapping
const inquiryMap: Record<string, string> = {
  'employer': 'Employer partnership',
  'school': 'School program',
  'rewards-partner': 'Rewards partner (local business)',
  'press': 'Media / press',
  'media': 'Media / press',
  'donate': 'Donate / funding',
  'volunteer': 'Volunteer',
}

// On mount:
const params = useSearchParams()
const inquiry = params.get('inquiry')
if (inquiry && inquiryMap[inquiry]) {
  setSelectedInquiry(inquiryMap[inquiry])
}
```

When pre-selected, the conditional fields for that type should appear
immediately on load (no user interaction required to reveal them).

---

## Form submission

### 1. Client-side validation

Before submission:
- All required fields non-empty
- Email passes basic format check
- Conditional required fields (company name, school name, business name)
  are non-empty when their type is selected

Show inline validation errors below each field, not a top-level error banner.

### 2. API route

Submit to a Next.js API route: `POST /api/contact`

This route runs server-side and handles both Supabase write and Resend send.
Never call Supabase service role or Resend API key from client-side code.

```typescript
// /api/contact/route.ts

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role for server-side write
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
  const body = await req.json()

  // 1. Write to Supabase
  const { error: dbError } = await supabase
    .from('contact_inquiries')
    .insert({
      name: body.name,
      email: body.email,
      inquiry_type: body.inquiryType,
      message: body.message,
      company_name: body.companyName || null,
      team_size: body.teamSize || null,
      school_name: body.schoolName || null,
      grade_levels: body.gradeLevels || null,
      business_name: body.businessName || null,
      neighborhood: body.neighborhood || null,
    })

  if (dbError) {
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  // 2. Send Resend notification
  await resend.emails.send({
    from: 'Shift Website <noreply@gogreenstreets.org>',
    to: 'keith@gogreenstreets.org',
    subject: `New inquiry: ${body.inquiryType}`,
    html: buildEmailHtml(body)
  })

  return Response.json({ success: true })
}
```

### 3. Email template

Plain, readable. No fancy HTML needed — this is an internal notification.

```
Subject: New inquiry: [Employer partnership]

Name: Keith Anderson
Email: keith@example.com
Inquiry type: Employer partnership
Company: Acme Corp
Team size: 200–500

Message:
We're interested in running a commute challenge for our Boston office...

---
Submitted via gogreenstreets.org/contact
[timestamp]
```

### 4. Supabase table

Create via migration:

```sql
CREATE TABLE contact_inquiries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  inquiry_type    TEXT NOT NULL,
  message         TEXT NOT NULL,
  company_name    TEXT,
  team_size       TEXT,
  school_name     TEXT,
  grade_levels    TEXT[],
  business_name   TEXT,
  neighborhood    TEXT,
  status          TEXT DEFAULT 'new',  -- 'new' | 'read' | 'replied' | 'archived'
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: no public read/write — only service role can insert, admin can read
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
```

---

## Form states

### Default
Empty form, General / other pre-selected (or pre-selected from query param).

### Submitting
Button shows spinner, all fields disabled.

### Success
Replace form with confirmation message:
```
✓  Message sent

Thanks, [first name]. We'll be in touch within 2 business days.

In the meantime:
• Learn about the Shift app →  /shift
• See our programs →  /programs
• Join the waitlist →  (scrolls to waitlist form or links to homepage)
```

### Error
Show a non-blocking error below the submit button:
"Something went wrong — please try again or email us directly at
info@gogreenstreets.org"
Do not clear the form. Let the user try again.

---

## Implementation notes

**This is a client component** — it uses useState for form fields,
conditional rendering, and the success/error states. The API route
(`/api/contact`) is the server-side piece.

**Environment variables needed:**
- `SUPABASE_SERVICE_ROLE_KEY` — already in Vercel for other server-side use
- `RESEND_API_KEY` — already in Vercel for app use
- Confirm both are available in the website's Vercel project
  (they may be in the app's project only)

**Spam protection:**
Add a honeypot field — a hidden input that real users won't fill in.
If it's populated on submission, return 200 (don't reveal detection)
but don't write to Supabase or send email.

```typescript
// Hidden honeypot field in the form
<input
  type="text"
  name="website"  // bots love filling in "website"
  className="hidden"
  tabIndex={-1}
  autoComplete="off"
/>
// In API route: if body.website is non-empty, silently return success
```

**No CAPTCHA at launch.** Honeypot is sufficient for a low-traffic nonprofit
site. Add CAPTCHA only if spam becomes a real problem.

**Grade levels as array:**
The grade_levels field stores as a Postgres text array.
On the client, collect as a string[] from the checkboxes.
Send as an array in the POST body.

---

## Content for the page (outside the form)

**Page headline:** "Get in touch"

**Subhead:** "Whether you're an employer, a school, a local business, or
just curious about Shift — we'd love to hear from you.
We'll get back to you within 2 business days."

**Below-form contact info:**
- Email: info@gogreenstreets.org
- Location: Cambridge, MA
- (No phone number listed publicly at this stage)
