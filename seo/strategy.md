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
- **Say "active transportation," never "sustainable."** (We may _target_ a
  query that contains "sustainable" because that's what someone typed — but our
  own copy never uses the word.)
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

## What "winning" looks like

- Organic clicks and impressions trending up per audience cluster, not just in
  aggregate.
- Our four wedge audiences (used-car, movers, parents, weather) showing
  impressions where we had ~none.
- The sentinel AEO questions increasingly returning GSI as a cited source.
- No regression on the core town-commuter cluster.

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
