# /programs Page Spec
**For: Claude Code implementation**
**URL: /programs**
**Version: March 2026**

---

## Overview

The programs page gives institutions, employers, and community members
a clear picture of what GSI actually runs — beyond the Shift app.
Three programs: Walk/Ride Days, What Moves Us, and Corporate Challenge.

Primary audiences: potential institutional partners, school administrators,
municipal staff, and funders. Secondary: general public.

This page is also one of the better organic search opportunities on the site.
"Walk ride day Boston," "commute awareness program," and "employee commute
challenge" are real queries with no strong local competition.

---

## Page structure

### 1. Hero

Background: dark navy.
Eyebrow: "PROGRAMS"
Headline: "How we get Greater Boston moving."
Subhead: "Beyond the app, Green Streets Initiative runs community programs
that build awareness, generate data, and create the moments that turn
one active trip into a lasting habit."

No CTA in the hero — let the programs speak for themselves.

---

### 2. Walk/Ride Days

This is the flagship community program — 20 years of history, the best
organic ranking of any program page on the old site, and the clearest
connection to the Shift app.

**Layout:** Full-width section, off-white background (#F4F8EE), dark text.
Two-column: left is copy, right is a visual/stat treatment.

**Eyebrow:** "COMMUNITY PROGRAM"
**Headline:** "Walk/Ride Days"
**Body:**
"The last Friday of every month, Greater Boston commuters ditch the car
and take an active trip to work. Walk it. Bike it. Take the bus. Log it
in Shift and see your neighborhood show up on the leaderboard.

Walk/Ride Days have been running since 2006 — monthly moments of collective
action that remind people what their commute could feel like. Employers,
schools, and neighborhoods participate together."

**Three stat callouts (right column):**
- "Last Friday of every month"
- "Greater Boston–wide"
- "Free to participate"

**CTA:** "Join the next Walk/Ride Day →" — links to /contact?inquiry=general
with a note in the message field pre-filled as "I'd like to join Walk/Ride Days"
(handle this via URL param if possible, otherwise just link to /contact)

**Shift connection callout** (small card below the main content):
"Walk/Ride Days are built into the Shift app. Log your trip on the last
Friday of the month and it counts toward your Shift Rate, your streak,
and the neighborhood leaderboard. [Learn about Shift →] links to /shift"

---

### 3. What Moves Us

A community storytelling program — video and audio stories from active
commuters, used to inform transportation planning. Less well-known externally
than Walk/Ride Days, but compelling for funders and municipal partners.

**Layout:** Dark navy background. Two-column: left visual/quote treatment,
right copy.

**Eyebrow:** "COMMUNITY STORYTELLING"
**Headline:** "What Moves Us"
**Body:**
"Every commuter has a story. What Moves Us collects short video and audio
stories from people across Greater Boston — how they get around, what works,
what doesn't, and what they wish were different.

The stories are real. The data is real. And the people making transportation
decisions in this region hear directly from the people their decisions affect.

What Moves Us has run in Cambridge, Somerville, Everett, and beyond —
commissioned by municipalities and organizations who want genuine community
voice in their planning process."

**Audience callouts — two columns:**
Left — "For communities":
"Real voices from your neighborhood, in your language, on the transportation
questions that matter to your planning process."

Right — "For commuters":
"Share your story. Shape your streets. Shift users who participate earn
bonus points."

**CTA:** "Commission a What Moves Us campaign →"
Links to /contact?inquiry=general

**Note for Code:** Do not reference the admin dashboard, the video processing
pipeline, or any technical implementation details on this page. Keep it
entirely focused on the community-facing value.

---

### 4. Corporate Challenge

The employer-facing program — structured team competition for workplace
commuters. Connects to the employer pitch on /shift/employers.

**Layout:** Slightly lighter card background (#242538). Two-column.

**Eyebrow:** "EMPLOYER PROGRAM"
**Headline:** "Corporate Challenge"
**Body:**
"The Corporate Challenge brings employee commute competition to the
workplace. Teams compete to log the most active trips, the highest
Shift Rate, and the biggest collective impact — over a defined challenge
period with prizes, leaderboards, and real data.

Companies use it to reduce parking demand, demonstrate sustainability
commitments, and give employees a reason to explore active commuting.
Employees use it to try something new, compete with their team, and
actually enjoy the commute for once."

**Three benefit callouts:**
1. "Verified trip data" — Active trips are auto-detected and verified.
   No self-reporting, no honor system.
2. "Custom leaderboards" — Your team, your challenge, your results.
   Private group with invite-code access.
3. "Impact reporting" — End-of-challenge report with mode share, CO₂
   avoided, and participation data for your ESG and wellness programs.

**CTA:** "Run a Corporate Challenge →"
Links to /contact?inquiry=employer

---

### 5. Shift — the app (bridge section)

Short connective tissue section linking the programs to the app.
Not a full app pitch — that lives on /shift.

**Layout:** Full-width dark strip, centered text.
**Eyebrow:** "CONNECTING IT ALL"
**Headline:** "Every program runs on Shift."
**Body:** "Walk/Ride Days, What Moves Us, Corporate Challenge — they all
feed into the same Shift platform. One app, one leaderboard, one picture
of how Greater Boston is moving."
**CTA:** "Learn about the Shift app →" links to /shift

---

### 6. Work with us

Simple closing section. Two cards side by side.

**Card 1 — For organizations:**
Headline: "Bring a program to your community"
Body: "Whether you're a municipality, employer, school district, or
community organization — we can design a program that fits your goals
and your community."
CTA: "Get in touch →" links to /contact

**Card 2 — For commuters:**
Headline: "Just want to participate?"
Body: "Walk/Ride Days are open to everyone. Download Shift, take an
active trip on the last Friday of the month, and you're in."
CTA: "Join the next Walk/Ride Day →" links to /shift

---

## SEO notes for Code

Add these to the page metadata:

```typescript
export const metadata = {
  title: 'Programs — Green Streets Initiative',
  description: 'Walk/Ride Days, What Moves Us, and Corporate Challenge — community programs that help Greater Boston commuters shift how they move.',
}
```

The Walk/Ride Days section should use an `<h2>` heading (not just styled
text) so Google can index it as a distinct topic on the page.

---

## Design notes

- Section order matches audience priority: community first (Walk/Ride Days),
  then institutional (What Moves Us), then employer (Corporate Challenge)
- Alternate light/dark backgrounds across sections to create visual rhythm:
  hero (dark) → Walk/Ride Days (off-white) → What Moves Us (dark) →
  Corporate Challenge (card dark) → bridge (dark strip) → work with us (dark)
- No program logos or partner logos needed at this stage — content only
- Keep program descriptions factual and concrete — no generic nonprofit
  language about "empowering communities"
