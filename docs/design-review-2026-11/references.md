# Real-site references for the gogreenstreets.org redesign (2026-11-17)

Gathered from UXKIN (website design systems + iOS app screens) for the redesign review. We borrow layout, structure and flow only; fonts and colors stay GSI's (Overpass ExtraBold, Trebuchet MS, #2D6A4F / #1B4332 / #191A2E / #F4F8EE).

**About the source.** The account has no saved UXKIN collections. UXKIN's website library is mostly design systems from SaaS, agency and e-commerce sites; it has no civic, transit-agency, trail or advocacy-nonprofit sites (searches for GOV.UK, MBTA, AllTrails, Citymapper, Patagonia, Meetup, Lyft, REI, The Guardian, Wikipedia, "nonprofit", "transit", "mobility" and "climate" all came back empty). Several of the strongest references for events and routes are therefore **iOS app screens** (Luma, komoot, Google Maps, Airbnb), which are close to what our mostly-phone visitors see. Sites marked *not in UXKIN, unverified* are named from general knowledge; nobody has checked their current pages.

Screenshots are in `refs/`, downloaded from UXKIN's own media URLs. Re-open any entry at `https://uxkin.com/web?pack=<id>` (websites) or `https://uxkin.com/apps/<appId>?platform=ios&journey=<id>` (apps).

## Reference table

| # | Site | Job | Ideas to borrow | UXKIN id | Screenshot |
|---|------|-----|-----------------|----------|------------|
| 1 | **Luma** (lu.ma), calendar and event pages | A | A club's calendar page opens on a big group photo of the actual people, then a stack of events, each with a **date tile (OCT / 31 / TUE)**, a real photo, the host, the time and the place. The event page puts **date tile + time, then pin + place** as two scannable rows above any description. One Subscribe button for the whole calendar. | app `a_EOtxBJX5WiwS`; journeys `j_NVu_wv020kvQ` (browse), `j_fSXxv8NS2_cr` (dates) | `luma-ios-browse.jpg`, `luma-ios-dates.jpg` |
| 2 | **Eventbrite** | A | The location is already filled into the search bar ("Barcelona"), so the first screen is local. One row of round category icons (Music, Hobbies, Food & Drink) works as filters. Below that, rows of "Events in [city]" with 16:9 photo, title, date and place. Flat cards with a 1px border and no shadow. *Avoid:* the stock-photo promo hero and the highlighter-text headline. | web `w_CUWsQiMwfBDL` (has DESIGN.md) | `eventbrite-home.png` |
| 3 | **Airbnb** (web + iOS) | A, B | Every row is named after a place: "Popular homes in Madrid", "Homes in Leyden Township". Photos scroll sideways and show three lines of facts (dates, price, rating). The search bar asks **Where / When / Who**. For GSI, that becomes rows like "This weekend in Somerville" and "Rides near Arlington", and a planner bar with **From / To / When**. | web `w_MGTtMn2_tJxV`; app `a__uH4lz5sIcBY`, journey `j_0PBje3a1An-b` | `airbnb-home.png`, `airbnb-ios-experiences.jpg` |
| 4 | **Partiful** | A | The nav is organized by occasion (Graduations, Birthdays, Dinners, For Orgs), much like GSI's audiences (Rides, Walks, Open streets, For employers). The hero is a candid, unposed photo of real people. *Avoid:* the purple gradient wash and the floating glass card. Both are on our banned list. | web `w_LB5wwuC7jV4o` | `partiful-home.png` |
| 5 | **Google Maps** iOS, "Latest in [area]" | B, C | The heading names a place ("Latest in Union Square"). Rows of **place photo + name + one-line description + distance (292 ft, 0.5 mi)**. This is the pattern for town pages: photo cards of the streets and spots on the map, each with its distance or length. | app `a_tx65Hn8vJ-NT`, screen `s_HQVHUONH7DuB` | `googlemaps-ios-discover.png` |
| 6 | **Strava** | B, E | The first screen is a triptych: **real photo of people riding / sign-up / phone with route map + person photo**, with one orange route squiggle crossing the photo. The footer lists Routes, Stories and Business as plain links. The sign-up block has three stacked buttons, and that is the only task on the screen. Good model for the Shift app panel. | web `w_6nvGf6kItZRl` (has DESIGN.md) | `strava-home.png` |
| 7 | **komoot** iOS | B | The route line is the illustration: a thick orange GPS line with a person's photo pinned on it, on a solid dark field. A good model for a Roam or trail hero when there's no good photo: draw the real route and pin the guide's face or a place photo on it. | app `a_hWkkN1geJ4CL`, journey `j_eZkSPNXUbddR` | `komoot-ios-getstarted.jpg` |
| 8 | **The Outsiders** iOS, progress | B (show, don't tell) | A week-by-day dot grid in which dot size = amount, with a number and % change at the end of each row, plus a ring meter ("0 / 6 km, 6 km to go"). This turns "people joined" and "trips this week" into a picture. Use it on town, challenge and employer pages. *Avoid:* the dark gradient header. | app `a_71BnDYlDGfzp`, journey `j_MnPz8DoXqu9K` | `outsiders-ios-activity.jpg` |
| 9 | **Uber** (web) | C | A task-first hero: a **city chip with "Change city"**, then a **Pickup / Dropoff** form with one black button. The headline is four plain words. Below are "Suggestions" cards, each with a one-line description and Details. This is the model for the trip planner and Commute Advisor front door. *Avoid:* the generic illustration. Use a real street photo instead. | web `w_1WwW9sHS_Y3J` | `uber-home.png` |
| 10 | **Google for Education** (Classroom page) | C, E | Breadcrumbs (Home > Workspace for Education > Classroom). One plain headline and two buttons, **Contact sales** (filled) and **Sign in** (outline). Ideal for schools and cities pages: say what it is, then offer one "Book a call" plus a way in for existing users. *Avoid:* the long product paragraph under the headline. | web `w_AqdUcwdBORDG` | `google-for-education-home.png` |
| 11 | **CQCM** (Québec co-op movement) | D | A movement org that looks made by people: a split first screen with a **big real portrait on the left and a solid-color statement block** (one sentence, one button) on the right. Below sits a dated news card ("Communiqué · 24 avril 2026") with an event photo. A dot pattern overlaid on the photo adds a brand mark without a gradient. | web `w_mMxh0Jbqu9RO` | `cqcm-home.png` |
| 12 | **Ecosia** | D | The proof sits in the hero: **two live counters ("250,619,082 trees planted", "€101M to climate action")** right under the main action. Real aerial imagery fills the background. For GSI the counters would be trips shifted, events listed and towns mapped. *Avoid:* the blurred, painterly texture and the "AI Chat" chip. | web `w_fsWJbjLm-4JP` | `ecosia-home.png` |
| 13 | **Signal** (nonprofit) | D | Plain words, with **Donate in the top nav** next to Help and Blog. The phone screenshot is full of real faces (a group video call), so the product shot doubles as a people photo. Short headline, two sentences, one button. | web `w_V-LYb50uHWcD` | `signal-home.png` |
| 14 | **Cowboy** (e-bikes) | D, E | A full-bleed video of a person riding past a real stone building, with a **three-item proof strip** along the bottom edge (award, ride feel, theft guard). The top-right CTA is **"Book a test ride"**, not a price. That's our "Book a call" pattern for employers: one booking action, proof on the first screen. | web `w_uWjqWKozHvUh` | `cowboy-home.png` |
| 15 | **Calendly** | E | The product is the hero picture: the actual booking calendar with times. A "Trusted by 100,000 organizations" logo strip sits right under the fold. For employer pages, show the real portal screen (leaderboard, challenge meter) as the hero image and put real employer logos below it. *Avoid:* the decorative blobs. | web `w_wFwlcMaV9eVd` | `calendly-home.png` |
| 16 | **HubSpot** | E | A photo of real people working together fills the hero. Two buttons: **"Get a demo"** (filled) and a secondary one. A utility top bar holds High Contrast, Customer Support and Contact Sales. *Avoid:* the small spaced-caps eyebrow over a thin serif headline, which is exactly the "AI look" we're leaving. | web `w_y-NtedjHc-79` | `hubspot-home.png` |
| 17 | **Ramp** | E | A **live ticker of real numbers** runs along the bottom of the first screen ("Expenses reviewed 171,576…"), with a one-field form (work email) next to the CTA and a real product screenshot below. For employers: "trips logged this month", "teams in challenges", then one field and Book a call. *Avoid:* the eyebrow label with a counter. | web `w_I8-4CEiix0gM` | `ramp-home.png` |
| 18 | **Rivian** | F, B | Street-level photography in a real neighborhood: brick row houses, a street sign, a person mid-errand. It reads like Somerville or Cambridge. Short white headline on the photo, two pill buttons. A good brief for our photo shoots: real streets, people doing ordinary things. *Avoid:* the carousel arrows and dots. | web `w_OCW302fNkIjl` | `rivian-home.png` |
| 19 | **Exhibition Magazine** | F | A masthead-scale wordmark with a plain section nav underneath, then a full-bleed photo with a **credit line under the title ("A series captured by …")** and a 4-up photo row below. The model for credited photography: every big photo names its photographer in the caption, and that alone makes the page feel made by people. | web `w_hLDtxkx_NXzv` (has DESIGN.md) | `exhibition-magazine-home.png` |
| 20 | **Literal** | F, A | The hero is **a loose wall of real objects (book covers)**, each one clickable. For GSI, the same wall built from event flyers and ride photos. A forest-green Join button. Hint text: "Psst… explore a book by clicking on it". *Avoid:* the centered serif headline. | web `w_or6dq25FdYPS` | `literal-home.png` |
| 21 | **GOV.UK** | C | *Not in UXKIN, unverified.* Task-named pages ("Find…", "Check…", "Apply…"), heavy plain-English writing, breadcrumbs, a "Related content" side list, big left-aligned headings, no hero art. The benchmark for guides and how-tos: one task per page, the answer first. | none | none |
| 22 | **MBTA** (mbta.com) | C | *Not in UXKIN, unverified.* Mode tiles (Subway, Bus, Commuter Rail, Ferry) using the real line colors as wayfinding, a trip-planner box on the home page, and alerts shown inline on each line. Our riders already know this vocabulary, so GSI's mode chips and trip planner should read in the same language. | none | none |
| 23 | **AllTrails** | B | *Not in UXKIN, unverified.* The trail page opens with a photo strip and a **stat row (length, elevation gain, est. time, route type)**, then a map with the route drawn, then reviews and recent conditions. The direct model for trail and Roam pages: measured numbers before prose. | none | none |
| 24 | **Rails-to-Trails Conservancy / TrailLink** | D, B | *Not in UXKIN, unverified.* An advocacy nonprofit whose most useful product is a trail finder: a map and a list of trails with surface, length and photos submitted by users. Advocacy and utility share one site, which is GSI's situation exactly. | none | none |
| 25 | **Atlas Obscura** | F | *Not in UXKIN, unverified.* Place pages with a big photo, a coordinates/map block, "Know before you go", and photos and notes from contributors. The layout varies from page to page. Shows how a place guide can read as written by people for neighbors. | none | none |

Also checked but left out: DICE `w_sJ4n6mLj6L-r` (phone-mockup hero, little listing structure), Mapbox `w_tIk-nP0lUgGc` (dark developer page), Hartzler Family Dairy `w_0bMeCRixn3iv` (charming but product packaging), pampam.city `w_isHKBhp9_SS-` (map maker, but a blurred gradient hero, which is on our banned list), Allbirds, Spotify, Mailchimp.

## Notes per job

### A. Events and listings: "what's on near you this week"
- **The date tile is the strongest single pattern** (Luma). Month, day and weekday in a small box to the left of a real photo is easier to scan on a phone than a sentence. Our event cards should lead with date tile + photo + place, with the title second.
- **The location is set before the first click** (Eventbrite, Google Maps, Uber). Detect or remember the town, show it as a chip with "Change", and name every row after a place ("This weekend in Somerville").
- **Rows named after places, scrolling sideways** (Airbnb), not one long same-card grid. Different rows can carry different card shapes (photo-led for featured rides, compact list for the rest).
- **Categories as one icon row** (Eventbrite) maps onto Rides / Walks / Open streets / Family / Beginner-friendly.
- Avoid: stock-photo promo heroes, gradients (Partiful), highlighter text.

### B. Place and route pages led by a map or photo with measured numbers
- **Numbers before prose**: length, time, elevation, surface (AllTrails pattern). Distance is also on every card (Google Maps "0.5 mi").
- **The route is the picture** when there's no photo (komoot): a thick line from the real GPX with a pinned person or place photo.
- **Progress as a meter or dot grid** (The Outsiders), never a checkmark, for "people who've done this Roam" or town trip counts.
- **Photo + map + people, side by side** (Strava triptych).

### C. Civic, transit and wayfinding
- **Task-first hero** (Uber): a From/To form is the first thing on the trip planner and Commute Advisor, with a city chip.
- **Breadcrumbs and plain task names** (Google for Education, GOV.UK). Guides should be titled by the task ("Bring a bike on the T").
- **Speak MBTA's visual language** for modes and lines. Our visitors already read it.

### D. Nonprofits that look made by people
- **A real portrait next to one plain sentence** (CQCM split screen) beats a centered headline over a texture.
- **Proof counters in the first screen** (Ecosia): trips shifted, events listed, towns mapped. Real numbers, updated live.
- **Donate sits in the nav, plainly** (Signal), not in a modal.
- **Advocacy and utility on one site** (Rails-to-Trails): the trail finder is the reason people come, and the mission rides along.

### E. B2B pages that convert to "Book a call" without a price
- **One booking verb**: "Book a test ride" (Cowboy), "Get a demo" (HubSpot), "Contact sales" (Google for Education). Our version is **Book a call**, plus a secondary link for existing customers.
- **The product as the hero picture** (Calendly, Ramp): show the actual employer portal screen, not an illustration.
- **Proof on the first screen**: a logo strip (Calendly), a live numbers ticker (Ramp), a three-item proof strip (Cowboy).
- Avoid HubSpot's eyebrow + thin serif headline. It's the look we're leaving.

### F. Editorial, made by people
- **Photographer credit lines in captions** (Exhibition Magazine). This is the cheapest "made by people" signal and fits our credited-photo rule.
- **Real streets, ordinary moments** (Rivian, Cowboy): brick, street signs, people mid-errand. Use these as the brief for Photo of the Month and our designer's shot list.
- **A wall of real artifacts** (Literal): event flyers, ride photos, rider-submitted pictures, each one clickable.
- **Layouts that change from section to section** (Atlas Obscura, Exhibition): a full-bleed photo, then a 4-up row, then a split block. Avoid one card shape repeated down the page.

## Two or three coherent directions these references suggest for GSI

1. **"This weekend near you" (listings first).** The home page and events open on what's happening in your town this week: date tiles, real ride photos, rows named after places, a town chip you can change, and trail and Roam pages that lead with a stat row and the drawn route. *Learns from:* Luma, Airbnb, Google Maps (iOS), AllTrails (with Eventbrite for the category row).

2. **"Field guide by neighbors" (editorial, photo-led).** The site reads like a local magazine about getting around Greater Boston: full-bleed credited photos of real streets and people, layouts that change from section to section, a wall of real flyers and photos, and a portrait next to one plain sentence on mission pages. *Learns from:* Exhibition Magazine, Rivian, CQCM, Atlas Obscura (with Literal for the artifact wall).

3. **"Plain-words utility, with proof" (civic tool + clear B2B).** Every page leads with its task: a From/To planner, task-named guides with breadcrumbs, MBTA-style mode chips. Employer, school and city pages show the real portal screen, live counts and one "Book a call". *Learns from:* Uber, GOV.UK, MBTA, Ramp (with Calendly and Cowboy for the booking and proof pattern).

These combine naturally: direction 1 for the events, towns and trails pages most visitors land on from Google, direction 2 for the home page, About and mission pages, and direction 3 for the trip planner, guides and B2B pages.
