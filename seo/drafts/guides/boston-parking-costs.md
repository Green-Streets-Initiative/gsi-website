# DRAFT — answer page (first five, for Keith's review 2026-10-16)

Not live. Follows `seo/answer-pages.md`.

**Why this page:** answers question-bank f08 ("How much does it cost to park in
downtown Boston for work?"), f09 ("Is there a park-and-ride that's cheaper than
parking in downtown Boston?") and f20 ("Is a student parking pass worth it at a
Boston college?"). On 2026-10-16 the answers cited garages, SpotAngels, Reddit
and Boston College; GSI had no page. Campus parking searches (Simmons, BU)
already reach our semester pages.

**Flag for Keith (separate from this page):** `driving.parkingDailyBoston` in
`prices.json` is $18, and the live guide "How far is a 10-minute drive on
foot?" uses it ("a day in a Boston garage runs about $18"). Posted all-day
drive-up rates downtown are $30 to $47. Proposal: rename it to a citywide
figure with a source, or raise it, in a separate commit.

**Our data:** `seo/data/answer-evidence/boston-parking-costs.md`.

## Ship checklist

1. Add a `parking` section to `src/lib/facts/prices.json` (operators' and
   agencies' own pages, read 2026-10-16):
   `bostonCommonDay: 30` (3–10 hrs weekday), `bostonCommonMonthly: 395`
   (weekday), `poSquareDay: 42`, `prudentialDay: 47` (massconvention.com, posquare.com,
   prudentialcenter.com); `mbtaGarageDay: 9` (Alewife, Braintree, Quincy Adams,
   Oak Grove), `riversideDay: 6`, `riversideMonthly: 105`, `routeOneTwentyEightDay: 7`,
   `framinghamDay: 4`, `framinghamMonthly: 70` (mbta.com/parking);
   `meterBackBay: 3.75`, `meterStandard: 2`, `meterTicket: 40` (boston.gov);
   `irsTransitMonthly: 340` (IRS Rev. Proc. 2025-32); `maDeductionCap: 750`
   (mass.gov); `buPermitFall: 900`, `buSemesterLinkPass: 320`,
   `simmonsPermitSemester: 515`, `umbPermitSemester: 576` (school pages).
   Under `mbta`: `crZoneTwoMonthly: 232`, `crZoneFiveMonthly: 311`.
2. (Done) The keeping-a-car draft uses `parking.bostonCommonMonthly`, so the
   rate lives once. Post Office Square and Prudential monthly rates were left
   out: not posted on the operators' pages (fact-check 2026-10-16).
3. Append the block below, set `status: approved`, rebuild, apply the seed.
4. Point bank questions f08, f09, f20 at `/guides/boston-parking-costs`.
5. Polish pass at phone and desktop width.

---

### `mg_boston_parking_costs`

```yaml
id: mg_boston_parking_costs
reviewed: 2026-10-16
title: "What parking costs in Boston, and cheaper ways in"
summary: "A workday in a downtown garage costs $30 to $47. What parking at a T station costs instead, how your employer can help, and whether a campus permit is worth it."
slug: boston-parking-costs
mode: multimodal
barrier: cost
status: approved
content_type: micro_guide
surfaces: [guide_library]
topics: [parking, fares, planning, mbta-basics]
related: [mg_pay_for_t, mg_transit_time, mg_bluebikes]
```

A full workday in a downtown Boston garage costs {{price:parking.bostonCommonDay}} to {{price:parking.prudentialDay}} at posted drive-up rates, and a monthly space starts at about {{price:parking.bostonCommonMonthly}}. Parking at a T station is {{price:parking.mbtaGarageDay}} a day or less, plus your fare, and your employer may be able to pay for the T with money that isn't taxed.

### What do downtown garages charge?

Posted weekday rates, October 2026:

- **Boston Common Garage:** {{price:parking.bostonCommonDay}} for 3 to 10 hours, or {{price:parking.bostonCommonMonthly}} a month.
- **Post Office Square:** {{price:parking.poSquareDay}} for a full day.
- **Prudential Center:** {{price:parking.prudentialDay}} for 2 to 24 hours.

Street meters downtown are {{price:parking.meterStandard}} an hour ({{price:parking.meterBackBay}} in Back Bay and the Seaport), and Sundays are free ([City of Boston](https://www.boston.gov/departments/parking-clerk/how-do-parking-meters-work)). An expired meter is a {{price:parking.meterTicket}} ticket ([Boston parking fines](https://www.boston.gov/departments/parking-clerk/parking-ticket-fines-and-codes)).

### Is it cheaper to park at a T station?

Yes. The MBTA's garages and lots are paid by phone, and most cost less than an hour downtown ([MBTA parking rates](https://www.mbta.com/parking/stations-and-rates)):

- **Alewife, Braintree, Quincy Adams, Oak Grove:** {{price:parking.mbtaGarageDay}} a weekday.
- **Riverside (Green Line):** {{price:parking.riversideDay}} a weekday, or {{price:parking.riversideMonthly}} a month.
- **Route 128 station (commuter rail):** {{price:parking.routeOneTwentyEightDay}} a weekday.
- **Framingham (commuter rail):** {{price:parking.framinghamDay}} a weekday, or {{price:parking.framinghamMonthly}} a month.

Add the fare: {{price:mbta.subwaySingle}} each way on the subway, or {{price:mbta.linkPassMonthly}} a month. A monthly commuter rail pass is {{price:mbta.crZoneTwoMonthly}} from Route 128 and {{price:mbta.crZoneFiveMonthly}} from Framingham.

Of all weekday trips into downtown by people using Shift, about 1 in 9 was a drive. Of the 99 people using Shift who drove downtown on a weekday, 90 also came in by T, bike, ferry or on foot at least once. Half of those drives were shorter than 3.4 miles.

**About these numbers:** From weekday trips into downtown Boston recorded by people using Shift, June to October 2026, including 363 drives by 99 people.

### Can my employer help pay?

Employers can let you pay for the T with up to {{price:parking.irsTransitMonthly}} a month taken out before taxes, and many pay for part of the pass outright ([IRS, 2026 limits](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf)). Massachusetts also lets you deduct T fares and bike-share costs you paid yourself, up to {{price:parking.maDeductionCap}} a year, for the part above $150 ([Mass.gov](https://www.mass.gov/info-details/commuter-tax-deduction-income-exclusion-and-pre-tax-savings)).

### Is a student parking permit worth it?

For most students, a T pass costs less:

- **Boston University:** a commuter permit is {{price:parking.buPermitFall}} for the fall semester; a semester T pass is {{price:parking.buSemesterLinkPass}}.
- **Simmons:** {{price:parking.simmonsPermitSemester}} a semester for a permit.
- **UMass Boston:** {{price:parking.umbPermitSemester}} a semester for a permit.

Many schools sell the T pass at 11% off through the [MBTA Semester Pass](https://www.mbta.com/fares/college-student-semester-passes), and some pay more of it. MIT pays half for all degree students. A permit can still make sense if you commute from somewhere the T doesn't reach well, or have a job or family trips after class.

### Try this first

1. [Find the T station parking](https://www.gogreenstreets.org/guides/boston-parking-costs#station-parking) closest to where your drive starts.
2. One day next week, park there and ride in. Compare the cost and time with your usual day.
