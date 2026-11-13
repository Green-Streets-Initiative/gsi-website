'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Flag, Hourglass, Mail, MapPin, Navigation, Smartphone } from 'lucide-react'
import FindEachOther from '@/components/together/FindEachOther'
import PinMap from '@/components/together/PinMap'
import { Avatar } from '@/components/together/bits'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import { SITE_LOCALE_TAG, translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { planStrings, type PlanKey } from '@/lib/site-strings/together-plan'
import { togetherStrings } from '@/lib/site-strings/together'
import { myMatches, track, type Match } from '@/lib/together'
import { useTogether } from '@/components/together/TogetherShell'
import { GuidePlan, LearnerShare } from './Steps'
import {
  UUID, answerRideTime, appPlanLink, confirmRidePlan, getRidePlan, hasOpenProposal, planDirectionsUrl, plannedTimePassed, proposeRideTime,
  type Result, type RidePlan, type RidePlanView, type TripWay,
} from '@/lib/together-plan'

/**
 * gogreenstreets.org/together/plan/<match>: a Shift Together first trip plan
 * on the web (parity gap-together-web-carpool-scope), where the plan notice
 * emails land. The app's ride-plan screen, read with its own RPC
 * (get_ride_plan): who you're going with, when and where you meet, the route,
 * and the one thing to do next. The newcomer says where to start, the guide
 * plans the route (Steps.tsx), the newcomer says the time works, and either
 * of them answers or asks for a new time. The app stays a second way in.
 * Laid out like /together/matches. In the page's language; page.tsx resolves it.
 */

type Stage = 'share' | 'wait_guide' | 'wait_learner' | 'guide_turn' | 'passed' | 'decide' | 'ready' | 'after' | 'ridden'

const PRIMARY = 'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)'
const SECONDARY = 'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold'
const LINK = 'min-h-[44px] justify-self-start text-left text-[15px] font-semibold text-(--ev-accent) underline underline-offset-2'

function stageOf(view: RidePlanView, now: number): Stage {
  const p = view.plan
  const learner = view.role === 'learner'
  if (!p) return learner ? 'share' : 'wait_learner'
  if (p.status === 'learner_shared') return learner ? 'wait_guide' : 'guide_turn'
  if (p.status === 'ridden') return 'ridden'
  if (plannedTimePassed(p, now) && !hasOpenProposal(p, now)) return 'passed'
  if (p.status === 'planned') return learner ? 'decide' : 'ready'
  const past = !!p.ride_at && now > new Date(p.ride_at).getTime() + 30 * 60_000
  return past && !hasOpenProposal(p, now) ? 'after' : 'ready'
}

const TITLE_PLANNED: Record<TripWay, PlanKey> = { bike: 'plan.title_planned_bike', walk: 'plan.title_planned_walk', transit: 'plan.title_planned_transit' }
const TITLE: Record<TripWay, PlanKey> = { bike: 'plan.title_bike', walk: 'plan.title_walk', transit: 'plan.title_transit' }

function failKey(r: Result): PlanKey {
  if (r.reason === 'time_passed') return 'plan.time_passed'
  if (r.reason === 'needs_time') return 'plan.move_too_soon'
  return 'plan.failed'
}

export default function Plan({ matchId, locale }: { matchId: string; locale: SiteLocale }) {
  const t = translator(planStrings, locale)
  const { userId } = useTogether()
  const dismiss = translator(togetherStrings, locale)('dismiss')
  const [view, setView] = useState<RidePlanView | null | undefined>(undefined)
  const [match, setMatch] = useState<Match | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!UUID.test(matchId)) return [null, null] as const
    return Promise.all([getRidePlan(matchId), myMatches().then((ms) => ms.find((m) => m.id === matchId) ?? null).catch(() => null)])
  }, [matchId])
  const load = useCallback(async () => {
    try {
      const [v, m] = await fetchAll()
      setView(v)
      if (m) setMatch(m)
      setNow(Date.now())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [fetchAll])
  useEffect(() => {
    let live = true
    fetchAll()
      .then(([v, m]) => {
        if (!live) return
        setView(v)
        setMatch(m)
        track('together_plan_viewed', { role: v?.role ?? null, status: v?.plan?.status ?? null })
      })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [fetchAll])

  async function act(run: () => Promise<Result>, event: `together_${string}`, done: string, props: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(true)
    setProblem(null)
    const r = await run()
    setBusy(false)
    if (!r.ok) {
      setProblem(t(failKey(r)))
      if (r.reason === 'time_passed') await load()
      return false
    }
    track(event, { role: view?.role ?? null, ...props })
    setNotice(done)
    await load()
    return true
  }

  if (failed && view === undefined) {
    return (
      <Notice tone="off">
        {t('plan.load_failed')}{' '}
        <button type="button" className="font-semibold underline" onClick={() => { setFailed(false); void load() }}>{t('plan.try_again')}</button>
      </Notice>
    )
  }
  if (view === undefined) return <Spinner label={t('plan.opening')} />
  if (!view) {
    return (
      <Card className="mx-auto max-w-lg">
        <h1 className="font-display text-[24px] font-extrabold">{t('plan.ended')}</h1>
        <Link href={withLang('/together/matches', locale)} className={cx(PRIMARY, 'mt-4')}>{t('plan.see_matches')}</Link>
      </Card>
    )
  }

  const p = view.plan
  const learner = view.role === 'learner'
  const name = (learner ? view.guide_name : view.learner_name) || match?.other.first_name || '?'
  const way: TripWay = p?.way ?? 'bike'
  const stage = stageOf(view, now)
  const pending = !!p && hasOpenProposal(p, now)
  const rideAt = p?.ride_at ? new Date(p.ride_at) : null
  // A planned time that passed while a new one waits on an answer isn't the plan any more.
  const shownAt = pending && rideAt && rideAt.getTime() < now ? null : rideAt
  const email = match?.other.email ?? null
  const title =
    stage === 'share' ? t('plan.share_title', { name })
    : stage === 'wait_guide' ? t('plan.waiting_guide', { name })
    : stage === 'wait_learner' ? t('plan.waiting_learner', { name })
    : stage === 'guide_turn' ? t(way === 'bike' ? 'share.guide_title' : way === 'walk' ? 'share.guide_title_walk' : 'share.guide_title_transit', { name })
    : stage === 'after' ? t('plan.after_title')
    : stage === 'decide' ? t(TITLE_PLANNED[way], { name })
    : t(TITLE[way], { name })
  const status =
    stage === 'ridden' ? t('plan.ridden')
    : !p || pending || (stage !== 'ready' && stage !== 'decide') ? null
    : learner ? (p.status === 'confirmed' ? t('plan.you_confirmed') : null)
    : t(p.status === 'confirmed' ? 'plan.status_confirmed' : 'plan.status_waiting', { name })
  const confirmed = p?.status === 'confirmed' || p?.status === 'ridden'
  const canMove = !!p && (p.status === 'planned' || p.status === 'confirmed') && !pending
  const hasPlace = !!p && p.meet_lat != null && p.meet_lng != null && p.end_lat != null && p.end_lng != null
  const showPlan = hasPlace && (stage === 'decide' || stage === 'ready' || stage === 'passed' || stage === 'after' || stage === 'ridden')

  const emailLink = email ? (
    <a
      href={`mailto:${email}?subject=${encodeURIComponent(t('plan.subject'))}`}
      onClick={() => track('together_email_tapped', { kind: 'guide', source: 'plan' })}
      className={SECONDARY}
    >
      <Mail className="h-4 w-4" aria-hidden /> {t('plan.email', { name })}
    </a>
  ) : null
  // A second way in: the same turn in the Shift app.
  const appLink = (
    <a href={appPlanLink(matchId)} onClick={() => track('together_plan_app_tapped', { stage })} className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-(--ev-ink-80) underline underline-offset-2">
      <Smartphone className="h-4 w-4" aria-hidden /> {t('plan.open_app')}
    </a>
  )
  const onFail = (r: Result) => setProblem(t(failKey(r)))

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href={withLang('/together/matches', locale)} className="inline-flex min-h-[44px] w-fit items-center gap-2 text-[15px] font-semibold text-(--ev-ink-80)">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('plan.back')}
      </Link>
      <div className="flex items-center gap-4">
        <Avatar name={name} url={match?.other.avatar_url ?? null} size={64} />
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(26px,4vw,36px)] font-extrabold leading-tight text-balance">{title}</h1>
          <p className="mt-1 text-[15px] text-(--ev-ink-80)">{learner ? t('plan.your_guide') : t('plan.your_newcomer')}</p>
        </div>
      </div>
      {notice ? <Notice tone="good" onClose={() => setNotice(null)} dismissLabel={dismiss}>{notice}</Notice> : null}
      {problem ? <Notice tone="off" onClose={() => setProblem(null)} dismissLabel={dismiss}>{problem}</Notice> : null}

      <Card className="grid grid-cols-1 gap-4">
        {status ? (
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            {confirmed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /> : <Hourglass className="h-5 w-5 shrink-0 text-(--ev-ink-80)" aria-hidden />}
            {status}
          </p>
        ) : null}

        {/* A new time one of them asked for: the other answers here. */}
        {p && pending && p.proposed_at ? (
          p.proposed_by === view.role ? (
            <p className="flex items-center gap-2 text-[16px] font-semibold">
              <Hourglass className="h-5 w-5 shrink-0 text-(--ev-ink-80)" aria-hidden />
              {t('plan.proposal_waiting', { name, when: when(p.proposed_at, locale) })}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-(--ev-panel) p-4">
              <p className="text-[17px] font-bold">{t('plan.proposal_theirs', { name, when: when(p.proposed_at, locale) })}</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" busy={busy} onClick={() => void act(() => answerRideTime(matchId, true), 'together_plan_time_answered', t('plan.answered_yes'), { yes: true })}>{t('plan.works')}</Button>
                <Button disabled={busy} onClick={() => void act(() => answerRideTime(matchId, false), 'together_plan_time_answered', t('plan.answered_no', { name }), { yes: false })}>{t('plan.proposal_no')}</Button>
              </div>
            </div>
          )
        ) : null}

        {showPlan && p ? <WhenWhere plan={p} at={shownAt} way={way} locale={locale} t={t} /> : null}

        {stage === 'share' ? (
          <LearnerShare
            view={view}
            matchId={matchId}
            userId={userId}
            name={name}
            t={t}
            onProblem={onFail}
            onShared={() => { setNotice(t('step.shared_done', { name })); void load() }}
          />
        ) : stage === 'guide_turn' && p && hasPlace ? (
          <GuidePlan
            plan={p}
            match={match}
            matchId={matchId}
            name={name}
            locale={locale}
            t={t}
            onProblem={onFail}
            onSent={() => { setNotice(t('step.plan_sent', { name })); void load() }}
          />
        ) : stage === 'wait_guide' ? (
          <p className="text-[16px] text-(--ev-ink-85)">{t('plan.waiting_guide_sub')}</p>
        ) : stage === 'wait_learner' ? (
          <p className="text-[16px] text-(--ev-ink-85)">{t('plan.waiting_learner_sub', { name })}</p>
        ) : stage === 'passed' ? (
          <p className="text-[16px] font-semibold">{t('plan.time_passed')}</p>
        ) : stage === 'after' ? (
          learner ? (
            <>
              <p className="text-[16px] text-(--ev-ink-85)">{t('plan.after_learner')}</p>
              <Link href={withLang('/together/matches', locale)} className={cx(PRIMARY, 'w-fit')}>{t('plan.after_open')}</Link>
            </>
          ) : (
            <p className="text-[16px] text-(--ev-ink-85)">{t('plan.after_guide', { name })}</p>
          )
        ) : null}

        {/* The one decision: the newcomer says the time works. */}
        {stage === 'decide' && !pending && !moveOpen ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" busy={busy} onClick={() => void act(() => confirmRidePlan(matchId), 'together_plan_confirmed', t('plan.confirmed', { name }))}>{t('plan.works')}</Button>
            <button type="button" className={LINK} onClick={() => setMoveOpen(true)}>{t('plan.ask_time', { name })}</button>
          </div>
        ) : null}
        {stage === 'passed' && !moveOpen ? (
          <div><Button variant="primary" onClick={() => setMoveOpen(true)}>{t('plan.move_title')}</Button></div>
        ) : null}
        {canMove && !moveOpen && (stage === 'ready' || stage === 'after') ? (
          <button type="button" className={LINK} onClick={() => setMoveOpen(true)}>
            {stage === 'after' ? t('plan.didnt_go') : t('plan.cant_make_it')}
          </button>
        ) : null}
        {moveOpen && (canMove || stage === 'passed') ? (
          <MoveTime
            name={name}
            start={rideAt}
            busy={busy}
            t={t}
            onCancel={() => setMoveOpen(false)}
            onSend={async (at) => {
              if (await act(() => proposeRideTime(matchId, at), 'together_plan_time_proposed', t('plan.move_sent', { name }), { stage })) setMoveOpen(false)
            }}
            onTooSoon={() => setProblem(t('plan.move_too_soon'))}
          />
        ) : null}

        {emailLink || stage === 'share' || stage === 'guide_turn' ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-(--ev-line) pt-4">
            {emailLink}
            {stage === 'share' || stage === 'guide_turn' ? appLink : null}
          </div>
        ) : null}
      </Card>

      {/* On the day: share where you are with each other around the start (01627). Shows only that day. */}
      {p && p.status === 'confirmed' && !pending ? (
        <FindEachOther matchId={matchId} name={name} way={way === 'walk' || way === 'transit' ? way : 'bike'} locale={locale} />
      ) : null}
      {showPlan && p ? <RouteCard plan={p} way={way} locale={locale} t={t} /> : null}

      <Link href={withLang('/together/matches', locale)} className="min-h-[44px] justify-self-start text-[15px] font-semibold text-(--ev-ink-80) underline">
        {t('plan.something_wrong')}
      </Link>
    </div>
  )
}

/** "Wednesday, Nov 18, 8:00 AM" in the page's language. */
function when(iso: string | Date, locale: SiteLocale): string {
  return new Date(iso).toLocaleString(SITE_LOCALE_TAG[locale], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** When and where: the two things they need to show up. */
function WhenWhere({ plan, at, way, locale, t }: { plan: RidePlan; at: Date | null; way: TripWay; locale: SiteLocale; t: T<PlanKey> }) {
  const end = plan.end_label ?? ''
  const transitMin = way === 'transit' ? plan.route?.transit?.minutes ?? plan.route?.minutes : null
  const miles = plan.route?.distanceMiles
  return (
    <div className="grid grid-cols-1 gap-2 text-[16px]">
      {at ? (
        <p className="flex items-center gap-2 text-[19px] font-bold">
          <CalendarDays className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /> {when(at, locale)}
        </p>
      ) : null}
      <p className="flex items-center gap-2">
        <MapPin className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /> {t('plan.meet_at', { place: plan.meet_label ?? '' })}
      </p>
      <p className="flex items-center gap-2">
        <Flag className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
        {transitMin ? t('plan.minutes_to', { minutes: transitMin, place: end })
          : miles ? t('plan.miles_to', { miles: Math.round(miles * 10) / 10, place: end })
          : end}
      </p>
    </div>
  )
}

/** The route on a map (or the trip's lines for transit), and the route in Google Maps. */
function RouteCard({ plan, way, locale, t }: { plan: RidePlan; way: TripWay; locale: SiteLocale; t: T<PlanKey> }) {
  const meet = { lat: plan.meet_lat!, lng: plan.meet_lng! }
  const end = { lat: plan.end_lat!, lng: plan.end_lng! }
  const line = plan.route?.waypoints && plan.route.waypoints.length > 1 ? plan.route.waypoints : undefined
  const legs = way === 'transit' ? plan.route?.transit?.legs ?? [] : []
  return (
    <Card className="grid grid-cols-1 gap-4">
      <PinMap
        pins={[
          { ...meet, kind: 'match', label: plan.meet_label ?? undefined },
          { ...end, kind: 'home', label: plan.end_label ?? undefined },
        ]}
        line={line}
        maxZoom={16}
        title={t('plan.map_title', { from: plan.meet_label ?? '', to: plan.end_label ?? '' })}
      />
      {legs.length ? (
        <div className="grid grid-cols-1 gap-2">
          <h2 className="text-[17px] font-bold">{t('plan.transit_title')}</h2>
          <ol className="grid grid-cols-1 gap-2">
            {legs.map((l, i) => l.kind === 'transit' && l.board && l.alight ? (
              <li key={i} className="flex flex-wrap items-center gap-2 text-[15px]">
                <span
                  className="inline-flex min-w-[36px] justify-center rounded-md px-2 py-0.5 text-[14px] font-bold"
                  style={{ background: l.color ?? '#191A2E', color: l.textColor ?? '#ffffff' }}
                >
                  {l.short ?? l.line ?? ''}
                </span>
                <span className="min-w-0 flex-1">
                  {t('plan.transit_leg', { line: l.line ?? l.short ?? '', from: l.board.name, to: l.alight.name })}
                  {l.departAt ? ` · ${new Date(l.departAt).toLocaleTimeString(SITE_LOCALE_TAG[locale], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  {l.stops ? ` · ${t('plan.transit_stops', { n: l.stops })}` : ''}
                </span>
              </li>
            ) : l.kind === 'walk' && l.minutes >= 1 ? (
              <li key={i} className="text-[15px] text-(--ev-ink-80)">{t('plan.transit_walk', { n: Math.round(l.minutes) })}</li>
            ) : null)}
          </ol>
        </div>
      ) : null}
      <a
        href={planDirectionsUrl(meet, end, way, plan.route?.waypoints)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('together_plan_route_opened', { way })}
        className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold"
      >
        <Navigation className="h-4 w-4" aria-hidden /> {t(way === 'transit' ? 'plan.open_trip' : 'plan.open_route')}
      </a>
    </Card>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Pick a new day and time; the other person gets a notice and answers. */
function MoveTime({ name, start, busy, t, onCancel, onSend, onTooSoon }: {
  name: string
  start: Date | null
  busy: boolean
  t: T<PlanKey>
  onCancel: () => void
  onSend: (at: Date) => void
  onTooSoon: () => void
}) {
  const [day, setDay] = useState('')
  const [time, setTime] = useState(start ? `${pad(start.getHours())}:${pad(Math.floor(start.getMinutes() / 15) * 15)}` : '08:00')
  const [today] = useState(() => new Date())
  const last = new Date(today.getTime() + 59 * 24 * 3600_000)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!day || !time) return
    const [y, m, d] = day.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    const at = new Date(y, m - 1, d, hh, mm)
    if (at.getTime() < Date.now() + 30 * 60_000) return onTooSoon()
    onSend(at)
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
      <h2 className="text-[17px] font-bold">{t('plan.move_title')}</h2>
      <p className="text-[15px] text-(--ev-ink-80)">{t('plan.move_hint', { name })}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('plan.move_day')} htmlFor="plan-day">
          <Input id="plan-day" type="date" required min={ymd(today)} max={ymd(last)} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label={t('plan.move_time')} htmlFor="plan-time">
          <Input id="plan-time" type="time" required step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" busy={busy} disabled={!day || !time}>{t('plan.move_send', { name })}</Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>{t('plan.cancel')}</Button>
      </div>
    </form>
  )
}
