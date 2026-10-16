# DRAFT — answer page (first five, for Keith's review 2026-10-16)

Not live. Follows `seo/answer-pages.md`.

**Why this page:** answers question-bank f01 ("Why is Boston traffic so bad?",
Keith's own example), f02 ("How can I avoid traffic on my commute into
Boston?"), f03 (MetroWest), f04 (South Shore and the Braintree Split), f05
(Route 128 and Burlington) and f06 (Mass Pike and the Worcester Line). On
2026-10-16 these answers cited CBS, car services, law firms and Reddit; no
assistant named GSI and we had no page.

**What our data found:** at weekday rush hour inside the inner core, driving,
biking and the subway all average about the same speed on 3 to 8 mile trips.
Driving's edge disappears at rush hour. Nobody else can publish that.

**Our data:** `seo/data/answer-evidence/boston-traffic.md`.

**Facts to re-check before shipping:** MassDOT took its 2025 congestion
report off mass.gov; the page links the Internet Archive copy (Dec 6, 2025).
Commuter rail on-time figures (dataset
runs to June 2026); scheduled ride times (MBTA weekday schedule, Oct 2026).

## Ship checklist

1. Uses `parking.framinghamDay` and `parking.mbtaGarageDay` from the
   parking-costs draft's `prices.json` additions.
2. Append the block below, set `status: approved`, rebuild, apply the seed.
3. Point bank questions f01–f06 at `/guides/boston-traffic`.
4. Polish pass at phone and desktop width.

---

### `mg_boston_traffic`

```yaml
id: mg_boston_traffic
reviewed: 2026-10-16
title: "Why Boston traffic is so bad, and how to get around it"
summary: "Boston drivers lose about 83 hours a year to traffic. Why it happens, how to time your trip, and the trains, buses and ferries that skip the worst of it."
slug: boston-traffic
mode: multimodal
barrier: time
status: draft
content_type: micro_guide
surfaces: [guide_library]
topics: [planning, mbta-basics, multimodal, short-trips]
related: [mg_transit_time, mg_bike_time, mg_transit_planning]
```

Boston's traffic is among the worst in the country. The average driver here lost 83 hours to it in 2025, the fifth most of any U.S. city ([INRIX](https://inrix.com/press-releases/2025-global-traffic-scorecard-us/)). Many of the state's jobs are in the Boston area, reached by a few bridges, tunnels and highways, and those roads are so full that one crash or storm backs everything up. You can't fix the traffic, but on many trips you can get around it.

### Why is it so bad?

- **Lots of jobs, few ways in.** The Boston region had 44% of the state's jobs in 2019 ([MassDOT](https://www.mass.gov/doc/congestion-in-the-commonwealth/download)).
- **The roads are full, so small problems spread.** When a road has no spare room, a single crash or work zone slows traffic for miles. MassDOT says the bigger problem is how unpredictable the trip is, more than the average delay.
- **A few choke points carry everyone.** The worst are the Tobin Bridge, the Zakim Bridge and the tunnels, the Southeast Expressway, the Leverett Connector, and Alewife Brook Parkway near Route 2. Seven of the state's ten worst spots are on I-93 ([MassDOT, 2025 update](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).
- **Rush hour is getting longer.** By 5 p.m. on a weekday, almost every major road inside Route 128 has some delay, and nearly half are congested as early as 2 p.m. Tuesday to Thursday is worse than Monday or Friday.

### Is driving faster in the city at rush hour?

Not by much. On weekday rush-hour trips of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby, people using Shift typically went 8.4 mph by car, 8.6 mph by bike and 8.8 mph on the subway. Outside rush hour, drives of that length typically went 10.3 mph.

**About these numbers:** From 1,078 rush-hour trips of 3 to 8 miles by car, bike and subway recorded by people using Shift, July 18 to October 16, 2026 (weekdays 7 to 9:30 a.m. and 4 to 7 p.m.). Typical means the middle trip.

### When should I leave to miss it?

Timing still matters. At 6 a.m., 15% of the roads inside Route 128 are congested. By 8 a.m., it's 45% ([MassDOT, 2024 data](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).

### How do I get around it from where I live?

- **MetroWest and the Mass Pike.** The commuter rail from Framingham reaches Back Bay in 35 to 56 minutes on weekday mornings. Parking at the Framingham station is {{price:parking.framinghamDay}} a day. From Worcester, the fastest morning train takes 70 minutes to South Station ([Framingham/Worcester Line schedule](https://www.mbta.com/schedules/CR-Worcester/timetable)).
- **The South Shore and the Braintree Split.** Park at the Braintree or Quincy Adams garage for {{price:parking.mbtaGarageDay}} and the Red Line reaches Park Street in under half an hour. From farther out, the Kingston and Greenbush trains take about an hour to South Station, and the Hingham ferry reaches Rowes Wharf in 30 to 40 minutes.
- **Route 128 and Burlington.** Bus 350 runs from Alewife to Burlington Mall Road in about 30 to 40 minutes. Many employers along 128 belong to a transportation management association that runs shuttles and carpool matching for their staff. [Find yours through MassCommute](https://www.masscommute.com/find-your-tma).

The trains can run late too, so check [T-Alerts](https://alerts.mbta.com) before you leave. But they skip the Braintree Split and the Pike, and you can read or rest on the way.

### Try this first

Pick one day next week and make your usual trip a different way: leave 45 minutes earlier, park at a T station and ride in, or take the train. Time it door to door and compare it with a normal day.
