import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  brandLabel,
  EntryTypePill,
  type EligibilityCriteria,
  type Prize,
  type PrizeEntryType,
  type PrizeTier,
} from '../_lib/prizes'

// Live-data page (per-prize eligibility from competition_prizes).
export const dynamic = 'force-dynamic'

// Gate the rules page behind an env flag until the legal sections are
// populated. While unpublished:
//  - Direct visits 404 (notFound below).
//  - Search engines are told not to index (metadata.robots).
//  - The "official rules" link in HowToJoin (page.tsx) falls back to plain
//    text so we don't ship a link that 404s.
// Flip NEXT_PUBLIC_RULES_PUBLISHED=true once the [TBD] blocks are filled.
const RULES_PUBLISHED = process.env.NEXT_PUBLIC_RULES_PUBLISHED === 'true'

export const metadata: Metadata = {
  title: 'Shift Your Summer · Official Rules | Green Streets Initiative',
  description:
    'Official rules and per-prize eligibility for the Shift Your Summer commuter challenge.',
  robots: RULES_PUBLISHED ? undefined : { index: false, follow: false },
}

// Bumped manually whenever rules copy changes. Surfaced at the top of the page.
const LAST_UPDATED = 'May 2026'

export default async function ShiftYourSummerRulesPage() {
  if (!RULES_PUBLISHED) notFound()

  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()

  // Find the most relevant Shift Your Summer competition (active or upcoming).
  const { data: competitionRow } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Shift Your Summer%')
    .gte('ends_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .single()

  let prizes: Prize[] = []
  if (competitionRow) {
    const { data } = await supabase
      .from('competition_prizes')
      .select(
        'id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url)), competition_prize_units(id)',
      )
      .eq('competition_id', competitionRow.id)
      .eq('prize_type', 'individual')
      .order('display_order', { ascending: true })
    prizes = (data ?? []).map((row: any) => {
      // Same array-flattening as page.tsx — Supabase wraps single FK joins in arrays.
      const funderRaw = row.funder
      const funder = Array.isArray(funderRaw) ? (funderRaw[0] ?? null) : (funderRaw ?? null)
      const sponsorRaw = funder?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? (sponsorRaw[0] ?? null) : (sponsorRaw ?? null)
      return {
        id: row.id,
        place: row.place,
        prize_type: row.prize_type,
        description: row.description,
        value_amount: row.value_amount,
        funded_by_sponsorship_id: row.funded_by_sponsorship_id ?? null,
        tier: (row.tier ?? 'standard') as PrizeTier,
        display_order: row.display_order ?? 0,
        brand_name_override: row.brand_name_override ?? null,
        image_url: row.image_url ?? null,
        product_url: row.product_url ?? null,
        quantity: Array.isArray(row.competition_prize_units)
          ? row.competition_prize_units.length
          : 0,
        entry_type: (row.entry_type ?? 'achievement_gated') as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  }

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]">
        {/* Header */}
        <section className="px-8 pb-10 pt-20 md:pt-24">
          <div className="mx-auto max-w-[820px]">
            <Link
              href="/events/shift-your-summer"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
            >
              <span aria-hidden>←</span> Back to Shift Your Summer
            </Link>
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.18em] text-[#BAF14D]">
              Official Rules
            </p>
            <h1 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Shift Your Summer
            </h1>
            <p className="text-sm text-white/75">Last updated: {LAST_UPDATED}</p>
          </div>
        </section>

        {/* How prizes are awarded */}
        <section className="px-8 py-10">
          <div className="mx-auto max-w-[820px]">
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white">
              How prizes are awarded
            </h2>
            <p className="mb-5 text-[1.0625rem] leading-[1.7] text-white/85">
              Shift Your Summer prizes are awarded through prize drawings, not
              by leaderboard placement. Each prize uses one of three entry
              mechanics, and eligibility for any individual prize depends on
              that prize&apos;s rules. Your standing on the public leaderboard
              does not, on its own, determine who wins.
            </p>
            <ul className="space-y-4 text-[0.9375rem] leading-[1.65] text-white/85">
              <li>
                <span className="font-semibold text-white">
                  Weighted entries (1 entry per active trip).
                </span>{' '}
                Every active trip you log during the challenge window earns
                you one entry into the drawing for that prize. More trips =
                more chances to win.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Achievement-gated.
                </span>{' '}
                You must complete a specific achievement during the challenge
                window (for example, earn a particular streak badge or hit a
                trip threshold) to be entered into the drawing. The exact
                requirement is shown on each prize below.
              </li>
              <li>
                <span className="font-semibold text-white">
                  Celebration event.
                </span>{' '}
                Awarded at an in-person event tied to the challenge.
                Attendance and any additional eligibility requirements are
                noted on the prize.
              </li>
            </ul>
          </div>
        </section>

        {/* Per-prize eligibility */}
        <section className="px-8 py-10">
          <div className="mx-auto max-w-[820px]">
            <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white">
              Per-prize eligibility
            </h2>
            <p className="mb-6 text-[0.9375rem] leading-[1.65] text-white/80">
              Each prize listed below shows its entry mechanic. Prizes pull
              live from the current Shift Your Summer competition.
            </p>
            {prizes.length === 0 ? (
              <p className="text-sm text-white/75">
                Prize details for the next Shift Your Summer challenge will
                appear here as soon as they&apos;re posted.
              </p>
            ) : (
              <ul className="space-y-3">
                {prizes.map(p => {
                  const brand = brandLabel(p)
                  return (
                    <li
                      key={p.id}
                      className="rounded-[12px] border border-white/[0.08] bg-white/[0.04] p-5"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-base font-bold text-white">
                            {p.description}
                          </h3>
                          {brand && (
                            <p className="mt-0.5 text-xs text-white/75">
                              Sponsored by {brand}
                            </p>
                          )}
                        </div>
                        <EntryTypePill prize={p} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Eligibility — TBD callout */}
        <TbdSection
          title="Eligibility (general)"
          body="Age, geographic, employment, and other general eligibility rules — for example: open to legal residents of Massachusetts age 18 or older; void where prohibited; employees of the sponsoring entity and their immediate families excluded; etc."
        />

        {/* How to enter — TBD callout */}
        <TbdSection
          title="How to enter"
          body="Free method of entry / no-purchase-necessary alternate entry path, if applicable to your sweepstakes structure."
        />

        {/* Sponsor / operator — TBD callout */}
        <TbdSection
          title="Sponsor / Operator"
          body="Legal name of the sponsoring entity (e.g. Green Streets Initiative, Inc.), mailing address, and any co-sponsors of record."
        />

        {/* Drawing odds, substitution, dispute resolution — TBD callout */}
        <TbdSection
          title="Drawing odds, prize substitution, dispute resolution, governing law"
          body="Estimated odds language, sponsor's right to substitute prizes of equal or greater value, dispute-resolution clause, and governing-law / venue clause."
        />

        {/* Contact — TBD callout */}
        <TbdSection
          title="Contact"
          body="Email address (and optional mailing address) for questions about these official rules."
        />

        {/* Footer disclaimer */}
        <section className="px-8 pb-20 pt-6">
          <div className="mx-auto max-w-[820px]">
            <p className="text-xs leading-[1.65] text-white/75">
              This page is part of the Shift Your Summer commuter challenge
              run by Green Streets Initiative. Prize availability, entry
              mechanics, and eligibility are subject to the final official
              rules posted before the challenge begins.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

// Visible placeholder block for sections whose legal copy hasn't been
// finalized. Renders with an amber tint so we can't accidentally publish a
// rules page with [TBD] still in it.
function TbdSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="px-8 py-6">
      <div className="mx-auto max-w-[820px]">
        <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-white">
          {title}
        </h2>
        <div className="rounded-[12px] border border-amber-400/30 bg-amber-400/10 p-5">
          <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
            [ TBD — fill before publishing ]
          </p>
          <p className="text-[0.9375rem] leading-[1.65] text-amber-100/90">
            {body}
          </p>
        </div>
      </div>
    </section>
  )
}
