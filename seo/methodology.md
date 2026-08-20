# SEO / AEO Routine — Methodology

The scheduled task (`~/.claude/scheduled-tasks/seo-aeo-review/SKILL.md`) is a
thin pointer to this file. Read `seo/strategy.md` first, then follow this.

Project: `/Users/keithanderson/gsi-website` · Site: https://www.gogreenstreets.org

## Which mode

Check today's date. If day-of-month ≤ 7 **and** `.seo-state.json.last_deep_dive`
is not in the current month → run the **monthly deep-dive**. Otherwise run the
**weekly pulse**. The deep-dive replaces that week's pulse (it is a superset).

## Environment & tools

- **Search Console**: `node scripts/seo/pull-gsc.mjs --mode weekly|monthly|backfill`.
  It writes JSON to `seo/data/gsc/`. If it exits non-zero (missing key at
  `~/.config/gsi-seo/gsc-service-account.json`, or a missing `$CRON_SECRET`
  later), **email Keith the one-line blocker and stop** — do not fall back to
  the keychain or `$(...)`; both stall unattended runs on permission prompts.
- **PostHog** (organic sessions): use the PostHog MCP `exec` tool (HogQL). If it
  is unavailable in this run, skip the PostHog rows and note the gap once — GSC
  clicks are then the traffic metric.
- **Live search / AEO checks**: the `WebSearch` tool. Competitor teardown pages:
  `WebFetch`.
- **Email**: write a `{ "subject": ..., "text": ... }` JSON payload file with
  the Write tool, then a single-line `curl` POST to
  `https://xyqcpgwbqrhykpgpqbdi.supabase.co/functions/v1/sentry-triage-email`
  with header `X-Cron-Secret: $CRON_SECRET` (delivers to keith@gogreenstreets.org).
  Subject prefix: `[GSI] SEO weekly —` or `[GSI] SEO monthly deep-dive —`.
  **Always send an email, even on a quiet week**, so Keith knows it ran.
- **Git**: `git pull` at the start. Commit reports/state/data/drafts **by
  filename** (never `git add -A`) and push to `main`. Page-code changes only
  ever go on `seo/…` branches — never committed to main by the routine.
- Never use `$(...)` command substitution. Single-line `curl` commands only.

## Weekly pulse

1. `git pull`. Read `seo/strategy.md`, `seo/keyword-portfolio.json`,
   `.seo-state.json`, and last week's report in `seo/reports/`.
2. `node scripts/seo/pull-gsc.mjs --mode weekly`.
3. PostHog: organic sessions this week vs the trailing 4-week mean; top organic
   landing pages. (Organic = referring domain in google/bing/duckduckgo/
   ecosia/yahoo/… — confirm `$referring_domain` exists on `$pageview`; if not,
   note it and use GSC only.)
4. **SERP spot-checks (6 queries):** the 3 fixed sentinels from the
   `aeo-sentinels` cluster + 3 rotated through the portfolio using
   `.seo-state.json.serp_rotation_index`. For each: does gogreenstreets.org
   appear, roughly what position, and which domains rank above us. Advance and
   save the rotation index.
5. **Health checks (curl only):** sitemap.xml returns 200 and its `<loc>` count
   vs the state fingerprint (a drop = a DB blip dropped a section — flag it);
   robots.txt and llms.txt return 200 and hash vs fingerprint; 2 key pages
   still emit their expected `<title>` and canonical.
6. **Diff:** per cluster, clicks / impressions / avg-position vs the 4-week and
   12-week baselines (recomputed from `seo/data/gsc/weekly-*.json`). Flag movers
   (±20% clicks or ≥3 positions). Check `experiments.md` for entries whose
   `verdict-by` date has passed → write a verdict (won / lost / inconclusive—
   extend) from that cluster's data.
7. Write `seo/reports/YYYY-MM-DD.md`. Update `.seo-state.json` (baselines cache,
   rotation index, `stagnant_weeks`, pending-item registry, health
   fingerprints). Commit + push those files.
8. **Email:** ledger scoreboard first (below), then experiment verdicts, then
   **at most 3 proposed actions** each ending with a ship phrase, then a
   one-line health status and a link to the report on GitHub.

## Monthly deep-dive (first ≤7 days of the month)

Everything in the weekly pulse, plus:

1. `node scripts/seo/pull-gsc.mjs --mode monthly` (28-day + 12-month trend +
   device split).
2. **Competitor teardown:** for the top 3 priority clusters, `WebSearch` the
   head query, then `WebFetch` the top 2–3 ranking pages (cap 8 fetches total).
   For each cluster write a short "what would beat this" paragraph: what
   question their page answers that ours doesn't, its structure, schema, and
   freshness.
3. **Portfolio re-evaluation:** promote recurring `unmatched_top_queries` into
   clusters (or new clusters); retire queries with zero impressions across 3
   monthly pulls; re-rank priorities. Edit `keyword-portfolio.json`, explain in
   the report.
4. **AEO health:** validate the JSON-LD on 5 key pages (curl + parse the
   `application/ld+json` blocks, check required fields); confirm llms.txt covers
   every indexable page class in the sitemap; run each cluster's `aeo_questions`
   through `WebSearch` and record whether GSI is cited/surfaced.
5. **Experiment proposals:** append 1–3 entries to `experiments.md` as
   `proposed` — hypothesis, exact change, success metric + cluster,
   `verdict-by` (≈ +6 weeks).
6. **Content drafting:** up to 2 new micro-guide drafts into
   `seo/drafts/guides/<slug>.md` (full YAML + body, library voice, messaging
   policy), and/or one page-edit branch `seo/YYYY-MM-<slug>` (pushed, never
   merged). Self-check every drafted word against `seo/strategy.md`.
7. **Email:** prioritized numbered list (effort × expected impact), teardown
   highlights, portfolio changes, the ledger.

## The accountability ledger (top of every report and email)

| Metric | This period | vs 4-wk avg | vs 12-wk avg |
|---|---|---|---|
| Organic clicks (GSC) — total + per active cluster | | | |
| Impressions + avg position per cluster | | | |
| PostHog organic sessions | | | |
| AEO sentinel citations (n of 6) | | | |

Baselines are trailing means recomputed each run from the committed
`seo/data/gsc/weekly-*.json` files — git history is the time series; state only
caches the latest values.

## Stagnation trigger (mechanical — do not skip)

Increment `.seo-state.json.stagnant_weeks` when trailing-4-week total organic
clicks are within ±2% of the prior 4-week window **and** no experiment is
mid-flight. Reset to 0 on any >5% 4-week-over-4-week gain.

At **`stagnant_weeks` ≥ 6**, the next run (even a weekly) must run a
**re-strategize block**: re-score every cluster, kill or restructure at least
one, propose one *structural* experiment (new page, new content series, or an
IA change — not another tweak), and open the email with
"Organic traffic has been flat for N weeks. Here is the revised plan."
Never report flat traffic as "steady."

## AEO honesty

State the limits in the first email and whenever asked. We measure GSC data,
live-search presence for question-shaped queries, citation presence in
search-grounded answers, and structured-data/llms.txt health. We do **not** see
inside ChatGPT / Perplexity / Claude or Google AI Overviews, and we never
fabricate an "AI visibility" score.

## Draft-and-approve delivery

- **New guides** → commit `seo/drafts/guides/<slug>.md` to `main`. Safe: the
  live site only serves Supabase rows with `status='approved'`; a draft file
  renders nothing. Keith can read it on GitHub from his phone.
- **Page/code edits** → branch `seo/YYYY-MM-<slug>`, pushed. The email links the
  GitHub compare URL and the Vercel preview.
- Give every proposed item a stable ID and record it in
  `.seo-state.json.pending` (`report_date`, `item_n`, `type`, `ref`,
  `ship_steps`). End each emailed item with:
  _"to ship: open Claude Code and say 'ship SEO item N'"_ (and "decline SEO
  item N"). Age unshipped items out after 8 weeks with a one-line note.

## Shipping items (for an interactive session, when Keith says "ship SEO item N")

Resolve the item(s) from the latest report + `.seo-state.json.pending`, then by
type:

- **Guide draft:** append the draft's YAML+body block to
  `content/micro-guides-library.md`, run
  `node scripts/build-micro-guides-migration.mjs`, commit both by filename, push,
  and apply the generated migration through the existing migration flow (the
  `apply-pending-migrations` routine, or directly with Keith watching).
- **Page-edit branch:** merge `seo/…` into `main`, push, confirm the Vercel
  deploy succeeds, delete the branch.

Then record the ship date in `experiments.md` (this starts the verdict clock)
and clear the pending entry. "decline SEO item N" marks it declined in state so
it is never re-proposed without new evidence.

## Hard guardrails

- Never merge branches, never edit `content/micro-guides-library.md` directly,
  never apply migrations, never touch production data — the routine drafts and
  proposes; Keith approves.
- Every drafted word obeys `seo/strategy.md`: positive framing, "active
  transportation" (never "sustainable"), never positioned against cars, no
  negative framing. Self-check before committing.
- SELECT-only for any DB access. No emails to anyone but Keith. No PII in
  reports.

## One-time GSC setup (Keith does this once; a session walks him through it)

1. console.cloud.google.com → sign in with the Google account that has Search
   Console access → new project `gsi-seo`.
2. APIs & Services → Library → enable **Google Search Console API**.
3. IAM & Admin → Service Accounts → create `gsi-seo-reader` → skip roles → Done.
4. Open it → Keys → Add key → Create new key → **JSON** (a file downloads).
   Copy the service-account email (…@gsi-seo.iam.gserviceaccount.com).
5. search.google.com/search-console → the gogreenstreets.org property →
   Settings → Users and permissions → Add user → paste that email →
   permission **Full** (Restricted sometimes 403s the API; it stays read-only
   for our purposes).
6. In Claude Code, say "finish the GSC key setup": the session moves the
   downloaded JSON to `~/.config/gsi-seo/gsc-service-account.json`, `chmod 600`s
   it, confirms the property id in `seo/gsc-config.json`
   (Domain → `sc-domain:gogreenstreets.org`; URL-prefix →
   `https://www.gogreenstreets.org/`), and runs
   `node scripts/seo/pull-gsc.mjs --mode check`.

## First run (baseline)

Run supervised. `--mode backfill` (16 weekly files → instant 4/12-week
baselines), a SERP baseline for all priority-1 queries, an AEO sentinel
baseline, and verify the PostHog `$referring_domain` property. The report is a
"Baseline" edition — absolute numbers, no deltas, the AEO-limits paragraph, and
a note on what will be measured and when the first verdicts land.

## `.seo-state.json` shape

```json
{
  "last_run": "YYYY-MM-DD",
  "last_deep_dive": "YYYY-MM",
  "serp_rotation_index": 0,
  "stagnant_weeks": 0,
  "baselines": { "clicks_4wk": null, "clicks_12wk": null },
  "health": { "sitemap_loc_count": null, "llms_txt_hash": null, "robots_hash": null },
  "pending": []
}
```
