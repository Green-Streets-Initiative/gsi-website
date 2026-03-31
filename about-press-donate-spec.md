# /about, /press, /donate — Page Specs
**For: Claude Code implementation**
**Version: March 2026**

---

## Page 1: /about

**URL:** /about
**Nav:** Add "Our story" to footer under Organization column, linking to /about.
The primary nav already has sufficient links — do not add /about to the top nav.

---

### Sections in order

**1. Hero**
Background: dark navy.
Eyebrow: "ABOUT US"
Headline: "Twenty years of moving Massachusetts."
Subhead: "Green Streets Initiative has been helping people shift trips to
healthier, cheaper, cleaner alternatives since 2006 — and measuring the impact,
trip by trip, community by community."

**2. Our story**
Off-white background (#F4F8EE), dark text. Single column, max-width prose.
Eyebrow: "OUR STORY"

Body:
"Green Streets Initiative was founded in Cambridge in 2006 by Janie Katz-Christy,
who spent two decades building one of the state's most trusted active
transportation organizations. What started as a community-focused advocacy and
programming effort grew into a multi-city platform running Walk/Ride Days, What
Moves Us storytelling campaigns, and employer and school programs across
Massachusetts.

In 2026, GSI enters a new chapter. With Janie's founding vision as the
foundation, we're relaunching around Shift — a behavior change platform that
makes active transportation measurable, competitive, and rewarding. The programs
that made GSI trusted for twenty years now run on technology that scales."

**3. Mission statement**
Dark navy. Full-width centered treatment — same style as the mission strip
on the homepage.
Eyebrow: "OUR MISSION"
Large display text:
"Green Streets Initiative helps people shift trips to healthier, cheaper,
cleaner alternatives — and measures the impact, trip by trip, community
by community."

**4. What we run**
Dark navy. Three cards in a row — one per program.
Each card: program name, one-line description, link.

Card 1: Shift
"The behavior change app that makes every active trip count."
Link: /shift

Card 2: Shift for Schools
"Classroom-level active transportation competitions for K-8 schools."
Link: /shift/schools

Card 3: What Moves Us
"Community storytelling campaigns that give commuters a voice in
transportation planning."
Link: /programs/what-moves-us

Card 4: Walk/Ride Days
"Monthly active commuting events across Massachusetts since 2006."
Link: /programs

Layout: 4 cards — 2x2 grid on desktop, single column on mobile.

**5. Leadership**
Dark navy. Eyebrow: "LEADERSHIP"
Headline: "The people behind GSI."

Two sections:

*Staff — 2-column card grid:*

Card 1 — Janie Katz-Christy
Title: Founder, Green Streets Initiative
Bio: "Twenty years building active transportation programming across
Greater Boston."
Photo: placeholder avatar (initials JK, lime background)

Card 2 — Keith Anderson
Title: Director
Bio: "Leading GSI's relaunch around the Shift platform."
Photo: placeholder avatar (initials KA, blue background)

*Board of Directors — clean name list or small cards:*
Design this to accommodate 6–8 board members as names are added.
For now, show a single placeholder row:
Board members (display as name cards or clean list):
- Sophie Schmitt
- Patty Nolan
- Jen Rapaport

Design to accommodate 6-8 members as more are recruited.

Design note: The entire leadership grid should accommodate ~10 people
(staff + board) as the organization grows. Use a responsive grid that
looks good with 2 people and still looks good with 10.

**6. Contact CTA**
Dark card, full width.
Headline: "Want to know more?"
Body: "Whether you're a potential partner, funder, journalist, or neighbor
— we'd love to hear from you."
CTA button: "Get in touch →" linking to /contact

---

## Page 2: /press

**URL:** /press
**Nav:** Add "Press" to footer under Organization column, linking to /press.

---

### Sections in order

**1. Hero**
Dark navy.
Eyebrow: "PRESS"
Headline: "Press & media"
Body: "For press inquiries, interview requests, or media assets, please
reach out directly. We'll get back to you within one business day."
Email CTA: info@gogreenstreets.org (large mailto link, styled as a button
or prominent inline link)

**2. Quick reference — two column cards**
Dark card background (#242538).

Card 1 — "About GSI"
"Green Streets Initiative is a Cambridge-based 501(c)(3) nonprofit helping
commuters across Massachusetts shift trips to active transportation. Founded in 2006."

Card 2 — "About Shift"
"Shift is GSI's behavior change platform — a mobile app that auto-detects
active trips, tracks Shift Rate, and rewards commuters for walking, biking,
and riding transit."

**Design note:** Leave visual space below these cards for two future sections
that will be added after launch:
- A press kit download button (will be a PDF or zip file)
- A media coverage grid (publication name, headline, date, link)

Do not show placeholder text for these — just leave the layout space with
a comment in the code marking where they'll go.

---

## Page 3: /donate

**URL:** /donate
**Nav:** Add "Donate" to footer under Organization column, linking to /donate.
Also add a "Donate" link to the primary nav — right side, styled as a
ghost button (border only, no fill) to distinguish from the lime "Get involved"
CTA. This is standard nonprofit nav practice.

---

### Sections in order

**1. Hero**
Dark navy.
Eyebrow: "DONATE"
Headline: "Help make shift happen."
Subhead: "Green Streets Initiative is a 501(c)(3) nonprofit. Your donation
funds the platform, the programs, and the people working to make active
transportation the obvious choice across Massachusetts."

**2. Why it matters — three impact cards**
Slightly lighter background (#242538). Three cards.

Card 1: "The app is free."
"Shift is free to download and use. Every active commuter who joins, every
school that runs the program, every neighborhood that climbs the leaderboard
— none of it costs them anything. Donations make that possible."

Card 2: "We measure what others assume."
"Most transportation initiatives run on estimated impact. GSI verifies it
— trip by trip, neighborhood by neighborhood. Donors fund infrastructure
that produces real data for real decisions."

Card 3: "We're just getting started."
"Shift is built to scale across Massachusetts — and eventually beyond.
Every donation funds the platform, the programs, and the communities
we haven't reached yet."

**3. Donation form**
Dark navy. Centered, max-width 600px.
Headline: "Make a gift"

Two tabs or toggle: "One-time" | "Monthly"
(Monthly giving is the default — show it selected on load)

Then the Donorbox embed placeholder:

```html
<!-- DONORBOX EMBED PLACEHOLDER -->
<!-- Replace this comment block with the Donorbox embed code once
     the Donorbox account is configured with bank details.
     Donorbox embed typically looks like:
     <script src="https://donorbox.org/widget.js" ...></script>
     <iframe src="https://donorbox.org/embed/[campaign-id]" ...></iframe>
-->
<div class="donorbox-placeholder">
  <p>Donation form coming soon.</p>
  <p>To donate now, email us at <a href="mailto:info@gogreenstreets.org">info@gogreenstreets.org</a></p>
</div>
```

Style the placeholder div to look intentional — not broken. A simple
bordered card with muted text is fine.

Below the embed/placeholder:
Small text: "Gifts of all sizes make a difference.
Monthly giving helps us plan ahead."

**4. Tax language**
Small, centered, muted. Below the form.
"Green Streets Initiative is a registered 501(c)(3) nonprofit organization.
All donations are tax-deductible to the extent permitted by law.
EIN: 26-1484405"

**5. Closing line**
Very small, centered.
"Questions about giving? Contact us at info@gogreenstreets.org"

---

## Shared implementation notes

**Footer updates across all three pages:**
- /about → "Our story" under Organization
- /press → "Press" under Organization
- /donate → "Donate" under Organization
- /donate also gets a ghost button in the primary nav

**Placeholder handling:**
- Board member names on /about: design accommodates 6–8, shows
  "members to be announced" for now
- EIN on /donate: add [INSERT EIN] comment in code so it's easy to find
- Donorbox embed on /donate: placeholder div with mailto fallback
- Press kit and coverage grid on /press: empty layout space with code comment

**Photo placeholders:**
Use initials-based avatar components for Janie and Keith —
lime (#BAF14D) background for JK, blue (#2966E5) for KA.
These swap out for real photos with a single image swap — no layout changes needed.

**Design:**
All three pages match the existing GSI design system.
/about alternates dark and off-white sections like /programs.
/press and /donate are primarily dark navy.
