'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Hourglass, House, MapPin, Minus, Navigation, Plus } from 'lucide-react'
import FindEachOther from '@/components/together/FindEachOther'
import PinMap from '@/components/together/PinMap'
import { PlacePick, type Choice } from '@/app/together/plan/[matchId]/Steps'
import { Button, Spinner, cx } from '@/components/organizers/ui'
import { SITE_LOCALE_TAG, translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { planStrings } from '@/lib/site-strings/together-plan'
import { DAY_KEY, togetherStrings } from '@/lib/site-strings/together'
import { togetherMoreStrings, type TogetherMoreKey } from '@/lib/site-strings/together-more'
import { DAYS, myPlaces, track } from '@/lib/together'
import {
  answerPickup, askRiderForPickup, carpoolPlan, directionsUrl, hhmm, isoToday, proposePickup,
  type CarpoolPlanView, type PickupKind, type PickupSpot,
} from '@/lib/together-more'

/**
 * The pickup on a connected carpool (the app's CarpoolPickupCard and
 * CarpoolPickupSheet; Shift 01627/01628): where, when and which days, under
 * "who drives" on the match card.
 *
 *   no plan        Shift's suggestion as one sentence, "Send to Maya", Change.
 *                  Rider (when the server allows it): "Pick me up at home".
 *                  Driver: "Ask Maya where to pick them up".
 *   sent by me     the sentence, "Waiting for Maya to confirm", Change.
 *   sent by them   the sentence, "Works for me" / "Suggest a change".
 *   declined       "Maya would like a different pickup", Change.
 *   confirmed      the sentence leads (with the address for a confirmed home
 *                  pickup), Directions, and Find each other on a pickup day.
 *
 * The spot is a place a car can pull over (station drop-off areas, lots,
 * stations; never a bus stop). Whenever a place is on the card, both see a
 * small map with the pin; the driver also gets one line on where to pull
 * over. Only the rider can choose a home pickup, and the driver sees the
 * address only once it's confirmed: the server sends nothing before that.
 */

const DEFAULT_TIME = '08:00'
const DEFAULT_DAYS = [1, 2, 3, 4, 5]
const STEP_MIN = 5
const PULL: Record<'dropoff' | 'lot' | 'other', TogetherMoreKey> = { dropoff: 'pk.pull_dropoff', lot: 'pk.pull_lot', other: 'pk.pull_street' }
const PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)'
const LINK = 'min-h-[44px] text-[15px] font-semibold underline'

function shift(time: string, minutes: number): string {
  const [h, m] = hhmm(time).split(':').map(Number)
  const total = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + minutes))
  const r = Math.round(total / STEP_MIN) * STEP_MIN
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}

export default function PickupCard({ matchId, name: fallbackName, userId, locale }: { matchId: string; name: string; userId: string | null; locale: SiteLocale }) {
  const t = translator(togetherMoreStrings, locale)
  const tt = translator(togetherStrings, locale)
  const [view, setView] = useState<CarpoolPlanView | null | undefined>(undefined)
  const [editing, setEditing] = useState<PickupSpot | null | false>(false)
  const [busy, setBusy] = useState<'send' | 'home' | 'yes' | 'ask' | null>(null)
  const [failed, setFailed] = useState(false)
  const [asked, setAsked] = useState(false)

  const load = useCallback(async () => setView(await carpoolPlan(matchId)), [matchId])
  useEffect(() => {
    let live = true
    void carpoolPlan(matchId).then((v) => { if (live) setView(v) })
    return () => { live = false }
  }, [matchId])

  if (!view) return null

  const name = view.other_name ?? fallbackName
  const plan = view.plan
  const mine = !!plan && plan.proposed_by_me === true
  const clock = (time: string) => {
    const [h, m] = hhmm(time).split(':').map(Number)
    return new Date(2026, 0, 5, h, m).toLocaleTimeString(SITE_LOCALE_TAG[locale], { hour: 'numeric', minute: '2-digit' })
  }
  const daysText = (days: number[]) => {
    const set = [...new Set(days)].sort((a, b) => a - b)
    if (set.length === 7) return t('pk.every_day')
    if (set.length === 5 && set.every((d, i) => d === i + 1)) return t('pk.weekdays')
    return set.map((d) => tt(DAY_KEY[DAYS[d - 1].id])).join(tt('list.sep'))
  }
  const place = (s: PickupSpot) =>
    s.pickup_kind === 'rider_home' ? (view.i_ride ? t('pk.your_home') : t('pk.their_home', { name })) : s.pickup_label ?? t('pk.spot')
  const sentence = (s: PickupSpot) => {
    const line = t('pk.line', { place: place(s), time: clock(s.pickup_time), days: daysText(s.days) })
    return line.charAt(0).toLocaleUpperCase(SITE_LOCALE_TAG[locale]) + line.slice(1)
  }
  const isPlace = (s: PickupSpot) => s.pickup_kind !== 'rider_home' && s.pickup_lat != null && s.pickup_lng != null
  const spotMap = (s: PickupSpot) => isPlace(s) ? (
    <PinMap
      pins={[{ lat: s.pickup_lat!, lng: s.pickup_lng!, kind: 'spot', label: s.pickup_label ?? t('pk.spot') }]}
      title={t('pk.map_alt')}
      boxClassName="aspect-[16/9] sm:aspect-[5/2]"
      width={560}
      height={260}
      maxZoom={16}
    />
  ) : null
  const pullOver = (s: PickupSpot) => view.i_drive && isPlace(s)
    ? <p className="text-[15px] text-(--ev-ink-80)">{t(PULL[s.place_type === 'dropoff' ? 'dropoff' : s.place_type === 'lot' ? 'lot' : 'other'])}</p>
    : null
  const role = view.i_drive ? 'driver' : 'rider'

  async function send(s: PickupSpot, source: 'suggestion' | 'home' | 'form') {
    setBusy(source === 'home' ? 'home' : 'send')
    setFailed(false)
    const r = await proposePickup(matchId, s)
    track('together_pickup_sent', { kind: s.pickup_kind, ok: r.ok, source, role })
    setBusy(null)
    if (!r.ok) return setFailed(true)
    setEditing(false)
    await load()
  }
  async function confirm() {
    setBusy('yes')
    setFailed(false)
    const r = await answerPickup(matchId, true)
    track('together_pickup_answered', { yes: true, ok: r.ok })
    setBusy(null)
    if (!r.ok) return setFailed(true)
    await load()
  }
  async function ask() {
    setBusy('ask')
    setFailed(false)
    const ok = await askRiderForPickup(matchId)
    track('together_pickup_asked_rider', { ok })
    setBusy(null)
    if (!ok) return setFailed(true)
    setAsked(true)
  }
  const change = (start: PickupSpot | null) => {
    track('together_pickup_change_opened', { status: plan?.status ?? 'none' })
    setFailed(false)
    setEditing(start)
  }
  const changeLink = (label: string, start: PickupSpot | null) => <button type="button" className={LINK} onClick={() => change(start)}>{label}</button>

  const base = plan ?? view.suggestion
  const homeSpot: PickupSpot = {
    pickup_kind: 'rider_home', pickup_lat: null, pickup_lng: null, pickup_label: null,
    pickup_time: base?.pickup_time ?? DEFAULT_TIME,
    days: base?.days.length ? base.days : DEFAULT_DAYS,
  }

  let body: ReactNode
  if (editing !== false) {
    body = (
      <PickupForm
        view={view}
        name={name}
        start={editing}
        userId={userId}
        locale={locale}
        t={t}
        clock={clock}
        busy={busy === 'send'}
        onCancel={() => setEditing(false)}
        onSend={(s) => void send(s, 'form')}
      />
    )
  } else if (!plan) {
    // A suggestion without a place (nothing safe nearby) still lends its time and days.
    const s = view.suggestion && isPlace(view.suggestion) ? view.suggestion : null
    body = (
      <>
        <p className="text-[17px] font-bold">{s ? sentence(s) : t('pk.none')}</p>
        {/* Says it's a suggestion, so nobody reads it as already agreed. It's near the rider. */}
        {s ? <p className="text-[15px] text-(--ev-ink-80)">{t('pk.suggested', { name, place: view.i_ride ? t('pk.your_home') : t('pk.their_home', { name }) })}</p> : null}
        {s ? spotMap(s) : null}
        {s ? pullOver(s) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" busy={busy === 'send'} disabled={!!busy} onClick={() => (s ? void send(s, 'suggestion') : change(null))}>
            {s ? t('pk.send_to', { name }) : t('pk.choose')}
          </Button>
          {view.i_ride && view.can_offer_home ? (
            <Button busy={busy === 'home'} disabled={!!busy} onClick={() => void send(homeSpot, 'home')}>
              <House className="h-4 w-4" aria-hidden /> {t('pk.home_btn')}
            </Button>
          ) : null}
        </div>
        {/* Only about the home button: the suggested spot shares nothing. */}
        {view.i_ride && view.can_offer_home ? <p className="text-[15px] text-(--ev-ink-80)">{t('pk.home_option_hint', { name })}</p> : null}
        <div className="flex flex-wrap items-center gap-x-5">
          {s ? changeLink(t('pk.change'), s) : null}
          {view.i_drive && !asked ? (
            <button type="button" className={LINK} disabled={!!busy} onClick={() => void ask()}>{t('pk.ask_rider', { name })}</button>
          ) : null}
        </div>
        {view.i_drive && asked ? <p className="text-[15px] text-(--ev-ink-80)">{t('pk.asked', { name })}</p> : null}
      </>
    )
  } else if (plan.status === 'proposed' && mine) {
    body = (
      <>
        <p className="text-[17px] font-bold">{sentence(plan)}</p>
        <p className="flex items-center gap-2 text-[15px] text-(--ev-ink-80)">
          <Hourglass className="h-4 w-4 shrink-0" aria-hidden /> {t('pk.waiting', { name })}
        </p>
        {spotMap(plan)}
        {pullOver(plan)}
        {plan.pickup_kind === 'rider_home' ? <p className="text-[15px] text-(--ev-ink-80)">{t('pk.home_shares', { name })}</p> : null}
        <div>{changeLink(t('pk.change'), plan)}</div>
      </>
    )
  } else if (plan.status === 'proposed') {
    body = (
      <>
        <p className="text-[17px] font-bold">{sentence(plan)}</p>
        <p className="text-[15px] text-(--ev-ink-80)">{t('pk.they_sent', { name })}</p>
        {spotMap(plan)}
        {pullOver(plan)}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button variant="primary" busy={busy === 'yes'} disabled={!!busy} onClick={() => void confirm()}>{t('pk.works')}</Button>
          {changeLink(t('pk.suggest_change'), plan)}
        </div>
      </>
    )
  } else if (plan.status === 'declined') {
    body = (
      <>
        <p className="text-[17px] font-bold">{mine ? t('pk.they_want_change', { name }) : t('pk.you_asked_change', { name })}</p>
        <p className="text-[15px] text-(--ev-ink-80)">{sentence(plan)}</p>
        <div><button type="button" className={PRIMARY} onClick={() => change(plan)}>{t('pk.change')}</button></div>
      </>
    )
  } else {
    // Confirmed: the pickup leads.
    const home = plan.pickup_kind === 'rider_home'
    const dest = plan.pickup_lat != null && plan.pickup_lng != null ? { lat: plan.pickup_lat, lng: plan.pickup_lng } : null
    // The driver drives there; a rider walks to a spot (at home there's nowhere to go).
    const dirWay = view.i_drive ? 'drive' : home ? null : 'walk'
    body = (
      <>
        <p className="flex items-start gap-2 text-[17px] font-bold">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /> {sentence(plan)}
        </p>
        {home && view.i_drive && plan.pickup_label ? <p className="select-all text-[16px] font-semibold">{plan.pickup_label}</p> : null}
        {spotMap(plan)}
        {pullOver(plan)}
        <div className="flex flex-wrap items-center gap-x-5">
          {dest && dirWay ? (
            <a
              href={directionsUrl(dest, dirWay)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('together_pickup_directions', { role })}
              className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-(--ev-accent) underline"
            >
              <Navigation className="h-4 w-4" aria-hidden /> {t('pk.directions')}
            </a>
          ) : null}
          {changeLink(t('pk.change'), plan)}
        </div>
        {/* On a pickup day: each of them can share where they are around the pickup. */}
        {plan.days.includes(isoToday()) ? <FindEachOther matchId={matchId} name={name} way={view.i_drive ? 'drive' : 'walk'} locale={locale} /> : null}
      </>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-(--ev-panel) p-4">
      <p className="flex items-center gap-2 text-[15px] font-bold text-(--ev-ink-85)">
        <MapPin className="h-[18px] w-[18px] text-(--ev-accent)" aria-hidden /> {t('pk.label')}
      </p>
      {body}
      {failed ? <p role="alert" className="text-[15px] font-semibold text-(--ev-danger)">{t('pk.failed')}</p> : null}
    </div>
  )
}

/**
 * Change the pickup (the app's CarpoolPickupSheet), prefilled: where (the
 * rider's home first, for the rider only; then places a car can pull over
 * near the rider, from the server; or any place they search for), the time
 * in five-minute steps, and the days. "Send to Maya" sends it; Maya confirms.
 */
function PickupForm({ view, name, start, userId, locale, t, clock, busy, onCancel, onSend }: {
  view: CarpoolPlanView
  name: string
  start: PickupSpot | null
  userId: string | null
  locale: SiteLocale
  t: T<TogetherMoreKey>
  clock: (time: string) => string
  busy: boolean
  onCancel: () => void
  onSend: (s: PickupSpot) => void
}) {
  const tt = translator(togetherStrings, locale)
  const canHome = view.i_ride && view.can_offer_home
  const s = start ?? view.suggestion
  const [kind, setKind] = useState<PickupKind>(s?.pickup_kind === 'rider_home' ? (canHome ? 'rider_home' : 'public') : s?.pickup_kind ?? 'public')
  const [place, setPlace] = useState<{ lat: number; lng: number; label: string } | null>(
    s && s.pickup_kind !== 'rider_home' && s.pickup_lat != null && s.pickup_lng != null
      ? { lat: s.pickup_lat, lng: s.pickup_lng, label: s.pickup_label ?? t('pk.spot') }
      : null,
  )
  const [time, setTime] = useState(s ? hhmm(s.pickup_time) : DEFAULT_TIME)
  const [days, setDays] = useState<number[]>(s?.days.length ? s.days : DEFAULT_DAYS)
  // Places near the suggestion (it's near the rider); for the rider with no suggestion, near their own Home.
  const near = [view.suggestion, view.plan].find((x) => x && x.pickup_lat != null && x.pickup_lng != null)
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null | undefined>(near ? { lat: near.pickup_lat!, lng: near.pickup_lng! } : undefined)
  useEffect(() => {
    if (anchor !== undefined) return
    let live = true
    const done = (a: { lat: number; lng: number } | null) => { if (live) setAnchor(a) }
    if (view.i_ride && userId) {
      myPlaces(userId)
        .then((ps) => {
          const h = ps.find((p) => p.label === 'Home' && p.lat != null)
          done(h ? { lat: Number(h.lat), lng: Number(h.lng) } : null)
        })
        .catch(() => done(null))
    } else Promise.resolve().then(() => done(null))
    return () => { live = false }
  }, [anchor, view.i_ride, userId])

  const ready = (kind === 'rider_home' || !!place) && days.length > 0
  // The walk to the spot is the rider's, so only the rider sees it.
  const choices: Choice[] | undefined = view.spots.length
    ? view.spots.map((x) => ({ lat: x.lat, lng: x.lng, label: x.label, icon: 'station' as const, walkMin: view.i_ride && x.mi != null ? Math.max(1, Math.round((x.mi / 3) * 60)) : undefined }))
    : undefined
  const fromList = (p: { lat: number; lng: number }) => (choices ?? []).some((c) => Math.abs(c.lat - p.lat) < 1e-5 && Math.abs(c.lng - p.lng) < 1e-5)
  const toggleDay = (d: number) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort((a, b) => a - b)))

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="text-[18px] font-bold">{t('pk.sheet_title', { name })}</p>
      <div className="grid grid-cols-1 gap-2">
        <p className="text-[15px] font-bold">{t('pk.where_q')}</p>
        {canHome ? (
          <>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'rider_home'}
              onClick={() => setKind('rider_home')}
              className={cx(
                'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left',
                kind === 'rider_home' ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel)',
              )}
            >
              <House className={cx('h-6 w-6 shrink-0', kind === 'rider_home' ? '' : 'text-(--ev-accent)')} aria-hidden />
              <span className="flex-1 text-[16px] font-bold">{t('pk.at_my_home')}</span>
              {kind === 'rider_home' ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : null}
            </button>
            {kind === 'rider_home' ? <p className="text-[15px] text-(--ev-ink-80)">{t('pk.home_shares', { name })}</p> : null}
          </>
        ) : null}
        {anchor === undefined ? <Spinner /> : (
          <PlacePick
            anchor={anchor}
            value={kind === 'rider_home' ? null : place}
            choices={choices}
            onPick={(p) => { setKind(fromList(p) ? 'public' : 'other'); setPlace(p) }}
            t={translator(planStrings, locale)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-[120px] flex-1 text-[15px] font-bold">{t('pk.time_q')}</p>
        <button type="button" aria-label={t('pk.earlier')} onClick={() => setTime((v) => shift(v, -STEP_MIN))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="min-w-[88px] text-center text-[18px] font-bold" aria-live="polite">{clock(time)}</span>
        <button type="button" aria-label={t('pk.later')} onClick={() => setTime((v) => shift(v, STEP_MIN))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <p className="text-[15px] font-bold">{t('pk.days_q')}</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => {
            const on = days.includes(i + 1)
            return (
              <button key={d.id} type="button" aria-pressed={on} onClick={() => toggleDay(i + 1)}
                className={cx(
                  'inline-flex min-h-[44px] items-center rounded-full border px-4 text-[15px] font-semibold',
                  on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white',
                )}>
                {tt(DAY_KEY[d.id])}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          busy={busy}
          disabled={!ready}
          onClick={() => onSend({
            pickup_kind: kind,
            pickup_lat: kind === 'rider_home' ? null : place!.lat,
            pickup_lng: kind === 'rider_home' ? null : place!.lng,
            pickup_label: kind === 'rider_home' ? null : place!.label,
            pickup_time: time,
            days,
          })}
        >
          {t('pk.send_to', { name })}
        </Button>
        <button type="button" className={LINK} onClick={onCancel}>{t('pk.cancel')}</button>
      </div>
      <p className="text-[15px] text-(--ev-ink-80)">{t('pk.send_hint', { name })}</p>
    </div>
  )
}
