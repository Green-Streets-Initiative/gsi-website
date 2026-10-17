# Answer pages — the standard

_Agreed with Keith 2026-10-16. Read before drafting, editing or reviewing any
answer page. The SEO routine and every session that writes one follow it._

Answer pages answer the questions in `seo/question-bank.json`: what people ask
when they are fed up with how they get around, or curious about another way.
They exist to be the best answer a person or an AI assistant can find, and to
show what Green Streets and Shift know that nobody else does.

## Where they live

- **Inside Guides.** An answer page is a guide: a block in
  `content/micro-guides-library.md`, rendered at `/guides/<slug>`, with the
  "Reviewed" date, the "Try it" box, related guides and Article JSON-LD. It
  also appears in the app's guide library (`surfaces`). See
  [[project-guides-pipeline]] for the build: the markdown is the only place to
  edit text.
- **Improve before adding.** If a page already ranks for the question (Search
  Console, or our organic rank in the question bank), upgrade that page. A new
  page is for a real gap only. A sibling page on a question a stronger page
  already answers gets no foothold (strategy.md, Learnings, 2026-10-12).
- **Drafts** go to `seo/drafts/guides/<slug>.md` with `status: draft`, a "Why
  this page" note naming its bank questions, and the evidence (section 8).

## 1. Clarity

- **Answer first.** The opening one or two sentences answer the question
  outright. Assistants quote that paragraph; most readers stop there.
- **Section headings are the real questions**, in the asker's words.
- **Second-grader test.** Full sentences, everyday verbs, no noun stacks, no
  shorthand. A program name (Walk/Ride Day, New Routes) always comes with what
  it is.
- **Target the search without echoing its framing.** A page can rank for "do I
  need a car in Boston" with the title "Getting around Boston by T, bike and
  foot". Our own copy never says "car-free", "without a car", "ditch your car".
- **No machine-written tells:** no "this, never that", no em-dash asides, no
  italic accent words, no sentences that only state the obvious, no stock
  phrases ("worth noting", "the good news is").

## 2. Practical and actionable

- **Specific over general:** routes, stations, towns, minutes, dollars, the
  way the guides already do it.
- **Honest comparisons** (the mode-suggestion rules): "about the same time"
  only within 3 minutes; money counts only the trip's own cost (gas, wear,
  parking, fares); car payment, insurance and depreciation appear as context,
  never as savings; some people pay to save time, and that is fine.
- **Say when driving is the better fit**, then show what does work for that
  trip or part of it (a park-and-ride, a carpool, one day a week).
- **End with one first step** the reader can take this week ("Try this
  first").
- **Clear, and the next step is one tap away** (Keith, 2026-10-17: "everything
  we build should be clear and make it easy to take the next best action").
  Every time a page asks the reader to do something, the words that ask link
  to the place that does it: our tool on the page, Nearby, T-Alerts, the
  agency's own page. No unlinked instructions ("look it up in the trip
  planner"). Keep "Try this first" to one or two steps, numbered when there
  are two, and make sure each tool we name actually does what we say (the
  MBTA trip planner does not show Bluebikes docks; Nearby does).
- **Linking to a tool on the same page:** write the full URL with the tool's
  anchor, e.g. `https://www.gogreenstreets.org/guides/<slug>#trip-planner`.
  The page turns it into a jump; the app's guide reader opens the web page at
  the tool. Anchors: `#trip-planner`, `#station-parking`, `#closures`.
- **Statewide by default.** Boston examples plus at least one from elsewhere in
  Massachusetts wherever the question applies.

## 3. Mission alignment

- **Acknowledge the frustration first**, then name the specific trips where
  another way works. No scolding, nothing adversarial toward cars or drivers.
- **Mode-neutral:** walking, biking, transit and carpool, ordered by what fits
  the trip. Transit and carpool are often the easier switch than biking.
- **Lead with benefits:** money, time, health, community, fun. No calorie
  figures. CO2 only as a share of the reader's own travel, never the lead.
- **Point to existing help** before building our own: MassCommute and the
  TMAs, WalkBoston, bike co-ops, MBTA and RTA travel training, town programs.
- **The mission stays unstated.** Shift copy is about shifting: never "how you
  already move".

## 4. Sources, credit and links

- **Every number has a source and a date.** Official sources first (MBTA,
  RTAs, MassDOT, city and town sites, AAA, EIA, IRS, MassCEC). Reddit and
  forums can show what people experience; they are never the source of a fact.
- **Prices use `{{price:…}}` tokens** from `src/lib/facts/prices.json`, the
  one place prices live; add a new fact there rather than typing a number
  (token names are letters only: the build's pattern skips digits). Any
  other fact that changes (rebates, closures, programs) gets a `reviewed:` date
  and, where it can lapse, an `expires_at`.
- **Our own words.** Summarize and link; never copy a source's passages.
- **Links:** link freely to official and nonprofit sources. Name a business
  when it is the actual answer (Bluebikes, a garage's posted rate) but do not
  link businesses. No paid, sponsored or affiliate links; no sponsor mentions
  in the body. Creator videos carry the creator's name and permission where the
  platform's embed does not cover it.
- **Our own tools:** one "Try it" box at the end, plus at most one in-body
  mention where the tool is the answer. The page is complete without
  installing anything.

## 5. Design and reading experience

- The guide template, phone first. Comparison tables show one number per row.
- **300–700 words** for answer pages (in-app guides stay 200–380).
- Contrast rules (CLAUDE.md), brand fonts, nothing that reads as AI-generated.
- **Polish pass** with phone and desktop screenshots before a page counts as
  done.
- Every new page is in the sitemap and `llms.txt`, and its bank questions'
  `our_page` points at it.

## 6. Security and privacy

- **No forms** on answer pages. A calculator runs in the reader's browser and
  stores nothing.
- **No new third-party scripts, trackers or embeds.** Video in privacy mode.
- **Bodies are markdown through the guide renderer**, which escapes HTML and
  only links `https://` and site-relative URLs. No raw HTML in a body.
- **Links are https, checked live before publishing and again monthly** (dead
  links and lapsed domains someone else has bought).
- **No personal data in URLs**; campaign tags only.
- **Safety and legal points cite official sources** (taking the lane, e-bike
  classes, child seats). We do not give legal or medical advice.

## 7. Review and measurement

- **Keith reviewed the first five** (2026-10-16). After that the SEO routine
  drafts and publishes within this standard and reports what shipped in its
  weekly email; Keith does not approve each page.
- Each page is judged by the monthly AI answer sample and Search Console,
  against its questions in the bank.

## 8. Use our own data (added by Keith 2026-10-16)

Our data is what nobody else can publish, and showing what it can say is key
to growth.

- **Before drafting, query our own data** where it bears on the question:
  Shift trips, Around You and Nearby use, the Commute Advisor, mode
  suggestions, Search Console, PostHog. Use it to confirm or challenge the
  page's claim, and at minimum to find a real example.
- **Report what it shows, including when it cuts against the claim.** Change
  the page, never the framing of the number.
- **Aggregate only.** No person, trip or route that could identify someone; no
  home or work locations; nothing finer than a town. A figure needs at least 10
  people behind it. Round.
- **Say what it is, in one line on the page:** who, where, when, how many
  ("Trips recorded by 157 people using Shift in Greater Boston, Sept 15 to
  Oct 12, 2026"). People who use Shift are not a random sample of residents:
  say "people using Shift", never "Bostonians".
- **Keep the query.** Each draft's evidence lives in
  `seo/data/answer-evidence/<slug>.md` with the SQL and the result, so the
  number can be re-run when the page is reviewed.

## 9. Keeping pages current (added 2026-10-17)

A page that answered a question well in October can mislead by spring.

- **Every fact on a page is in `seo/answer-pages-refresh.json`**, with its
  source, how often it changes (monthly, quarterly, each semester, yearly, or
  one known date) and the next date to check it. A new page is not done until
  its facts are listed there.
- **Prices update themselves.** Anything in `prices.json` that the monthly
  freshness check already tracks is marked `auto`; prices it doesn't track yet
  (garages, campus permits) are checked on their own dates.
- **Our data is re-run quarterly.** Re-run the saved query in
  `seo/data/answer-evidence/<slug>.md`, update the numbers and the date line
  if they moved, and replace a dated example (like the July 2026 Red Line
  closure) when a newer one gives a better sample.
- **Known dates get their own entry**, such as the end of the T's transfer
  pilot or a permit price change, so the page is rewritten the day the fact
  changes, not when someone notices.
- **The SEO routine does the checks in its monthly deep-dive**: every entry
  due that month, plus a live check of every outbound link. It updates the
  page, bumps the guide's `reviewed:` date, sets the next check date, and
  lists what changed in its report.

## 10. Translations (added 2026-10-17; Spanish first)

Keith (2026-10-17): these pages "could be very helpful to ESL populations."
Each answer page gets a version in the Shift app's languages, Spanish first,
then Portuguese (Brazil) and Chinese (Simplified). Haitian Creole is a
candidate once the app supports it.

**Where they live.** A draft answer page's translation sits next to it in
`seo/drafts/guides/<lang>/<slug>.md` (preview `/preview/<lang>/guides/<slug>`).
A shipped guide's translation is `content/translations/<lang>/<slug>.md`: the
English block's YAML plus `lang:`, same slug. `node
scripts/build-guide-translations-migration.mjs` turns those into rows in
`content_item_translations` (Shift migration 01212), served at
`/<lang>/guides/<slug>` with hreflang links both ways and in the sitemap; the
Shift app shows the guide in the reader's language. When a draft ships, its
translation moves to `content/translations/` with it.

**AI note.** Until a person who speaks the language has read a page, it says
"Traducido del inglés con ayuda de inteligencia artificial. Si algo no está
claro, escríbenos a info@gogreenstreets.org." (Keith, 2026-10-17: publish with
the note, don't wait). A reviewer adds `human_reviewed: YYYY-MM-DD` to the
YAML, and the note goes away on the next build.

**Same page, same structure.** The same sections, in the same order, and the
same facts, numbers, price tokens (`{{price:...}}`), tools and links. The
preview builder refuses a translation whose section count differs from the
English page, because tools are placed by section. When the English page
changes, its translations change in the same commit (§9).

**Written for the reader, not word for word.** The same plain-language rules
(§1, the 2nd-grader test). Short sentences. Explain a term the first time it
appears.

**Spanish house style** (matches the Shift app, `locales/es.json`, and the web
Nearby map, `src/lib/nearby/i18n.ts`):
- Address the reader as **tú**.
- the T: **el T**; subway lines: **Línea Roja, Línea Naranja, Línea Azul,
  Línea Verde** (ramal B, C, D, E: "el ramal C de la Línea Verde"), Mattapan
  stays **Mattapan**.
- commuter rail: **tren de cercanías**; bus: **autobús**; bus route 77:
  **la ruta 77**; shuttle: **autobuses de reemplazo** (free ones: "autobuses
  de reemplazo gratuitos").
- bike / Bluebike: **bici** / **una Bluebike** (Bluebikes is a proper name);
  e-bike: **bici eléctrica**; car: **auto**; to drive: **manejar**; parking:
  **estacionamiento**; car share: **auto compartido** (Zipcar by name).
- Around You (app): **Cerca de ti**. The web Nearby page: **el mapa Cerca de
  ti** on our website, linked with `?lang=es`.
- Shift, Bluebikes, T-Alerts, Zipcar, CharlieCard, place names and street
  names stay as they are.
- US units and formats: miles, mph ("millas por hora" the first time), $1.70,
  8.4 (decimal point), "21 al 30 de julio de 2026".
- "Try this first": **Prueba esto primero**. "About these numbers:" **Sobre
  estas cifras:**. "typical": "Típico quiere decir que la mitad de los viajes
  fueron más rápidos y la mitad más lentos."

**Links.** Same targets as the English page. Links to our own pages use the
Spanish version (`https://www.gogreenstreets.org/es/guides/<slug>#trip-planner`,
`/nearby?lang=es`). When a link asks the reader to do something on a page
that is only in English (T-Alerts, most of mbta.com, mass.gov forms), add
"(en inglés)" after it, so the reader isn't surprised. Source citations don't
need the note.

**Review.** The first Spanish pages are read by a native speaker before they
ship (§7); after that the routine publishes within this standard, and the
monthly refresh checks both languages.
