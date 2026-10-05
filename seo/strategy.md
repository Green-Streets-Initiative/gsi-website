# SEO / AEO Strategy — Green Streets Initiative

_The routine reads this at the top of every run. Keep it current; the monthly
deep-dive may propose edits._

## The job

Steadily grow organic traffic to gogreenstreets.org — from classic search
**and** AI answer engines — by being the most useful, most citable source for
the questions our audiences actually ask. Traffic is the accountable metric
(see the ledger in `methodology.md`), but traffic is a proxy for the mission:
more people choosing to walk, bike, and ride transit across Greater Boston.

## The strategic insight: who is really in our market

We do not only compete for people already searching for a bike nonprofit. Our
real opportunity is **persuadable adjacent audiences** — people at a moment of
change who could be won over to active transportation:

1. **Used-car shoppers** — comparing cars on cost could compare an e-bike
   instead. The money-and-time math is our wedge.
2. **New-to-Boston movers** — a move is the moment commutes get rethought.
   "What's near my new place?" is a question we answer better than anyone.
3. **Parents** — wondering if a family can really get around by bike. We show
   how families here actually do it.
4. **Year-round weather worriers** — people who assume New England weather
   rules it out. We normalize and equip.

Plus our existing audiences: town-level commuters (our strongest asset),
employers, schools, and local businesses.

Full cluster definitions, queries, and page targets live in
`keyword-portfolio.json`.

## Messaging guardrails (HARD — every drafted word obeys these)

These come straight from org policy and are non-negotiable:

- **Never position against cars or driving.** No "ditch your car," no
  car-shaming, no us-vs-them. We add a capability, we don't attack one.
- **Lead with the positive benefits** of walking, biking, and transit — money
  kept, time reclaimed, health, fresh air, community, fun.
- **Lead with the practical benefits; don't lean on "sustainable."** Prefer
  "active transportation" as our own term for what we do. **This is a matter of
  emphasis, not a banned word** — corrected by Keith 2026-09-22: _"We don't have
  a rule about never using the word 'sustainable,' we just try to lead with
  practical benefits to active transportation."_ So: money kept, time
  reclaimed, health, fresh air, community and fun come first, and "sustainable"
  is fine where it is the accurate word — including in its ordinary sense of
  "something you can keep up." Do not flag an instance of it as a finding on its
  own, and do not propose one-word swaps to remove it. We may also _target_ a
  query containing the word because that is what someone typed.
- **No negative framing.** Don't tell people what things aren't or what they're
  doing wrong. Cut sentences that define by negation.
- Match the site's established voice (see `content/micro-guides-library.md`).

Targeting a query is not the same as echoing its wording. We can rank for
"do I need a car in Boston" with a page titled "Getting around Boston by T,
bike, and foot."

## Channel strategy

- **Classic SEO** — unique titles, clean canonicals, complete sitemap, fast
  pages, strong internal linking. Foundation hardened in the `seo-foundation`
  work; keep it clean.
- **AEO (answer engines)** — be the most parseable, most citable source:
  structured data (FAQPage, Article, Organization), an `llms.txt` index,
  question-shaped headings, and one-paragraph extractable answers. We optimize
  the _inputs_ and measure _proxies_ (see the honesty note below).
- **Content** — new micro-guides slot into the existing pipeline
  (`content/micro-guides-library.md` → migration → Supabase). Town pages are
  the proven organic engine; extend them as towns qualify.

## Growth model (added 2026-09-28)

Search traffic matters because of what visitors do next. The funnel we manage:

**impressions → clicks → sessions → activated (used the Commute Advisor or a
/nearby snapshot) → app intent (clicked toward the Shift app)**

**North star: app-intent sessions from search, answer engines and paid.**
Organic traffic is the compounding asset. Paid is the fast lane and the test
bed.

**Channel roles**

- **Organic search:** durable, compounding reach. Town pages, Roams, events
  and guides. Accountable for impressions → clicks *and*, from now on, for its
  app-intent rate. Organic visitors almost never click through to the app
  (3 in 189 sessions over the four weeks to 2026-09-27), so conversion on
  high-traffic pages is as big a lever as more traffic.
- **Google Ad Grants ($10k/month, search only):** reach for the queries we
  don't rank for yet, a brand defense, and a fast test lab. Its search terms
  are keyword research for organic, and its winning headlines are title
  candidates. Grant rules (5% CTR by calendar month, ≥1 conversion a month) are
  hard constraints. The `ad-grants-review` routine owns the account. This
  routine reads its snapshots and reasons across both channels.
- **Other paid (Meta/Reddit campaigns):** campaign-driven bursts. The SEO
  routine measures them in the funnel so paid spikes are never mistaken for
  organic growth, and borrows what converts (e.g. the semester landing pages
  convert paid social at ~7% to app intent).
- **Answer engines:** input-optimized (structured data, llms.txt, citable
  answers), proxy-measured.

**The loop:** data → analysis → insight → hypothesis → experiment → data. See
`seo/methodology.md`. The hypothesis backlog and experiments live in
`seo/experiments.md`. Verdicts write to *Learnings* below.

## Learnings

One line per verdict or hard-won observation, newest first. Next hypotheses
come from here.

- 2026-10-05 (observed): named public events with a practical "when, where,
  how to get there" question are the fastest-compounding organic class. The
  Allston Open Streets listing ranked 5.5 and took 11 clicks in one week,
  20% of the site's clicks; Fluff Fest (organizer-owned) took 0. List
  city-run car-free days early; set aside one-offs whose searchers want the
  organizer.
- 2026-10-05 (observed): when every result states the same fact (Fresh Pond
  loop = 2.25 mi), putting it in our title is table stakes, not an edge. The
  next Roam lever is what the others don't combine: start by T/bike, surface,
  time at walking vs riding pace.
- 2026-10-05 (observed): event URLs moved to readable slugs on 2026-09-30
  (308 from legacy ids). Read event cohorts across that date on a mapped
  old-id ↔ slug basis.
- 2026-09-28 (observed): organic sessions convert to app intent at ~1.6%;
  Reddit semester-campaign sessions landing on the same campus pages convert at
  ~7%. The pages can convert. Organic visitors arrive with a different job.
- 2026-09-28 (observed): a festival page run by someone else can take hundreds
  of impressions at zero CTR. Event growth must be read net of one-offs.
- 2026-09-21 (observed): the wedge audiences' *head* queries are owned by
  vendor blogs. The opening is the local, specific question (used prices here,
  local routes, local events), which is also where we already win (Roams, events
  at positions 3–9).
- 2026-09-21 (observed): event pages are the best-converting search class
  (2–3% CTR at positions 4–8), and new event pages supply most event clicks.
- 2026-09-08 (observed): a zero-impression cluster that already has content is
  a visibility/structure problem, not a content problem (year-round-weather).

## What "winning" looks like

- Organic clicks and impressions trending up per audience cluster, not just in
  aggregate.
- Our four wedge audiences (used-car, movers, parents, weather) showing
  impressions where we had ~none.
- The sentinel AEO questions increasingly returning GSI as a cited source.
- No regression on the core town-commuter cluster.
- The north star (app-intent sessions from search + answer + paid) trending up,
  and organic's app-intent rate climbing, not just its session count.
- Ad Grants compliant every calendar month and feeding real search-term
  evidence into organic hypotheses.

Steady and compounding beats spiky. The routine is accountable for the trend,
and must re-strategize (not just report) when it flattens.

## AEO honesty (do not overpromise)

- **We can measure:** Search Console data (clicks/impressions/position,
  including some AI-surface referrals in aggregate), presence and rough
  position in live web search for question-shaped queries, whether GSI is cited
  in search-grounded answers, structured-data validity, and llms.txt health.
- **We cannot measure:** rankings _inside_ ChatGPT / Perplexity / Claude, or
  Google AI Overview inclusion specifically. No tool in this stack sees those.
  The routine will never fabricate an "AI visibility" number. Our AEO strategy
  is input-optimized and proxy-measured.
