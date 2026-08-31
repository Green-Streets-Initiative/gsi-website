# DRAFT — proposed micro-guide (SEO item 3, report 2026-08-24)

Not live. The public site only renders Supabase rows with `status='approved'`;
this file renders nothing.

**Why this guide:** `/commute-advisor` and `/guides/when-walking-is-faster` took
472 Search Console impressions between them in the week of 2026-08-22 — the two
largest impression sources on the site, both on page one — and converted zero
clicks. The queries behind them ("10 minute drive to walk", "15 min drive to
walk", "what is a 5 minute drive in walking", "commute times", "commute
distance", "commute radius") ask for a number, and our answer currently lives
behind a form field. This guide states the number first, then hands people the
tool.

**Revision 2026-08-31 (Keith):** added a door-to-door section covering the
factors that change each mode's real travel time — finding and paying for
parking especially, plus locking up, waiting, and walking to the stop. Treated
per-mode rather than parking-only: it is what makes the guide genuinely useful,
and it keeps the piece additive rather than a case against driving.

**Prices use `{{price:…}}` tokens**, resolved at build time from
`src/lib/facts/prices.json` and re-resolved by the freshness cron, so the
figures cannot go stale in the guide body.

## Ship checklist

1. Append the YAML+body block below to `content/micro-guides-library.md`.
2. **Change `status: draft` to `status: approved`** (it is `draft` on purpose here).
3. Bump the guide-count check in `scripts/build-micro-guides-migration.mjs`
   from `!== 20` to `!== 21` — it is a `console.warn`, so it will not block, but
   it should stay meaningful.
4. `node scripts/build-micro-guides-migration.mjs`
5. Commit both files by filename, push, apply the generated migration.

---

### `mg_drive_time_on_foot`

```yaml
id: mg_drive_time_on_foot
title: "How far is a 10-minute drive on foot or by bike?"
summary: "A 10-minute drive across Greater Boston is roughly two and a half miles — about 12 minutes on a bike. Here's the whole conversion, plus the door-to-door minutes each way of getting around adds on top."
slug: how-far-is-a-ten-minute-drive-on-foot
mode: walking
barrier: time
status: draft
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [planning, short-trips, motivation, routes]
related: [mg_walking_vs_driving, mg_bike_time, mg_transit_time]
```

People measure trips in drive-minutes. Here's what those minutes look like on foot and on a bike, using typical Greater Boston traffic speeds of roughly 12–15 mph on local streets and arterials.

### A 5-minute drive is about a mile.

That's a 20-minute walk, or a 6-minute ride. At this distance the bike is usually the fastest thing you own, and the walk is short enough that plenty of people do it without thinking of it as a walk.

### A 10-minute drive is about 2 to 2.5 miles.

Call it 45 minutes on foot and 12 minutes on a bike. This is the sweet spot for biking around here — far enough that walking takes real time, close enough that you arrive before you'd have found parking.

### A 15-minute drive is about 3 to 4 miles.

An hour or so of walking, and about 20 minutes on a bike. On an e-bike it's closer to 15, at a pace that doesn't ask much of you.

### A 20-minute drive is about 5 miles.

Roughly 25 to 30 minutes riding, or 20 on an e-bike. Five miles is also comfortable territory for a bike-plus-T trip if the weather turns.

### Door to door is the comparison that counts.

Each of those estimates measures a different slice of the trip. Here's what to add back for a real one.

**Parking, if you drive.** The estimate stops at the destination address. The trip you actually take includes finding a space and walking in from it — around a hospital, a campus, the Seaport, or downtown, that's regularly another 5 to 15 minutes at the destination and a few more back at the start. Paying is its own step: a day in a Boston garage runs about {{price:driving.parkingDailyBoston}}, and metered spots want a minute at the kiosk or in the app. On a short errand that overhead can be most of the trip.

**Locking up, if you bike.** Add a minute or two at each end. On Bluebikes, add the walk to a dock, and at rush hour the occasional extra block to reach one with a free spot — a single ride is {{price:bluebikes.singleRide}}, or {{price:bluebikes.annualPerMonth}} a month on an annual pass.

**Walking and waiting, if you take the T.** Add the walk to the stop, the wait, and the walk at the far end. The ride itself is {{price:mbta.subwaySingle}} on the subway, {{price:mbta.busSingle}} on the bus, and it's usually those two walks — not the ride — that decide whether transit beats driving on a given trip.

**Nothing extra, if you walk.** The estimate is already door to door. What you see is what it takes, which is a large part of why walking wins more short trips than people expect.

Add all of that back and the gaps at the short end close considerably. Under about a mile, the modes are usually much closer than the drive-time estimate makes them look.

### Try this first

Put your own trip into the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor). It gives you real walking, biking, and transit times for the actual route, plus what each option costs per day and per year.
