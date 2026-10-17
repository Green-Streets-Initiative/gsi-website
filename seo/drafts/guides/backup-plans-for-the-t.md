# DRAFT — answer page (first five, for Keith's review 2026-10-16)

Not live. Follows `seo/answer-pages.md`.

**Why this page:** answers question-bank f13 ("The MBTA is always late, what
are my other options for getting to work?"), f14 ("The Red Line is shut down
again, what's the fastest way to get to work?"), f15 ("Is the Green Line slower
than walking?") and f16 ("I'm sick of the T, should I get an e-bike or a
scooter?"). On 2026-10-16 no assistant named Green Streets for any of them and
we had no page. Riders who give up on the T during a closure are the ones most
likely to start driving (our data below).

**Our data:** `seo/data/answer-evidence/backup-plans-for-the-t.md` (Red Line
closure behaviour, Green Line vs walking) and `boston-traffic.md` (rush-hour
speeds).

**Facts to re-check before shipping:** the e-bike and scooter bill (in
conference committee as of 2026-09-16); whether any subway slow zones have
returned in 2026.

## Ship checklist

1. Add `"incomeEligibleMonthly": 5` under `bluebikes` in
   `src/lib/facts/prices.json` (source: bluebikes.com/pricing, read 2026-10-16;
   income-eligible is $5 a month or $50 a year).
2. Append the block below to `content/micro-guides-library.md`, set
   `status: approved`, bump the guide count, rebuild, apply the seed.
3. Point bank questions f13–f16 `our_page` at `/guides/backup-plans-for-the-t`.
4. Polish pass at phone and desktop width.

---

### `mg_t_backup_plans`

```yaml
id: mg_t_backup_plans
reviewed: 2026-10-16
title: "Backup plans for when the T is late or closed"
summary: "The T runs on time far more often than it did two years ago, but closures still happen. How to pick a backup before you need one."
slug: backup-plans-for-the-t
mode: multimodal
barrier: planning
status: draft
content_type: micro_guide
surfaces: [guide_library]
topics: [mbta-basics, planning, bike-share, multimodal]
related: [mg_bluebikes, mg_subway_vs_bus, mg_transit_planning]
```

When the T is late or a line is closed, your best backup is usually a bus that runs near your line, a Bluebike, or the commuter rail. Pick one the night before a planned closure, check the alerts before you leave, and give yourself extra time if you take the shuttle.

### Is the T really less reliable than it used to be?

No. It's more reliable than it was a few years ago. The MBTA counts a Red, Orange or Blue Line trip as on time when it arrives within five minutes of the expected time. By late 2025 about 92% of trips met that bar, up from about 25% in late 2023 ([Christian Science Monitor](https://www.csmonitor.com/Business/2025/1115/boston-mbta-phillip-eng)). Current numbers are on the [MBTA's reliability page](https://www.mbta.com/performance-metrics/service-reliability).

In December 2024 the MBTA cleared more than 220 slow zones, stretches where trains must go slower for safety ([MBTA](https://www.mbta.com/projects/track-improvement-program)). Short ones for repairs have come and gone since. In the last published data, from May 2026, there were a few, including a 10 mph zone at Braintree ([TransitMatters](https://dashboard.transitmatters.org/system/slowzones)).

Planned repair closures still happen, like the Red Line's closure from Alewife to Park Street on July 21 to 30, 2026.

### What did riders do during the July 2026 Red Line closure?

Among people using Shift who rode the Red Line regularly, driving went from about a quarter of their trips to about a third during the closure. Biking went up too, from 15% to 18% of trips. Yet at rush hour, drives of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby were no faster than biking or the subway: typically 8.4 mph by car, 8.6 by bike and 8.8 on the subway.

**About these numbers:** From trips recorded by 17 to 22 regular Red Line riders using Shift, June 22 to July 30, 2026 (a small group, in midsummer), and 1,078 rush-hour trips by people using Shift, July 18 to October 16, 2026.

### What are my backup options?

- **A bus near your line.** For the Red Line, route 77 runs from Arlington Heights to Harvard about every 10 to 15 minutes at rush hour, and route 96 runs from Medford Square to Harvard. The [MBTA trip planner](https://www.mbta.com/trip-planner) shows the bus options for your own trip. A bus ride is {{price:mbta.busSingle}}. Through February 2027, if you switch to the subway within two hours on the same card or phone, you pay only the higher fare.
- **Bluebikes.** Nearly 600 stations in 13 cities and towns. A single ride is {{price:bluebikes.singleRide}} and a day pass is {{price:bluebikes.dayPass}}. Members get 45 minutes per ride on a classic bike, and people who qualify by income can join for {{price:bluebikes.incomeEligibleMonthly}} a month.
- **The commuter rail.** If you live near a station, it can skip the closed stretch. During some closures the MBTA makes it free on the affected stretch: in July 2026 it was free between Porter and North Station.
- **The free shuttle.** Shuttles are free and accessible, but slow. In July the MBTA told riders to allow at least 70 minutes from Alewife to Park Street.

Around You in the Shift app shows the next buses and the bikes free at nearby docks.

### Is the Green Line slower than walking?

No, for most trips. On trips of 0.75 to 2 miles, Green Line rides recorded by people using Shift typically went 6.4 mph, more than twice their typical walking speed of 2.8 mph. Those times may leave out some platform waiting, so for one or two stops downtown, where stations are a quarter mile apart, walking can come close.

**About these numbers:** From 324 Green Line trips and 3,111 walks of 0.75 to 2 miles recorded by people using Shift, June to October 2026.

### Should I get an e-bike or a scooter?

In Massachusetts, e-bikes that stop helping at 20 mph need no license. You can ride them on roads, in bike lanes and on most paved paths, but not on sidewalks ([MassBike's e-bike guide](https://www.massbike.org/ebikesfaq)). Motorized scooters need a driver's license or learner's permit and a helmet, and can't be ridden between sunset and sunrise ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section1E)). A bill that would update these rules is still being worked out at the State House, so check before you buy. The state's e-bike rebate is closed for 2026.

### Try this first

Plan your backup tonight. Look up your usual trip in the MBTA trip planner, note one bus and the nearest Bluebikes dock, and sign up for [T-Alerts](https://alerts.mbta.com) for your line.
