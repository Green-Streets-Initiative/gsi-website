# DRAFT — proposed micro-guide (SEO item 3, report 2026-09-08)

Not live. The public site only renders Supabase rows with `status='approved'`;
this file renders nothing.

**Why this guide.** Someone is pricing a used cargo e-bike and landing on us.
Variants of `"tern gsd" used "$3000"` took **34 Search Console impressions at
position ~9 in the 28 days to 2026-09-04**, recurring across two consecutive
pulls, and `/guides/what-you-can-do-with-an-e-cargo-bike` took 102 impressions
over the same window. That guide answers what a cargo bike *does*. Nothing of
ours answers what one *costs* — which is the question the money-and-time wedge
in `seo/strategy.md` exists to answer, and the first organic sign of life from
the `used-car-to-ebike` cluster since the routine began.

**On staleness.** Bike prices are not in `src/lib/facts/prices.json` and there
is no freshness cron for them, so this guide deliberately uses **ranges and the
things that drive the price** rather than model-by-model figures. The one place
it would have dated fastest — the Massachusetts voucher program — is handled as
a pointer, not a promise: the statewide MassCEC voucher ran April–September 2025
and is closed as of this writing, so the guide sends people to check what is
open now instead of naming an amount. Verified 2026-09-08.

**Messaging self-check** (`seo/strategy.md`): no comparison against cars or
driving anywhere in the body; leads with what the bike gives; says "active
transportation" nowhere near "sustainable"; no sentence defines the bike by what
it is not. The query that brought people here contains a car-shaped intent, and
the guide answers it without echoing that framing.

## Ship checklist

1. Append the YAML+body block below to `content/micro-guides-library.md`.
2. **Change `status: draft` to `status: approved`** (it is `draft` on purpose here).
3. Bump the guide-count check in `scripts/build-micro-guides-migration.mjs`
   from `!== 21` to `!== 22`.
4. `node scripts/build-micro-guides-migration.mjs`
5. Commit both files by filename, push, apply the generated migration.
6. After the migration lands, check the `/guides` index, `sitemap.xml` and
   `llms.txt` — not just `/guides/<slug>`, which 200s well before the index
   catches up.

---

### `mg_cargo_bike_cost`

```yaml
id: mg_cargo_bike_cost
title: "What a cargo e-bike costs — new, used, and what drives the price"
summary: "Cargo e-bikes run from around $2,000 to well past $8,000 new, and a well-kept used one often lands near $3,000. Here's what you're paying for, what to check before you buy secondhand, and where to try one first."
slug: what-a-cargo-ebike-costs
mode: biking
barrier: cost
status: draft
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [cost, gear, family, planning]
related: [mg_cargo_bike, mg_bike_commute_gear, mg_bike_lock]
```

A cargo e-bike is the one bike that can replace a whole category of trips — the school run, a full grocery shop, a kid and their scooter and a library bag. Here's what one costs and what your money is actually buying.

### New cargo e-bikes start around $2,000 and climb past $8,000.

The spread is wide because "cargo e-bike" covers a lot of ground. Around $2,000 to $3,000 you're looking at direct-to-consumer longtails — a rear rack long enough for two small kids or a big load, a hub motor, and a battery that will comfortably cover a day of errands.

From about $4,000 to $6,000 you move into mid-drive motors, better brakes, and frames built to carry more weight with more composure. Above that sit the front-loader box bikes and the premium longtails, where you're paying for load capacity, ride quality, and parts that shrug off daily year-round use.

Accessories are a real line item and worth planning for. Seats, running boards, a rain canopy, panniers, and a good lock can add $300 to $900 on top, depending on how many people and how much stuff you're carrying.

### A used one often lands around $3,000.

That figure comes up again and again for well-kept longtails from the established brands. It's a genuinely good place to shop: cargo bikes are bought by people who intend to use them hard, and a lot of them get sold on in good condition when a family's needs change.

What to look at before you buy secondhand:

**The battery, first and most.** It's the single most expensive part to replace. Ask how old it is, roughly how many charge cycles it's seen, and whether it still holds close to its original range. A battery that's four or five years old is not a dealbreaker, but it should be reflected in the price, and you'll want to know what a replacement costs for that model.

**Whether the brand still supports the model.** Parts availability is what separates a bargain from a project. Established cargo brands with a dealer network in the area are the safer buy, because a shop can get you a controller, a display, or a proprietary rack part without a scavenger hunt.

**Brakes and tires.** Both are wear items and both matter more on a loaded bike than an unloaded one. Budget for a fresh set of pads and possibly tires — it's a modest cost that's easy to fold into your offer.

**The frame and the welds, especially around the rack and the kickstand.** These bikes carry real weight. Look for cracks or repairs at the joints, and put the bike on its centerstand to check that it's solid and not bent.

**A test ride with weight on it.** An empty cargo bike rides like any bike. Load it up — even with a couple of bags of something heavy — and you'll learn more in five minutes than in any spec sheet.

### What actually drives the price

**Motor placement.** Mid-drive motors sit at the cranks and use the bike's gears, which makes them stronger on hills and easier on the drivetrain under load. Hub motors are simpler and cheaper and do fine on the flatter routes.

**Battery capacity.** More watt-hours means more range, and range is the thing you notice on a hilly route with a full load. Some bikes take a second battery, which is worth knowing about if your days are long.

**Load rating.** The published maximum for rider plus cargo is one of the honest signals of how a bike is built. A higher rating usually means a stronger frame, better brakes, and a more capable rear end.

**Brakes.** Hydraulic discs are the standard on bikes meant to carry weight, and they're the upgrade that matters most for confidence on a wet Boston hill.

### Where to look around here

Local bike shops are worth the visit even if you end up buying used, because a shop that sells the brand can service it and will often know who's selling. Shops in the area increasingly keep a cargo bike or two available to demo, and an hour on one tells you more than weeks of reading.

Community bike programs and campus repair co-ops are the other good local resource — a place to get a secondhand bike checked over before you commit.

Incentives change often. The Massachusetts statewide e-bike voucher ran in 2025 and is closed as of this writing, but new rounds and utility or municipal programs come and go, so it's worth checking what's open at [MassCEC](https://goclean.masscec.com/) before you buy.

### Try one before you buy one

Riding a loaded cargo bike is the part that decides it for most people. Our [community events calendar](https://www.gogreenstreets.org/events) lists e-bike demos, group rides, and family rides across Greater Boston — the easiest way to try a few and find out which shape suits your trips.

And if you want to know what those trips would look like, the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor) gives you real biking times for your actual routes.
