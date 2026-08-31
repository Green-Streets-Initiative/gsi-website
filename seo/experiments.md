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
