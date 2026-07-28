import Link from 'next/link'
import { getQualifyingTowns } from '@/lib/towns/queries'

/**
 * Cross-link modules pointing at the town pages (paths Phase 1). Both read the
 * live directory now — each was hardcoded to the original nine towns and went
 * stale within months. utm_content identifies the entry point.
 */

/** Chips shown before "All towns" takes over. The rest of the list is a click away. */
const CHIP_LIMIT = 12

/**
 * Compact chip strip — events page. Renders inline, NOT behind Suspense: these
 * chips are internal links first and UI second, and a Suspense boundary ships
 * them inside a trailing `<div hidden>` that only lands once React's swap
 * script runs. The ~350ms the directory RPC adds to an already-dynamic page is
 * the cheaper side of that trade.
 */
export async function TownChipsStrip({ utmContent }: { utmContent: string }) {
  const towns = await topTowns()

  return (
    <section className="border-t border-white/[0.06] bg-[#191A2E] px-6 py-10">
      <div className="mx-auto max-w-[960px] text-center">
        <h2 className="mb-1 font-display text-xl font-bold tracking-tight text-white">
          See what&apos;s happening in your town
        </h2>
        <p className="mb-5 text-sm text-white/75">
          Live community stats, popular routes, and ways to get involved — town by town.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {towns.map((t) => (
            <Link
              key={t.slug}
              href={`/shift/towns/${t.slug}?utm_content=${utmContent}`}
              className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              {t.town_name}
            </Link>
          ))}
          <Link
            href={`/shift/towns?utm_content=${utmContent}`}
            className="rounded-full bg-[#BAF14D]/15 px-3.5 py-1.5 text-sm font-bold text-[#BAF14D] transition-colors hover:bg-[#BAF14D]/25"
          >
            All towns &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Biggest towns first — this is wayfinding, so the chips a visitor is most
 * likely to be looking for should be the ones that fit. Member count rather
 * than monthly trips: it's the more stable signal, and a nav element that
 * reshuffles week to week is worse than one that's slightly out of date.
 */
async function topTowns() {
  return [...(await getQualifyingTowns())]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, CHIP_LIMIT)
}

/**
 * Teaser band — /shift marketing page. Counts published town pages (the same
 * set the hub lists) so the headline can't drift out of date. Digits, not
 * words: spelled-out compounds ("Twenty-five towns") only get worse from here.
 * Falls back to a countless headline if the directory query comes back empty.
 */
export async function TownsTeaserBand() {
  const published = await getQualifyingTowns()
  const lead = published.length >= 2 ? `${published.length.toLocaleString()} towns.` : 'Your town.'

  return (
    <section className="bg-[#121320] px-8 py-14">
      <div className="mx-auto flex max-w-[960px] flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight tracking-tight text-white">
            {lead} One friendly competition.
          </h2>
          <p className="max-w-[480px] text-[15px] leading-relaxed text-white/80">
            Every trip on Shift counts toward your town&apos;s standing — see the
            live leaderboard, where your neighbors walk and ride, and what&apos;s
            happening on your streets.
          </p>
        </div>
        <Link
          href="/shift/towns?utm_content=shift_page_teaser"
          className="shrink-0 rounded-full bg-[#BAF14D] px-6 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
        >
          Is your town on the board? &rarr;
        </Link>
      </div>
    </section>
  )
}
