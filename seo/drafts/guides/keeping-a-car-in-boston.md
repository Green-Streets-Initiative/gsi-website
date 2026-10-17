# DRAFT — answer page (first five, for Keith's review 2026-10-16)

Not live. Follows `seo/answer-pages.md`.

**Why this page:** answers question-bank f10 ("Is it worth keeping a car in
Boston if I only drive once a week?"), f11 ("How much does it really cost to
own a car in Boston?"), f18 ("I circle for 30 minutes to find parking at
night, is it time to give up my car?") and c16 ("Should I sell my car before
moving to Boston?"). On 2026-10-16 the answers cited CBS, Reddit, realtors and
car services; GSI had no page.

**What our data challenged:** the question assumes "once a week". People using
Shift who live in Boston, Cambridge, Somerville or Brookline drive more than
that: about two days a week, and a quarter of their drives are under 2 miles.
The page uses that instead of the assumption.

**Our data:** `seo/data/answer-evidence/keeping-a-car-in-boston.md`.

## Ship checklist

1. Add to `src/lib/facts/prices.json` under `driving` (sources read 2026-10-16):
   `"aaaAnnualOwnership": 12863` (AAA Your Driving Costs 2026),
   `"aaaFixedAnnual": 7704` (AAA 2026 depreciation 4,422 + insurance 2,098 +
   finance 1,184), `"maExcisePerThousand": 25`, `"maRegistrationTwoYears": 60`, `"maInspection": 35`,
   `"cambridgePermitNow": 25`, `"cambridgePermitDecember": 75`,
   `"zipcarStandardMonthly": 9`. The monthly garage rate comes from
   `parking.bostonCommonMonthly` in the parking-costs draft.
2. `scripts/build-micro-guides-migration.mjs` `formatPrice` prints thousands
   without a comma ($12863). Done in the same commit as these drafts:
   it now formats with `toLocaleString('en-US')`.
3. Append the block below, set `status: approved`, rebuild, apply the seed.
4. Point bank questions f10, f11, f18, c16 at `/guides/keeping-a-car-in-boston`.
5. Polish pass at phone and desktop width.

---

### `mg_keeping_a_car`

```yaml
id: mg_keeping_a_car
reviewed: 2026-10-16
title: "Is it worth keeping a car in Boston?"
summary: "It depends on how often you drive and where you park it. What owning a car costs here, how often people actually use theirs, and what to use on the days you need one."
slug: keeping-a-car-in-boston
mode: multimodal
barrier: cost
status: draft
content_type: micro_guide
surfaces: [guide_library]
topics: [planning, parking, getting-started]
related: [mg_walking_vs_driving, mg_bluebikes, mg_pay_for_t]
```

It depends on how often you drive. If you use the car a few times a month, owning one in Boston usually costs far more than renting or sharing a car for those trips. If you drive most days, or your work, your kids' activities or your family live where the T doesn't reach, keeping it often makes sense.

### What does a car cost to keep here?

AAA puts the cost of owning and running a new car 15,000 miles a year at {{price:driving.aaaAnnualOwnership}} ([AAA, 2026](https://newsroom.aaa.com/wp-content/uploads/2026/09/AAA_YDC-Fact-Sheet_2026.pdf)). About {{price:driving.aaaFixedAnnual}} of that is depreciation, insurance and loan interest, which you pay whether the car moves or not. An older car that's paid off costs much less.

Massachusetts adds a few costs of its own:

- **Excise tax:** {{price:driving.maExcisePerThousand}} for every $1,000 of the car's value, set by its age. A $30,000 car in its second year owes $450 ([Mass.gov](https://www.mass.gov/info-details/a-brief-introduction-to-motor-vehicle-excise)).
- **Registration:** {{price:driving.maRegistrationTwoYears}} every two years ([RMV fees](https://www.mass.gov/info-details/massachusetts-registry-of-motor-vehicles-fees)). **Inspection:** {{price:driving.maInspection}} a year ([Mass.gov](https://www.mass.gov/info-details/vehicle-inspections)).
- **Parking:** Boston's resident permit is free, but it doesn't promise a space. Cambridge's permit is {{price:driving.cambridgePermitNow}} and goes up to {{price:driving.cambridgePermitDecember}} on December 1, 2026, free for residents facing financial hardship ([City of Cambridge](https://www.cambridgema.gov/rpp)). A monthly garage space downtown starts at about {{price:parking.bostonCommonMonthly}}.

### How often do people here actually drive?

About two days a week, among people using Shift who live in Boston, Cambridge, Somerville or Brookline. About 1 in 4 of their drives was under 2 miles. Many of those short trips are an easy walk or bike ride.

**About these numbers:** From 3,263 drives recorded by 65 people using Shift who live in those four cities, August 21 to October 16, 2026. Driving here includes rides in a taxi or ride-hail car.

The City of Boston found something similar: a privately owned car is driven about one hour a day, while each car in the city's car-share pilot was used about seven hours a day ([City of Boston](https://www.boston.gov/departments/transportation/car-share-boston)).

### How do I work out what's right for me?

1. For two weeks, write down each day you drive and where you went.
2. Mark the trips under 2 miles. Those are the easiest to walk, bike or take the T.
3. For the rest, [check how else you could make the trip](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner): the T, a Bluebike, a car share, or a ride with someone.

If only a few trips a month really need a car, sharing or renting will cost much less than keeping one. If most of them do, keeping the car makes sense.

### What do I use on the days I need a car?

Car-share services rent cars by the hour from lots across the city, with gas and insurance included. Zipcar's standard plan is {{price:driving.zipcarStandardMonthly}} a month plus the hourly or daily rate. A regular rental works for weekends away. Ride-hail fills the gaps. If you have kids under 8, bring a car seat: state law requires one in an Uber or Lyft unless the child is over 57 inches tall.

### How do I sell a car in Massachusetts?

Cancel the registration online with your MyMassGov account, which is free, and send the receipt to your insurer. You don't return the plates: cut them in half and recycle them where your town accepts them, or throw them away. Once the car is sold, ask your town's assessor for an excise refund for the months you no longer owned it ([Mass.gov](https://www.mass.gov/how-to/cancel-your-vehicle-registration-license-plates)).

### Try this first

1. Pick one short trip you usually drive, like groceries or the gym, and [see how long it takes by T or by bike](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner).
2. Make that trip without the car for the next two weeks, and see how often you miss it.
