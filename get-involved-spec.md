# /get-involved Page Spec
**For: Claude Code implementation**
**URL: /get-involved**
**Version: March 2026**

---

## Overview

A volunteer recruitment page that channels community interest into specific,
meaningful roles. Tone: warm, active, concrete. No generic "join our mission"
language — every section tells someone exactly what they'd be doing and why
it matters.

Linked from:
- Primary nav ("Get involved")
- Footer under Organization column
- Homepage closing CTA section

---

## Page structure

### 1. Hero

Background: dark navy.
Eyebrow: "GET INVOLVED"
Headline: "Move Greater Boston with us."
Subhead: "Green Streets Initiative runs on community energy. Whether you have
two hours a month or two days a week, there's a role that fits — and real
work that needs doing."

No CTA in the hero — let the roles do the selling.

---

### 2. Role cards

Eight roles displayed as cards. Group them into three visual clusters
with subtle section labels. Cards are dark (#242538 background), not
a table or list — each role deserves its own presence.

Layout: 2-column grid on desktop, single column on mobile.

Each card contains:
- Role name (display font, bold)
- Program tag (small pill: "Walk/Ride Days" / "Shift App" / "School Program" /
  "What Moves Us" / "GSI")
- One-sentence description
- Time ask (e.g., "2–3 hours/month")
- A concrete "what a session looks like" line
- CTA: "I'm interested →" — scrolls to the form below, pre-selecting this role

---

#### Cluster A — "In your community"

**Walk/Ride Day Ambassador**
Program: Walk/Ride Days
Description: Show up on the last Friday of the month and help commuters
discover active transportation firsthand.
Time ask: 2 hours/month
What it looks like: You pick a spot — a busy bus stop, a bike lane entrance,
a train station — show up Friday morning, and encourage people to log their
trip in Shift. Materials provided.

**Story Collector**
Program: What Moves Us
Description: Help commuters share their stories at community events and
farmers markets during active campaigns.
Time ask: 2–4 hours per event, occasional
What it looks like: You table at a local event with a tablet and a brief
script. People record short video or audio responses about how they get
around. You help them feel comfortable and get it done.

---

#### Cluster B — "For schools"

**School Champion**
Program: School Program
Description: Be the inside voice that brings the Shift school program to
a school you're already connected to.
Time ask: 3–5 hours to get started, then occasional check-ins
What it looks like: You're a parent, neighbor, or community member connected
to a target school. You introduce the program to the right administrator,
make the connection to GSI, and help smooth the launch. You don't run the
program — you open the door.

**Safe Route Mapper**
Program: School Program
Description: Scout and document safe walking and biking routes near
target schools.
Time ask: One Saturday morning per school
What it looks like: You walk or ride the routes students would actually
use, note conditions, flag anything that needs attention, and submit a
simple report. GSI uses this to build route guides for families and
teachers. Best done in pairs.

**Walk/Bike Bus Guide**
Program: School Program
Description: Lead a regular group walk or bike ride to school for students
and families.
Time ask: 1–2 mornings per week during the school year
What it looks like: You meet a group of students and parents at a
neighborhood meeting point and walk or ride together to school. You're
the guide — you know the route, you keep the group together, and you
make it fun. Training provided.

---

#### Cluster C — "Behind the scenes"

**Beta Tester**
Program: Shift App
Description: Get early access to Shift and help us find what needs fixing
before we launch.
Time ask: 1–2 hours/week during the beta period
What it looks like: You use the app for your real commute, report bugs
and friction points, and answer occasional follow-up questions from the
team. You get early access and a founding badge when the app launches.

**Content Contributor**
Program: GSI
Description: Share your own active commuting moments so GSI can show
what real behavior change looks like.
Time ask: As much or as little as you want
What it looks like: When you have a good Shift moment — a great bike
commute, a streak milestone, a Walk/Ride Day photo — you share it with
GSI. We handle the posting. Optionally, join a small content working
group that meets monthly to propose ideas and review upcoming posts.

**Grant Researcher**
Program: GSI
Description: Help identify and summarize grant opportunities that fit
GSI's mission.
Time ask: 2–4 hours/month
What it looks like: You scan grant databases and foundation websites,
flag opportunities that fit GSI's work, and write a short summary of
each (funder, amount, deadline, fit). GSI reviews and decides which
to pursue. No grant writing required — just research and synthesis.

---

### 3. Volunteer intake form

Section headline: "Tell us you're interested"
Section subhead: "Fill out the short form below and we'll be in touch
within a week with next steps."

**Fields:**

Your name* (text input)

Email address* (email input)

Which roles interest you? (multi-select checkboxes — list all 8 roles)
Helper text: "Select all that apply. We'll follow up based on your selections."

A little about you (textarea, optional, 3 rows)
Placeholder: "Anything that would help us match you to the right role —
your neighborhood, your connection to GSI, your commute situation,
skills you'd like to use."

How did you hear about volunteering with GSI? (text input, optional)

Submit button: "Send my interest"
Full width on mobile, right-aligned on desktop. Lime background, navy text.

**On submission:**
POST to `/api/volunteer` — same pattern as the contact form API route.

Write to a `volunteer_inquiries` table in Supabase:
```sql
CREATE TABLE volunteer_inquiries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  roles         TEXT[] NOT NULL,
  about         TEXT,
  referral      TEXT,
  status        TEXT DEFAULT 'new',
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE volunteer_inquiries ENABLE ROW LEVEL SECURITY;
```

Send a Resend notification to keith@gogreenstreets.org:
Subject: "New volunteer inquiry: [name]"
Body: name, email, roles selected, about blurb, referral source, timestamp.

Include honeypot field (same pattern as contact form).

**Success state:**
Replace form with:
"Thanks, [first name]. We'll be in touch within a week.
In the meantime — if you haven't already, join the Shift waitlist
so you're ready to go when the app launches.
[Join the waitlist →] links to /#waitlist or the homepage waitlist form"

**Error state:**
"Something went wrong — please try again or email us at
info@gogreenstreets.org"

---

### 4. Closing strip

Full-width dark strip. Centered.
Headline: "Not ready to commit? Start with the app."
Body: "The best way to understand what GSI does is to try it yourself.
Join the Shift waitlist and take your first active trip."
CTA: "Join the waitlist →" links to homepage waitlist section or /shift

---

## Role pre-selection via scroll

When a user clicks "I'm interested →" on a role card, the page should:
1. Smooth-scroll to the form
2. Pre-check that role's checkbox in the multi-select

Implement with a URL hash or a simple React state pass-down.

---

## Nav and footer

Add "Get involved" to the primary nav, linking to /get-involved.
Add "Volunteer" to the footer under the Organization column, linking to /get-involved.
The existing "Volunteer" footer link (if present) should point here.

Do NOT add a donate link or donate section to this page —
/donate will be a separate page built once Donorbox is configured.

---

## Design notes

- Role cards should feel energetic, not bureaucratic. Avoid bullet-point
  descriptions inside cards — use short prose.
- Program tag pills: small, rounded, color-coded by program:
  Walk/Ride Days → lime (#BAF14D) · School Program → blue (#2966E5) ·
  Shift App → lime · What Moves Us → gold (#EDB93C) · GSI → gray (#8A8DA8)
- Time ask line should be visually distinct — smaller, muted, maybe with
  a small clock icon from Phosphor
- The three cluster labels ("In your community," "For schools,"
  "Behind the scenes") should be subtle eyebrows above each group,
  not heavy headers
- Match overall dark navy design language of the rest of the site
