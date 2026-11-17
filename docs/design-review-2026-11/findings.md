# Site review, 2026-11-17: findings and directions

The page Keith reads is `review.html` (published as an Artifact). This file is
the plain-text record. Sources: `inventory.md` (pages, nav, orphans, personas),
`traffic.md` (PostHog + Search Console), `references.md` (25 real sites),
`shots/` (32 live pages, desktop + phone), `mock/` (three directions, HTML +
screenshots), `web/` (compressed images for the review page).

## Where people land (90 days, clean US traffic)

74% phone, 84% of sessions see one page, paid ads 56% of sessions. Landing
sessions: school pages 1,343 · event pages 1,212 · /shift 1,096 · /nearby 671 ·
/events 666 · guides 564 (T guide 87% of it) · /bike-lessons 461 · home 312 ·
employer challenge 199 · town pages 149.

Conversions: event → host sign-up 11.2% · T guide → cheat sheet 11.0% ·
/shift → store 6.5% · town → app 6.3% · school → join 5.6% · /bike-lessons →
request 1.4% · employer challenge → sign-up 0.5% (69% bounce, 8 s median).

## Ranked findings (costliest first)

1. First phone screen of the biggest pages doesn't do its job (event page blank
   map, title below fold; school pages' Join below fold). Fix: what, when,
   where, one button on the first phone screen.
2. Paid ads land on /bike-lessons (1.4%) and the employer challenge (0.5%).
   Fix: photo of a real lesson + one ask; employer leads with "Book a call".
3. Almost no pictures of real places or people; 12% of events have an image;
   the Fresh Pond walk shows Public Garden tulips. Fix: host photo, then
   credited Commons photo of the place, then a map. No stand-ins.
4. Looks like a Claude site: italic serif accents, spaced-caps labels, dotted
   rails, three stat tiles, phone mock-up heroes; four looks mixed.
5. Listing data (corrected 2026-11-17, counted with status = 'approved'):
   two live listings show a private home ("Mary's house", Cambridge); Lizzie
   Learns to Ride listed twice on 11-21; Truant Thursday slug still dated
   11-12 after the move to the 19th; 75 of 284 live listings put a street
   address in location_name. Hidden duplicates and drafts (the potluck with a
   unit number among them) are readable through the anon key. The first
   version counted archived rows: Butternut, Cafe Bikers Sunday, Fresh Pond
   and DotBike each show once on the site, and the Boston Children's family
   day was never public. The events-data session is fixing these. Lesson:
   count listings from the rendered page or with status = 'approved'.
6. Four trip tools split (/trip, /nearby, /commute-advisor, /visiting);
   /visiting orphaned and noindex.
7. /bike-lessons and /together missing from nav, footer and home.
8. Copy rule breaks: em-dashes (Somerville 38, schools 14, get-involved 13,
   /shift 12, guides 10); "calm way to ride"; "Discover nearby", "Perks unlock
   here"; employers price + no "Book a call"; schools negative opener;
   rewards partners + get-involved sell the retired discount model; Programs
   "every last Friday" vs WRD "one Friday a month"; auto-tracking as the pitch
   (employer challenge, WRD).
9. Walls of words: /events 2,183, Somerville 2,176, employers 2,393, /shift
   1,378.
10. No front door for organizations (nav: "Employer login" only; three
    employer pitches; no public organizer landing; town challenge not live).
11. Measurement: key conversions GA4-only, donations untracked, raw PostHog
    1.7× inflated, home_cta_clicked fires mostly on the semester page.
12. Dead ends: press kit 404, sponsor pages without Donate, ended Shift Your
    Summer (6 pages) and /offers into it.

## Directions (mock-ups in mock/, same two pages, same real ride)

- **A. What's on near you** (Luma, Airbnb, Google Maps, AllTrails). Date
  tiles, place-name blades, photo cards. Nav: What's on · Places · Get there ·
  Learn to ride · For organizations · Get Shift.
- **B. A field guide by neighbors** (Exhibition Magazine, CQCM, Atlas Obscura,
  Rivian). Big credited photos, solid green word blocks, hosts and their words.
  Nav: What's on · Places · Ride along · Learn to ride · Work with us · Donate.
- **C. Street wayfinding, fixed** (Uber, MBTA, GOV.UK, Ecosia, Cowboy).
  From/To first, photo guide signs as doors, T-line diagram to the start.
  Nav: Plan a trip · Rides and walks · Learn to ride · Your town · For
  organizations · Get Shift.

Recommendation: A for landing pages (event, /events, school, /shift), B's
photo treatment for place pages (towns, trails, Roams), C's "Getting to the
start" line inside A's event page. Hand A and B to the designer as the two
event-page directions due Dec 1.

## Proposed system.md edits (Keith picks)

1. Section 6: first phone screen of every landing page = what, when/where,
   one button.
2. Section 2 green sign: on the website it is a place-name blade or a photo
   door sign, never a headline or paragraph.
3. Section 5 photo rules: no photo of its own place → place name + map; no
   host default image showing another place.
4. Section 9: website row gets the picked direction; retire Instrument Serif,
   italic accent words, spaced-caps labels, phone mock-up heroes on the site.
