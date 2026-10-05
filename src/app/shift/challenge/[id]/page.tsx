import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  countingSentences,
  deliverySentence,
  drawingSentence,
  eligibilitySentence,
  etDateRange,
  orderSentence,
  prizeSentence,
  topSentence,
  type ChallengeRulesInput,
  type CountingRules,
} from '@/lib/challenge-rules'

// Public rules for a workplace challenge: the link an employer shares with
// their team. Every challenge has one, whatever its reward (a first-to-the-
// goal reward, a drawing, the top of the leaderboard, or none). No sign-in;
// get_public_challenge_rules (Shift 00975, widened in 01110) returns only what
// the announcement already says. The
// sentences come from src/lib/challenge-rules.ts: the counting rules and
// first-to-the-goal rewards use the same generator as the portal and the app;
// drawing and leaderboard rewards use its web-only sentences.

export const revalidate = 300

type PublicPrize = {
  name: string
  /** Absent before Shift 01109, when only first-to-the-goal rewards came back. */
  award_mode?: 'guaranteed' | 'drawing' | 'merit'
  metric?: string | null
  drawn?: boolean
  goal: number
  spots: number
  spots_left: number
  funded: boolean
  amount_cents: number | null
  description: string | null
  requires_work_email: boolean
  closed: boolean
}
type PublicChallenge = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  employer: string
  logo_url: string | null
  invite_code: string
  contact_name: string | null
  contact_email: string | null
  rules: CountingRules
  domains: string[]
  prizes: PublicPrize[]
  /** A first-to-the-goal reward is saved but not published yet (Shift 01109). */
  rewards_pending?: boolean
}

// cache(): generateMetadata and the page both load; one request per render.
const load = cache(async function load(id: string): Promise<(PublicChallenge & { started: boolean; ended: boolean }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await sb.rpc('get_public_challenge_rules', { p_competition_id: id })
  if (error || !data) return null
  const c = data as PublicChallenge
  // Timing is decided here, at fetch time (revalidated every 5 minutes),
  // so the render itself stays pure.
  const now = Date.now()
  return {
    ...c,
    started: new Date(c.starts_at).getTime() <= now,
    ended: new Date(c.ends_at).getTime() < now,
  }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await load((await params).id)
  return {
    title: c ? `${c.name}: ${c.employer} on Shift` : 'Challenge rules: Shift',
    description: c ? `How ${c.name} works, what counts, and how to win.` : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function ChallengeRulesPage({ params }: { params: Promise<{ id: string }> }) {
  const c = await load((await params).id)
  if (!c) notFound()

  const joinUrl = `https://shift.gogreenstreets.org/join/${c.invite_code}`
  const { started, ended } = c
  const inputFor = (p: PublicPrize): ChallengeRulesInput => ({
    rules: c.rules,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    goal: p.goal,
    spots: p.spots,
    funded: p.funded,
    amountCents: p.amount_cents,
    description: p.description,
    requiresWorkEmail: p.requires_work_email,
    domains: c.domains,
    employer: c.employer,
    contactName: c.contact_name,
    contactEmail: c.contact_email,
  })
  const modeOf = (p: PublicPrize) => p.award_mode ?? 'guaranteed'
  const rewardSentence = (p: PublicPrize) =>
    modeOf(p) === 'drawing' ? drawingSentence(inputFor(p), p.metric) : modeOf(p) === 'merit' ? topSentence(inputFor(p), p.metric) : prizeSentence(inputFor(p))
  const rewardStatus = (p: PublicPrize): string => {
    if (modeOf(p) === 'guaranteed') {
      if (p.closed || ended) return 'Closed.'
      if (p.spots_left === 0) return 'All spots are taken.'
      return p.spots === 1 ? 'The spot is still open.' : `${p.spots_left} of ${p.spots} spots left.`
    }
    // drawn_at is also set when a draw found nobody eligible, so say only
    // that the draw happened.
    if (p.drawn) return modeOf(p) === 'drawing' ? 'The drawing has taken place.' : 'Winners have been announced.'
    const when = etDateRange(c.ends_at, c.ends_at)
    if (modeOf(p) === 'drawing') return ended ? 'The challenge has ended. The drawing happens shortly.' : `The drawing happens after ${when}.`
    return ended ? 'The challenge has ended. Winners are announced shortly.' : `Winners are announced after ${when}.`
  }
  // The counting rules don't depend on the reward, so any input will do.
  const first: ChallengeRulesInput = c.prizes[0]
    ? inputFor(c.prizes[0])
    : inputFor({ name: '', goal: 0, spots: 0, spots_left: 0, funded: false, amount_cents: null, description: null, requires_work_email: false, closed: false })
  const elig = c.prizes.map((p) => eligibilitySentence(inputFor(p))).find(Boolean) ?? null
  const anyGoalReward = c.prizes.some((p) => modeOf(p) === 'guaranteed')

  // Like the agreement page, the rules sit on a white sheet.
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-10">
        <div className="flex items-center gap-3">
          {c.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" />
          )}
          <p className="text-sm font-semibold text-emerald-700">
            {c.employer} · Shift
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">{c.name}</h1>
        <p className="mt-1 text-[15px] text-gray-700">
          {etDateRange(c.starts_at, c.ends_at)}
          {ended ? ' · This challenge has ended.' : started ? ' · Happening now' : ' · Starts soon'}
        </p>

        <section className="mt-8 grid gap-3">
          {c.prizes.map((p, i) => (
            <div key={`${p.name}-${i}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-[17px] font-semibold text-gray-900">{rewardSentence(p)}</p>
              <p className="mt-1 text-[14px] text-gray-700">
                {rewardStatus(p)}
              </p>
            </div>
          ))}
          {c.prizes.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              {c.rewards_pending ? (
                <>
                  <p className="text-[17px] font-semibold text-gray-900">A reward is on its way.</p>
                  <p className="mt-1 text-[14px] text-gray-700">
                    {c.employer} is setting it up. The details will show here, and in the Shift app, once it&apos;s ready.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[17px] font-semibold text-gray-900">No reward this time: it&apos;s about the team.</p>
                  <p className="mt-1 text-[14px] text-gray-700">Follow your team&apos;s standings in the Shift app.</p>
                </>
              )}
            </div>
          )}
        </section>

        {!ended && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">How to take part</h2>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
              <li>
                Download Shift and join {c.employer}:{' '}
                <a href={joinUrl} className="font-semibold text-emerald-700 underline">
                  {joinUrl.replace('https://', '')}
                </a>{' '}
                (or enter code <strong className="text-gray-900">{c.invite_code}</strong>).
              </li>
              <li>Turn on trip tracking. Shift records your walks, rides and transit trips on its own.</li>
              {elig && <li>{elig}</li>}
            </ol>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">What counts</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
            {countingSentences(first).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        {c.prizes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Winning</h2>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
              {anyGoalReward && <li>{orderSentence()}</li>}
              {[...new Set(c.prizes.map((p) => deliverySentence(inputFor(p))))].map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>You can follow your progress on the challenge in the Shift app.</li>
            </ul>
          </section>
        )}

        <p className="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-600">
          {c.contact_email ? (
            <>
              Questions about the challenge?{' '}
              {c.contact_name ? `Contact ${c.contact_name} at ` : 'Email '}
              <a href={`mailto:${c.contact_email}`} className="font-semibold text-emerald-700 underline">
                {c.contact_email}
              </a>
              .{' '}
            </>
          ) : (
            <>Questions about the challenge? Ask your organizer at {c.employer}. </>
          )}
          Questions about the Shift app: info@gogreenstreets.org. Shift is a free app from Green Streets
          Initiative, a Massachusetts nonprofit.
        </p>
      </div>
    </main>
  )
}
