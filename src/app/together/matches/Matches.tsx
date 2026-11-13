'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import ExampleMatch from '@/components/together/ExampleMatch'
import { MatchCard } from '@/components/together/MatchCard'
import NextSteps from '@/components/together/NextSteps'
import NudgeCard from '@/components/together/NudgeCard'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Card, Notice, Spinner } from '@/components/organizers/ui'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { togetherStrings } from '@/lib/site-strings/together'
import { togetherMoreStrings } from '@/lib/site-strings/together-more'
import {
  answerMatch, answerWent, endMatch, isWay, myMatches, mySignUps, rateMatch, reportMatch, track,
  type Match, type PartnerRequest,
} from '@/lib/together'
import { endedMatches, walkSpots, type WalkRequest, type WalkSpot } from '@/lib/together-more'

/**
 * gogreenstreets.org/together/matches: the app's matches screen
 * (partner-matches.tsx) for the web, with the same card: a fit rating, the
 * person's face, and timing, route and experience meters before the yes;
 * their email once both say yes; "Did you go together?" a day later, then
 * how it went; and "Something wrong?" to end the match or report a problem.
 * Walk matches pick where to meet; a carpool pair sets the pickup and can
 * find each other on the day. Matches that ended stay 30 days, there to
 * report. With nothing to decide, the app's nudge says who nearby is asking.
 * Everything comes from the app's own RPCs, so a web person sees exactly
 * what the app would show. In the page's language (translation plan,
 * batch 5); page.tsx resolves it.
 */

export default function Matches({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  const tm = translator(togetherMoreStrings, locale)
  const { userId } = useTogether()
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [requests, setRequests] = useState<PartnerRequest[]>([])
  const [walkReq, setWalkReq] = useState<WalkRequest | null>(null)
  const [ended, setEnded] = useState<Match[]>([])
  const [spots, setSpots] = useState<WalkSpot[]>([])
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fetchAll = useCallback(() => Promise.all([
    myMatches(),
    mySignUps().catch(() => ({ trips: [] as PartnerRequest[], practice: null, walk: null })),
    endedMatches(),
    walkSpots(),
  ]), [])
  const apply = useCallback(([m, r, e, w]: Awaited<ReturnType<typeof fetchAll>>) => {
    setMatches(m)
    setRequests(r.trips)
    setWalkReq(r.walk)
    setEnded(e)
    setSpots(w)
  }, [])
  const load = useCallback(async () => {
    try {
      apply(await fetchAll())
    } catch {
      setFailed(true)
    }
  }, [fetchAll, apply])
  useEffect(() => {
    let live = true
    fetchAll()
      .then((all) => { if (live) apply(all) })
      .catch(() => { if (live) setFailed(true) })
    track('together_matches_viewed')
    return () => { live = false }
  }, [fetchAll, apply])

  async function run(m: Match, act: () => Promise<boolean>, event: `together_${string}`, props: Record<string, unknown> = {}, done?: string) {
    setBusy(m.id)
    setProblem(null)
    const ok = await act()
    setBusy(null)
    if (!ok) return setProblem(t('matches.failed'))
    track(event, { kind: m.kind, my_kind: m.my_kind, ...props })
    if (done) setNotice(done)
    await load()
  }

  if (failed) {
    return (
      <Notice tone="off">
        {t('matches.load_failed')}{' '}
        <button type="button" className="font-semibold underline" onClick={() => { setFailed(false); void load() }}>{t('shell.try_again')}</button>
      </Notice>
    )
  }
  if (!matches) return <Spinner label={t('matches.opening')} />

  const open = requests.find((r) => r.status === 'open' || r.status === 'matched') ?? null
  const myArrive = requests.find((r) => r.kind === 'carpool')?.arrive_by ?? null
  const deciding = matches.some((m) => m.status === 'proposed')
  const walkOpen = walkReq && (walkReq.status === 'open' || walkReq.status === 'matched')
  const card = (m: Match) => (
    <MatchCard
      key={m.id}
      m={m}
      locale={locale}
      t={t}
      busy={busy === m.id}
      myArrive={myArrive}
      userId={userId}
      walkSpot={spots.find((w) => w.match_id === m.id) ?? null}
      onWalkSpot={() => void load()}
      onAnswer={(yes) => void run(m, () => answerMatch(m.id, yes), 'together_match_answered', { yes })}
      onWent={() => void run(m, () => answerWent(m.id, true), 'together_went_answered', { went: true })}
      onRate={(r, c) => void run(m, () => rateMatch(m.id, r, c.trim() || null), 'together_match_rated', { rating: r, has_comment: !!c.trim() })}
      onEnd={() => void run(m, () => endMatch(m.id), 'together_match_ended', {}, t('matches.ended'))}
      onReport={(r, d) => void run(
        m, () => reportMatch(m.id, r, d.trim() || null), 'together_match_reported', { reason: r },
        (m.other.first_name ? t('matches.reported', { name: m.other.first_name }) : t('matches.reported_anon'))
          + (m.status !== 'dropped' && (open || walkOpen) ? ` ${tm('m.report_done_new')}` : ''),
      )}
    />
  )
  // Walking together has its own sign-up (01507): offer it beside the empty states.
  const walkLink = (
    <Card className="grid grid-cols-1 gap-2">
      <h2 className="font-display text-[20px] font-extrabold">{walkReq ? tm('walk.screen') : tm('m.walk_title')}</h2>
      <p className="text-[16px] text-(--ev-ink-85)">{walkReq ? (walkOpen ? tm('walk.done_body') : tm('walk.entry_sub')) : tm('walk.entry_sub')}</p>
      <Link href={withLang('/together/walk', locale)} className="inline-flex min-h-[44px] w-fit items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold">
        {walkReq ? tm('pk.change') : tm('walk.invite_link')}
      </Link>
    </Card>
  )

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* No sign-up yet: step 1, where the page's own button sends them */}
      <Journey at={matches.length ? 3 : open ? 2 : 1} locale={locale} />
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold">{t('matches.title')}</h1>
        {!matches.length || deciding ? (
          <p className="mt-2 text-[16px] text-(--ev-ink-85)">{t('matches.intro')}</p>
        ) : null}
      </div>
      {notice ? <Notice tone="good" onClose={() => setNotice(null)} dismissLabel={t('dismiss')}>{notice}</Notice> : null}
      {problem ? <Notice tone="off" onClose={() => setProblem(null)} dismissLabel={t('dismiss')}>{problem}</Notice> : null}
      {/* The app's Home nudge: who nearby is asking, when nothing is waiting on a yes. */}
      <NudgeCard locale={locale} skip={deciding} />

      {matches.length === 0 ? (
        open ? (
          <>
            <Card>
              <h2 className="font-display text-[22px] font-extrabold">{t('matches.empty')}</h2>
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">
                {open.kind === 'carpool' ? t('matches.empty_open_carpool') : open.kind === 'guide' ? t('matches.empty_open_guide') : t('matches.empty_open')}
              </p>
            </Card>
            <ExampleMatch side={open.kind} locale={locale} />
            <NextSteps kind={open.kind} ways={open.modes.filter(isWay)} source="matches" locale={locale} />
            {walkLink}
          </>
        ) : (
          <>
            <Card>
              <h2 className="font-display text-[22px] font-extrabold">{t('matches.empty')}</h2>
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">{t('matches.empty_none')}</p>
              <Link href={withLang('/together', locale)} className="mt-4 inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)">
                {t('matches.sign_up')}
              </Link>
            </Card>
            <ExampleMatch side="newcomer" locale={locale} />
            {walkLink}
          </>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-5">
          {matches.map(card)}
        </ul>
      )}
      {/* Ended in the last 30 days: still there to report a problem. */}
      {ended.some((e) => !matches.some((m) => m.id === e.id)) ? (
        <ul className="grid grid-cols-1 gap-5">
          {ended.filter((e) => !matches.some((m) => m.id === e.id)).map(card)}
        </ul>
      ) : null}
    </div>
  )
}
