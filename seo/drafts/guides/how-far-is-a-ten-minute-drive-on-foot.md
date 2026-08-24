# DRAFT — proposed micro-guide (SEO item 3, report 2026-08-24)

Not live. The public site only renders Supabase rows with `status='approved'`;
this file renders nothing. To ship, append the YAML+body block below to
`content/micro-guides-library.md`, run
`node scripts/build-micro-guides-migration.mjs`, and apply the migration.

**Why this guide:** `/commute-advisor` earned 316 Search Console impressions at
average position 9.2 in the week of 2026-08-15 and converted one click — our
largest impression source. The queries behind it ("10 minute drive to walk",
"15 min drive to walk", "what is a 5 minute drive in walking", "commute times")
ask for a number, and our answer currently lives behind a form field. This guide
states the number first, then hands people the tool.

**Note on `status`:** set to `draft` below on purpose. Change it to `approved`
at ship time.

---

### `mg_drive_time_on_foot`

```yaml
id: mg_drive_time_on_foot
title: "How far is a 10-minute drive on foot or by bike?"
summary: "A 10-minute drive across Greater Boston is roughly two and a half miles — about 12 minutes on a bike. Here's the whole conversion, with the parking minutes counted."
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

### Count the parking minutes.

Drive-time estimates usually stop at the destination address. The real trip includes finding a space and walking from it — in Cambridge, Somerville, the Seaport, or anywhere near a hospital or a campus, that's regularly another 5 to 15 minutes. Add it back and the gaps above close considerably, especially at the short end.

### Try this first

Put your own trip into the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor). It gives you real walking, biking, and transit times for the actual route, plus what each option costs per day and per year.

---

## Ship checklist

- [ ] Change `status: draft` → `status: approved` in the YAML.
- [ ] Append the `### \`mg_drive_time_on_foot\`` block (YAML + body, through the trailing `---`) to `content/micro-guides-library.md`.
- [ ] Add `mg_drive_time_on_foot` to the `related` list on `mg_walking_vs_driving` and `mg_bike_time` so the cross-links run both ways.
- [ ] `node scripts/build-micro-guides-migration.mjs`, commit both files by filename, push, apply the migration.
- [ ] Ship item 2 (portfolio patterns) alongside, so the new `drive-time-conversion` cluster starts measuring this page.
- [ ] Record the ship date in `seo/experiments.md` to start the verdict clock (suggested verdict-by: +6 weeks).
