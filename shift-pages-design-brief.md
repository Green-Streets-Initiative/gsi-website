# Shift Hub + Sub-pages — Design Brief for Code
**For: Claude Code implementation**
**Pages: /shift, /shift/employers, /shift/schools**
**Version: March 2026**

---

## Overview

Build three pages in the existing GSI Next.js project. All pages use the established
design system: navy background (#191A2E), lime accent (#BAF14D), Bricolage Grotesque
for display type, DM Sans for body. Match the visual language of the homepage.

Reference files:
- Content and FAQ: `~/Desktop/shift-faq-complete.md`
- K-12 program details: `~/Desktop/shift-k12-program-spec.md`
- Engagement/tier details: `~/Desktop/shift-engagement-consolidated-spec.md`

---

## Page 1: /shift (hub)

### Purpose
Overview page for all three audiences. Routes individuals to download/waitlist,
employers and schools to their respective sub-pages.

### Nav update
Change the existing "Shift app" nav link to "Shift" and point it to /shift.

### Sections in order

**1. Hero**
- Headline: "Move better. Every trip."
- Subhead: "The Shift app detects your walks, bike rides, and transit trips
  automatically — no tapping, no logging, no thinking about it. Your commute
  earns you real rewards while you move."
- Primary CTA: Download on iOS / Download on Android (placeholder store links)
- Secondary CTA: "See your savings →" linking to /commute-calculator
- Background: dark navy with lime/blue glow treatment matching homepage

**2. How it works — three steps**
Dark card row, three items:
1. "It just works" — Grant location and motion access once. Shift detects your
   walks, bike rides, and transit trips in the background. No tapping required.
2. "Your commute, working for you" — Every active trip earns points, automatically.
   Your tier multiplies your earnings — the more you shift, the more you earn.
   Redeem for real rewards from local businesses.
3. "See what you're gaining" — Time saved. Money kept. Health earned.
   Open the app to check in, or don't. Everything tracks whether you're watching or not.

**3. Built for commuters — three benefit tiles**
Slightly lighter background (#242538). Three cards:
1. "Save real money" — The average Boston commuter spends $8k+ on their car each year.
   Active trips put that money back — and earn you rewards on top.
2. "Feel better" — Active commuters report better sleep, sharper focus, and lower stress.
   Built into your day, not added to it.
3. "Your commute, working for you" — Every active trip earns points redeemable for
   real rewards from local businesses. The more you shift, the more you earn.

**4. For employers**
Dark navy background. Two-column layout.
Left column:
- Eyebrow: "FOR EMPLOYERS"
- Headline: "Your team wants to come in. The commute is what stops them."
- Body: "Boston has some of the worst traffic in the country. Shift helps your
  employees find a way in that they actually enjoy — so the commute stops being
  a reason to stay home."
- CTA button (blue, #2966E5): "Learn more →" linking to /shift/employers

Right column — two lists side by side:
What employers get:
- Higher in-office attendance
- A genuine employee wellness benefit with participation data
- ESG and sustainability reporting — verified active trip data by mode
- Reduced parking demand

What employees get:
- A way in that's cheaper, faster in traffic, and better for their health
- Real rewards earned automatically from every active trip

**5. For schools**
Off-white background (#F4F8EE) with dark text — visual break from the dark sections.
Two-column layout.
Left column:
- Eyebrow: "FOR SCHOOLS" (dark text)
- Headline: "The simplest school wellness program you've ever run." (dark text)
- Body: "No student apps. No accounts. No data on kids. Just a wall chart,
  some stickers, and one Friday photo from the teacher." (dark text)
- CTA button (navy background, lime text): "Learn more →" linking to /shift/schools

Right column — three feature callouts (dark text):
1. "Under 5 minutes a week for teachers" — Post the chart Monday, photograph it Friday.
2. "COPPA-clean by design" — No student accounts, no student devices, no location
   data on minors.
3. "Curriculum-aligned" — Math and science worksheets for K–2, 3–5, and 6–8.

**6. General FAQ**
Dark navy. Accordion component. Questions and answers from
shift-faq-complete.md — "Individual users" section only.
Headline: "Common questions"
Use a clean accordion — one question open at a time, smooth expand/collapse animation.

**7. Closing CTA**
Full-width dark section.
Headline: "Find your shift."
Subhead: "Free to download. Available on iOS and Android.
Join the waitlist for early access in your neighborhood."
Email input + "Join the waitlist" button (same pattern as homepage hero form).
App store badge placeholders below form.

---

## Page 2: /shift/employers

### Purpose
Dedicated page for HR leads, sustainability officers, and office managers evaluating
Shift as an employee benefit or commute challenge program.

### Sections in order

**1. Hero**
- Eyebrow: "FOR EMPLOYERS"
- Headline: "Your team wants to come in. The commute is what stops them."
- Subhead: "Boston has some of the worst traffic in the country. Shift helps your
  employees find a way in that they actually enjoy — so the commute stops being
  a reason to stay home."
- CTA: "Get in touch →" linking to /contact?inquiry=employer

**2. What employers get — four benefit cards**
Four cards in a 2×2 grid:
1. "Higher in-office attendance" — Employees who enjoy their commute come in more.
   Active commuting removes the friction that makes people choose to stay home.
2. "A real wellness benefit" — Real participation data. Mode share by employee.
   CO₂ avoided. Figures you can use in wellness program reports and ESG filings.
3. "ESG and sustainability reporting" — Verified active trip data by mode, total
   CO₂ avoided, and participation rates — ready for your sustainability reports.
4. "Reduced parking demand" — Fewer cars means less pressure on parking supply.
   Track the shift over time.

**3. What employees get — two columns**
Left: "A better commute"
- A way in that's cheaper, faster in traffic, and better for their health
- Real rewards earned automatically from every active trip — no extra effort
- Curated content: local commuter benefits, pre-tax transit pass info,
  nearby bike parking

Right: "Something to compete for"
- Private leaderboard for your team
- Tier status and badge achievements
- Participation in flagship events like Shift Your Summer

**4. How it works — three steps**
1. We configure a private group with your invite code — takes about a week
2. Employees download Shift and join with the code — takes 5 minutes
3. You get aggregate participation data. They get a better commute.

**5. Employer FAQ**
Accordion. Use "Employers" section from shift-faq-complete.md.

**6. CTA**
Headline: "Ready to talk?"
Subhead: "Contact us and we'll set up a conversation. We can typically have
an employer group configured within a week."
CTA button: "Get in touch →" linking to /contact?inquiry=employer

---

## Page 3: /shift/schools

### Purpose
Dedicated page for principals, PTAs, and district administrators evaluating
the Shift school program.

### Sections in order

**1. Hero**
- Eyebrow: "FOR SCHOOLS"
- Headline: "The simplest school wellness program you've ever run."
- Subhead: "No student apps. No accounts. No data on kids. Just a wall chart,
  some stickers, and one Friday photo from the teacher."
- CTA: "Bring it to your school →" linking to /contact?inquiry=school
- Background: off-white (#F4F8EE) with dark text — this page has a lighter
  overall feel than the employer page to match the school context

**2. How it works — four steps**
Light card row, dark text:
1. Monday — Teacher posts the weekly tracking chart
2. Daily — Students mark how they arrived (walk, bike, bus, or car) with a sticker
3. Friday — Teacher photographs the chart and uploads it. That's it — under 5 minutes.
4. Saturday — Shift calculates standings, generates leaderboard posters,
   sends the weekly parent email. Automatically.

**3. What schools get — feature grid**
Six items in a 2×3 or 3×2 grid:
1. Weekly leaderboards at classroom, grade, and school level
2. Auto-generated impact reports for PTAs and school boards
3. Curriculum-aligned worksheets for K–2, 3–5, and 6–8
4. A parent bridge — weekly email connecting families to classroom results
5. COPPA-clean — no student accounts, no student devices, no location data on minors
6. All materials provided by GSI at no cost

**4. Program details — two-column**
Left:
- Grade bands: K–8 (K–2, 3–5, 6–8)
- Competition cycle: monthly
- Modes tracked: Walk, bike, bus, car
- Pilot: Greater Boston schools, 2026

Right:
- Teacher time: under 5 minutes/week
- Student interaction: physical chart + stickers only
- Parent involvement: optional weekly email + Shift app
- Cost to school: free

**5. Framing note — benefit language**
Include a short callout box or highlighted paragraph:
"We lead with health, time outdoors, and community independence — not environmental
messaging. Students learn about the physical benefits of active transportation.
CO₂ impact is available as a secondary data point for older grades."

**6. School FAQ**
Accordion. Use "Schools" section from shift-faq-complete.md.

**7. CTA**
Headline: "Ready to bring Shift to your school?"
Subhead: "Contact us and we'll walk you through what's involved.
Onboarding takes about 30 minutes of your time — we handle everything else."
CTA button: "Get in touch →" linking to /contact?inquiry=school

---

## Shared implementation notes

**Accordion component**
Build a reusable `<FAQ>` component that accepts an array of {question, answer} objects
and renders as a clean accordion. Use it on all three pages. Single question open
at a time, smooth height animation on expand/collapse, lime (#BAF14D) chevron indicator.

**Contact form routing**
The /contact page should accept an `inquiry` query parameter
(?inquiry=employer, ?inquiry=school, ?inquiry=business) that pre-selects the
relevant inquiry type in the contact form. Build this parameter handling into
the contact page when you get to it.

**No route planning language**
Do not include any copy about Shift helping users find routes or plan trips.
Shift tracks trips that have already happened — it is not a trip planner.

**Placeholder links**
- App store download buttons: use # as href for now, labeled "Coming soon"
- Business intake form: use # as href, labeled with a TODO comment
- /contact page: if not yet built, link to the waitlist form as fallback

**Typography**
- All eyebrow labels: 11px, font-semibold, tracking-widest, opacity-60
- All section headlines: font-display, font-extrabold, tracking-tighter
- Body text: font-sans, leading-relaxed, opacity-80 on dark backgrounds,
  opacity-90 on light backgrounds
