# DRAFT — answer page (first five, for Keith's review 2026-10-16)

Not live. Follows `seo/answer-pages.md`.

**Why this page:** answers question-bank c11 ("Do you need a car to live in
Boston?"), c12 ("What's the best way to get around Boston without a car?"),
c13 ("What is the cheapest way to get around Boston?"), c14 (Somerville or
Cambridge), c15 (walkable neighborhoods) and c17 (families). On 2026-10-16
realtors, movers and tourism sites supplied most of the sources for these
answers in all three assistants, and GSI was named in none. These are the
people New Routes is for.

**Judgment call for Keith:** the opening cites the Census share of households
that don't own a car. It is a fact about households, not our framing, and it
is the strongest answer to the question. Our own copy still avoids "car-free"
and "without a car".

**Our data:** `seo/data/answer-evidence/getting-around-boston.md`.

## Ship checklist

1. Add under `mbta` in `src/lib/facts/prices.json`: `"reducedSubway": 1.1`,
   `"reducedBus": 0.85`, `"reducedLinkPass": 30` (source:
   mbta.com/fares/reduced, read 2026-10-16).
2. Append the block below to `content/micro-guides-library.md`, set
   `status: approved`, bump the guide count, rebuild, apply the seed.
3. Point bank questions c11–c15 and c17 `our_page` at `/guides/getting-around-boston`.
4. Polish pass at phone and desktop width.

---

### `mg_getting_around_boston`

```yaml
id: mg_getting_around_boston
reviewed: 2026-10-16
title: "Getting around Boston by T, bike and foot"
summary: "Do you need a car to live in Boston, Cambridge or Somerville? For most people, no. How people here get around, what it costs, and the neighborhoods where it's easiest."
slug: getting-around-boston
mode: multimodal
barrier: planning
status: draft
content_type: micro_guide
surfaces: [guide_library]
topics: [getting-started, planning, mbta-basics, bike-share, family]
related: [mg_pay_for_t, mg_bluebikes, mg_cargo_bike]
```

For most people who live in Boston, Cambridge or Somerville, a car is optional. About a third of households in Boston and Cambridge don't own one ([Census, 2020 to 2024](https://censusreporter.org/data/table/?table=B25044&geo_ids=16000US2507000,16000US2511000,16000US2562535)). The neighborhoods are close together, and walking, the T and Bluebikes cover most everyday trips. For the few trips that need a car, you can rent one by the hour.

### How do people here get to work?

In Boston, about a third of workers drive alone to work. About 1 in 5 takes transit, and about 1 in 7 walks. In Cambridge, walking (19%) and transit (18%) are each about as common as driving alone (20%), and nearly 1 in 12 bikes. These are U.S. Census figures for 2020 to 2024 ([Census Reporter](https://censusreporter.org/data/table/?table=B08301&geo_ids=16000US2507000,16000US2511000,16000US2562535)).

People using Shift who live in these cities show the same thing for every kind of trip, not only the commute. About 7 in 10 of their trips were on foot, by bike or by transit, and more than 4 in 10 were walks.

**About these numbers:** From 12,256 trips recorded by 65 people using Shift who live in Boston, Cambridge, Somerville or Brookline, August 21 to October 16, 2026.

### What's the cheapest way to get around?

Walking, for anything under a mile or so. After that:

- **The T:** {{price:mbta.subwaySingle}} on the subway, {{price:mbta.busSingle}} on the bus, or {{price:mbta.linkPassMonthly}} a month for unlimited subway and bus rides. Through February 2027, if you switch between the bus and subway within two hours on the same card or phone, you pay only the higher of the two fares.
- **Reduced fares:** people 65 and older, people with disabilities, and people on SNAP, MassHealth and some other programs pay {{price:mbta.reducedSubway}} on the subway, {{price:mbta.reducedBus}} on the bus, or {{price:mbta.reducedLinkPass}} a month ([how to apply](https://www.mbta.com/fares/reduced)). Children 11 and under ride free, and so do riders 75 and older who no longer drive.
- **Bluebikes:** {{price:bluebikes.singleRide}} a ride, or {{price:bluebikes.annual}} a year with 45 minutes per ride, at nearly 600 stations in 13 cities and towns.

### Which neighborhoods are easiest?

The ones where shops, a T stop and a Bluebikes dock are all a short walk away. On walkscore.com's 100-point scale, Beacon Hill, Back Bay, the South End and Fenway-Kenmore score 95 or higher for walking and over 90 for transit. Davis Square in Somerville scores 97 for walking, and Cambridge as a whole scores 96 for biking. Central Maverick Square in East Boston and Uphams Corner in Dorchester both score 90 or higher for walking. (Scores as listed in October 2026.)

The same pattern holds beyond Boston. Town centers with a commuter rail station and Bluebikes, like Salem, work much the same way at a smaller scale.

### Can a family with young kids do it?

Many do. Children 11 and under ride the T free, strollers are welcome on the subway, and most stations have elevators. For daycare drop-offs and groceries, many parents use a cargo bike ([how families use them](/guides/what-you-can-do-with-an-e-cargo-bike)).

One thing to know before you rely on ride-hail: Massachusetts law requires a car seat for children under 8 unless they're over 57 inches tall, and that applies in an Uber or Lyft ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section7AA)). Taxis without child seats are exempt.

### What about the trips that need a car?

Car-share services like Zipcar rent cars by the hour from lots across the city, with gas and insurance included. A regular rental works for weekend trips.

### Try this first

Before you sign a lease, check the address against the three places you go most: work or school, groceries, and one place you love. See how long each trip takes on foot, by bike and by T.
