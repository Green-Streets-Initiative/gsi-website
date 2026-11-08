import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { ChallengeRulesInput, CountingRules } from '@/lib/challenge-rules'
import { challengeRulesFor } from '@/lib/challenge-rules-i18n'
import HtmlLang from '@/components/HtmlLang'
import { translator } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { rich, workplaceStrings } from '@/lib/site-strings/challenges'

// Public rules for a workplace challenge: the link an employer shares with
// their team. Every challenge has one, whatever its reward (a first-to-the-
// goal reward, a drawing, the top of the leaderboard, or none). No sign-in;
// get_public_challenge_rules (Shift 00975, widened in 01110) returns only what
// the announcement already says. The
// sentences come from src/lib/challenge-rules.ts: the counting rules and
// first-to-the-goal rewards use the same generator as the portal and the app;
// drawing and leaderboard rewards use its web-only sentences.
//
// The app opens it with ?lang= (es, pt-BR, zh-Hans): the page and its rule
// sentences follow (challenge-rules-i18n.ts). The challenge, employer and
// prize names stay as the employer typed them.

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

type Params = Promise<{ id: string }>
type Search = Promise<{ lang?: string | string[] }>

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const c = await load((await params).id)
  const t = translator(workplaceStrings, await siteLocale((await searchParams).lang))
  return {
    title: c ? t('meta.title', { name: c.name, employer: c.employer }) : t('meta.title_none'),
    description: c ? t('meta.desc', { name: c.name }) : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function ChallengeRulesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const c = await load((await params).id)
  if (!c) notFound()
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(workplaceStrings, locale)
  const {
    countingSentences,
    deliverySentence,
    drawingSentence,
    eligibilitySentence,
    etDateRange,
    orderSentence,
    prizeSentence,
    topSentence,
  } = challengeRulesFor(locale)

  const joinUrl = `https://shift.gogreenstreets.org/join/${c.invite_code}`
  const { started, ended } = c
  const inputFor = (p: PublicPrize): ChallengeRulesInput => ({
    rules: c.rules,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    goal: p.goal,
    metric: p.metric ?? null,
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
      if (p.closed || ended) return t('status.closed')
      if (p.spots_left === 0) return t('status.all_taken')
      return p.spots === 1 ? t('status.spot_open') : t('status.spots_left', { left: p.spots_left, spots: p.spots })
    }
    // drawn_at is also set when a draw found nobody eligible, so say only
    // that the draw happened.
    if (p.drawn) return modeOf(p) === 'drawing' ? t('status.drawn_drawing') : t('status.drawn_merit')
    const when = etDateRange(c.ends_at, c.ends_at)
    if (modeOf(p) === 'drawing') return ended ? t('status.drawing_ended') : t('status.drawing_after', { date: when })
    return ended ? t('status.merit_ended') : t('status.merit_after', { date: when })
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
      <HtmlLang locale={locale} />
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
          {' · '}
          {ended ? t('header.ended') : started ? t('header.now') : t('header.soon')}
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
                  <p className="text-[17px] font-semibold text-gray-900">{t('pending.title')}</p>
                  <p className="mt-1 text-[14px] text-gray-700">{t('pending.body', { employer: c.employer })}</p>
                </>
              ) : (
                <>
                  <p className="text-[17px] font-semibold text-gray-900">{t('none.title')}</p>
                  <p className="mt-1 text-[14px] text-gray-700">{t('none.body')}</p>
                </>
              )}
            </div>
          )}
        </section>

        {!ended && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">{t('how.title')}</h2>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
              <li>
                {rich(t('how.join', { employer: c.employer }), {
                  link: (
                    <a href={joinUrl} className="font-semibold text-emerald-700 underline">
                      {joinUrl.replace('https://', '')}
                    </a>
                  ),
                  code: <strong className="text-gray-900">{c.invite_code}</strong>,
                })}
              </li>
              <li>{t('how.tracking')}</li>
              {elig && <li>{elig}</li>}
            </ol>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">{t('counts.title')}</h2>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
            {countingSentences(first).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        {c.prizes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">{t('win.title')}</h2>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px] leading-relaxed text-gray-700">
              {anyGoalReward && <li>{orderSentence()}</li>}
              {[...new Set(c.prizes.map((p) => deliverySentence(inputFor(p))))].map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>{t('win.follow')}</li>
            </ul>
          </section>
        )}

        <p className="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-600">
          {c.contact_email
            ? rich(t(c.contact_name ? 'q.named' : 'q.email', { name: c.contact_name }), {
                email: (
                  <a href={`mailto:${c.contact_email}`} className="font-semibold text-emerald-700 underline">
                    {c.contact_email}
                  </a>
                ),
              })
            : t('q.organizer', { employer: c.employer })}{' '}
          {t('q.app')}
        </p>
      </div>
    </main>
  )
}
