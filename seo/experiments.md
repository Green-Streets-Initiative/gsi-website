# SEO / AEO Experiment Ledger

Append-only. The routine adds rows; interactive sessions update `Shipped` and
`Verdict` when items ship and when the `verdict-by` date passes. Never delete
rows — a lost experiment is as informative as a won one.

Statuses: `proposed` → `shipped` → `won` / `lost` / `inconclusive`.

| ID | Proposed | Hypothesis | Change | Cluster | Metric | Shipped | Verdict-by | Status | Verdict |
|----|----------|-----------|--------|---------|--------|---------|-----------|--------|---------|
| _(first traffic experiments land with the September deep-dive)_ | | | | | | | | | |

## Shipped infrastructure (no verdict clock)

Measurement and hygiene fixes. They change what we can see or how the site is
crawled, not what we are testing, so they carry no hypothesis and no
`verdict-by`. Recorded here so the ship dates are in one place.

| ID | Proposed | Change | Shipped | Effect to watch |
|----|----------|--------|---------|-----------------|
| item-2026-08-24-1 | 2026-08-24 | Record true Search Console totals in the puller — no-dimension call stored as `site_totals`, page rowLimit 500, page rows sorted by impressions (`scripts/seo/pull-gsc.mjs`) | **2026-08-31** | None on traffic. Ledger level is now exact rather than ~4× under. History re-backfilled the same day; baselines restated to 4wk 12.8 clicks / 1,263 impressions. |
| item-2026-08-24-2 | 2026-08-24 | Repair `keyword-portfolio.json` bucketing — gerund fix, all 41 published towns, path/trail/greenway patterns, new `drive-time-conversion` and `brand-navigational` clusters | **2026-08-31** | None on traffic. Cluster coverage goes from 6% of query impressions to ~88%, so the per-cluster ledger becomes readable. Watch that `brand-navigational` keeps brand demand separated from discovery demand — the latter is the accountable number. |
| item-2026-08-31-4 | 2026-08-31 | Drop `utm_content` from same-site internal links — footer town column, nav dropdown, town chip strips (`Footer.tsx`, `Nav.tsx`, `TownsCrossLink.tsx`, `events/page.tsx`) | **2026-08-31** | Clean `/shift/towns/<slug>` rows should replace the `?utm_content=` ones in the GSC page table over the next few weeks, and arlington should consolidate from two rows into one. Watch weekly until it resolves. Not a traffic experiment — no verdict clock — but if the parameterized rows persist past ~6 weeks, escalate. |
| item-2026-08-24-3 | 2026-08-24 | Micro-guide [How far is a 10-minute drive on foot or by bike?](https://www.gogreenstreets.org/guides/how-far-is-a-ten-minute-drive-on-foot) — states the drive-time conversion as plain sentences, then hands people the Commute Advisor. Includes per-mode door-to-door factors (parking time and cost, locking up, walk-wait-walk on transit) | **2026-08-31** | This one *is* a traffic bet, unlike items 1/2/4. `/commute-advisor` + `/guides/when-walking-is-faster` took 472 impressions and 0 clicks in the week of 2026-08-22. Watch whether the new guide earns its own impressions in `drive-time-conversion`, whether those two pages' CTR recovers, and whether the guide cannibalises `when-walking-is-faster`. Call it around 2026-10-12. |
