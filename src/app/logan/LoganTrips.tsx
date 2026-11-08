'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Mail, MessageSquare, Minus, Plane, PlaneLanding, Plus, Search } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Avatar, Chip } from '@/components/together/bits'
import { useTogether } from '@/components/together/TogetherShell'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import { acceptTerms, myPlaces, track } from '@/lib/together'
import { SITE_LOCALE_TAG, translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { loganStrings, type LoganKey } from '@/lib/site-strings/logan'
import {
  answer, bostonInstant, bostonParts, leaveMatch, myTrips, saveTrip, setPhone, stopTrip,
  type LoganMatch, type LoganTrip, type Terminal, type TripKind, type TripWay,
} from '@/lib/logan'

/**
 * gogreenstreets.org/logan (Shift 01518, Keith 2026-10-30: "I'd much rather
 * run Logan around Thanksgiving and December holidays"). Designed simple
 * from the start (Keith, same day): one short form with everything but the
 * flight and the place filled in, then one card per trip that leads with the
 * outcome (the plan, or the people to say yes to, or that we're looking).
 *
 * In the page's language (TogetherShell's locale, from ?lang= or the
 * browser); words in src/lib/site-strings/logan.ts, and the shared sign-up
 * words (the terms, Cancel, Change) from together.ts.
 */

type Place = { address: string; lat: number | null; lng: number | null }
const noPlace: Place = { address: '', lat: null, lng: null }

const WAYS_LOGAN: { id: TripWay; label: LoganKey }[] = [
  { id: 'either', label: 'logan.way_either' },
  { id: 'transit', label: 'logan.way_transit' },
  { id: 'split', label: 'logan.way_split' },
]
const TERMINALS: Terminal[] = ['A', 'B', 'C', 'E']

/** The server's reasons (lib/logan.ts REASON), in the page's language. */
const REASON_KEY: Record<string, LoganKey> = {
  bad_time: 'logan.reason_bad_time',
  bad_place: 'logan.reason_bad_place',
  has_match: 'logan.reason_has_match',
  needs_terms: 'logan.err_terms',
  under_18: 'logan.reason_under_18',
}

/** This page's words and the shared Shift Together ones, in the shell's language. */
function useWords(): { t: T<LoganKey>; tt: ReturnType<typeof useTogether>['t']; locale: SiteLocale } {
  const { locale, t: tt } = useTogether()
  return { t: translator(loganStrings, locale), tt, locale }
}

const TZ = 'America/New_York'
/** "Wed, Nov 25" in Boston time, in the page's language (lib/logan.ts dayText). */
const dayText = (iso: string, locale: SiteLocale) =>
  new Intl.DateTimeFormat(SITE_LOCALE_TAG[locale], { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
/** "4:10 PM" in Boston time, in the page's language (lib/logan.ts clockText). */
const clockText = (iso: string, locale: SiteLocale) =>
  new Intl.DateTimeFormat(SITE_LOCALE_TAG[locale], { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

export default function LoganTrips() {
  const { userId } = useTogether()
  const { t, tt, locale } = useWords()
  const [trips, setTrips] = useState<LoganTrip[] | null>(null)
  const [terms, setTerms] = useState(false)
  const [editing, setEditing] = useState<TripKind | 'new' | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const loadFailed = t('logan.load_failed')

  const load = useCallback(async () => {
    try {
      const r = await myTrips()
      setTrips(r.trips)
      setTerms(r.terms)
    } catch {
      setErr(loadFailed)
    }
  }, [loadFailed])
  useEffect(() => {
    let live = true
    myTrips()
      .then((r) => { if (live) { setTrips(r.trips); setTerms(r.terms) } })
      .catch(() => { if (live) setErr(loadFailed) })
    track('together_logan_viewed')
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, [])

  const sp = locale === 'zh-Hans' ? '' : ' '

  if (err) return <Notice tone="off">{err}</Notice>
  if (!trips || !userId) return <Spinner label={t('logan.loading')} />

  if (editing || trips.length === 0) {
    return (
      <TripForm
        userId={userId}
        trips={trips}
        only={editing && editing !== 'new' ? editing : null}
        termsDone={terms}
        onCancel={trips.length ? () => setEditing(null) : null}
        onSaved={async (matches) => {
          setEditing(null)
          setFlash(matches)
          await load()
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    )
  }

  const has = (k: TripKind) => trips.some((tr) => tr.kind === k)
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('logan.your_trips')}</h1>
      {flash != null ? (
        <Notice tone="good" onClose={() => setFlash(null)} dismissLabel={tt('dismiss')}>
          <span className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <span className="text-[16px]">
              {flash > 0
                ? <><strong>{flash === 1 ? t('logan.found_one') : t('logan.found_many', { n: flash })}</strong>{sp}{t('logan.found_rest')}</>
                : <><strong>{t('logan.signed_up')}</strong>{sp}{t('logan.email_soon')}</>}
            </span>
          </span>
        </Notice>
      ) : null}
      {trips.map((tr) => <TripCard key={tr.id} trip={tr} onChange={load} onEdit={() => setEditing(tr.kind)} />)}
      {!has('airport_out') || !has('airport_back') ? (
        <div>
          <Button onClick={() => setEditing('new')}>
            {has('airport_out') ? t('logan.add_home') : t('logan.add_to')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- the form */

function TripForm({ userId, trips, only, termsDone, onCancel, onSaved }: {
  userId: string
  trips: LoganTrip[]
  only: TripKind | null
  termsDone: boolean
  onCancel: (() => void) | null
  onSaved: (matches: number) => void
}) {
  const { t, tt, locale } = useWords()
  const out = trips.find((tr) => tr.kind === 'airport_out')
  const back = trips.find((tr) => tr.kind === 'airport_back')
  const first = out ?? back
  // Signed up one way already: the form offers the other.
  const [which, setWhich] = useState<'out' | 'back' | 'both'>(
    only === 'airport_out' ? 'out' : only === 'airport_back' ? 'back' : out && !back ? 'back' : back && !out ? 'out' : 'out',
  )
  const [outDate, setOutDate] = useState(out ? bostonParts(out.trip_at).date : '')
  const [outTime, setOutTime] = useState(out ? bostonParts(out.trip_at).time : '')
  const [outIntl, setOutIntl] = useState(out?.international ?? false)
  const [backDate, setBackDate] = useState(back ? bostonParts(back.trip_at).date : '')
  const [backTime, setBackTime] = useState(back ? bostonParts(back.trip_at).time : '')
  const [backIntl, setBackIntl] = useState(back?.international ?? false)
  const [terminal, setTerminal] = useState<Terminal | null>(back?.terminal ?? null)
  const [place, setPlace] = useState<Place>(first ? { address: first.place_label ?? '', lat: first.place_lat, lng: first.place_lng } : noPlace)
  const [way, setWay] = useState<TripWay>(first?.way ?? 'either')
  const [party, setParty] = useState(first?.party_size ?? 1)
  const [bags, setBags] = useState(first?.big_bags ?? 1)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Home, if they saved one in Shift, so most people skip this question.
  useEffect(() => {
    if (first) return
    let live = true
    myPlaces(userId).then((ps) => {
      const h = ps.find((p) => p.label === 'Home')
      if (live && h) setPlace((cur) => (cur.lat == null ? { address: h.address_text ?? 'Home', lat: h.lat, lng: h.lng } : cur))
    }).catch(() => {})
    return () => { live = false }
  }, [userId, first])

  const goOut = which !== 'back'
  const goBack = which !== 'out'
  const today = bostonParts(new Date().toISOString()).date

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const outAt = goOut ? bostonInstant(outDate, outTime) : null
    const backAt = goBack ? bostonInstant(backDate, backTime) : null
    if (goOut && !outAt) return setErr(t('logan.err_leave'))
    if (goBack && !backAt) return setErr(t('logan.err_land'))
    if (place.lat == null || place.lng == null) return setErr(t('logan.err_place'))
    if (!termsDone && !agreed) return setErr(t('logan.err_terms'))
    setBusy(true)
    try {
      if (!termsDone) await acceptTerms()
      let matches = 0
      for (const [kind, at, intl] of [
        ...(goOut ? [['airport_out', outAt!, outIntl] as const] : []),
        ...(goBack ? [['airport_back', backAt!, backIntl] as const] : []),
      ]) {
        const r = await saveTrip({
          kind, tripAt: at, international: intl, terminal, way, party, bags,
          lat: place.lat, lng: place.lng, label: place.address,
        })
        if (!r.ok) {
          setErr(locale === 'en' ? r.reason : t(REASON_KEY[r.code] ?? 'logan.err_save'))
          setBusy(false)
          return
        }
        matches += r.matches
      }
      track('together_logan_saved', { which, way, party, matches })
      onSaved(matches)
    } catch {
      setErr(t('logan.err_save'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('logan.form_title')}</h1>
        <p className="mt-2 text-[16px] leading-snug text-(--ev-ink-85)">
          {t('logan.form_intro')}
        </p>
      </div>
      <Card className="grid grid-cols-1 gap-6">
        {only ? null : (
          <Field label={t('logan.which_q')}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('logan.which_q')}>
              <Chip on={which === 'out'} onClick={() => setWhich('out')} role="radio" aria-checked={which === 'out'}><Plane className="h-4 w-4" aria-hidden /> {t('logan.going')}</Chip>
              <Chip on={which === 'back'} onClick={() => setWhich('back')} role="radio" aria-checked={which === 'back'}><PlaneLanding className="h-4 w-4" aria-hidden /> {t('logan.coming')}</Chip>
              <Chip on={which === 'both'} onClick={() => setWhich('both')} role="radio" aria-checked={which === 'both'}>{t('logan.both')}</Chip>
            </div>
          </Field>
        )}

        {goOut ? (
          <fieldset className="grid grid-cols-1 gap-3">
            <legend className="mb-1 text-[16px] font-bold">{t('logan.leave_q')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
              <Input type="date" aria-label={t('logan.leave_date')} min={today} value={outDate} onChange={(e) => setOutDate(e.target.value)} />
              <Input type="time" aria-label={t('logan.leave_time')} value={outTime} onChange={(e) => setOutTime(e.target.value)} />
            </div>
            <Check checked={outIntl} onChange={setOutIntl} label={t('logan.intl_out')} />
          </fieldset>
        ) : null}

        {goBack ? (
          <fieldset className="grid grid-cols-1 gap-3">
            <legend className="mb-1 text-[16px] font-bold">{t('logan.land_q')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
              <Input type="date" aria-label={t('logan.land_date')} min={outDate || today} value={backDate} onChange={(e) => setBackDate(e.target.value)} />
              <Input type="time" aria-label={t('logan.land_time')} value={backTime} onChange={(e) => setBackTime(e.target.value)} />
            </div>
            <Check checked={backIntl} onChange={setBackIntl} label={t('logan.intl_back')} />
            <div>
              <p className="mb-2 text-[15px] font-semibold">{t('logan.terminal_q')} <span className="font-normal text-(--ev-ink-75)">{t('logan.terminal_hint')}</span></p>
              <div className="flex flex-wrap gap-2">
                {TERMINALS.map((x) => <Chip key={x} on={terminal === x} onClick={() => setTerminal(x)}>{x}</Chip>)}
                <Chip on={terminal === null} onClick={() => setTerminal(null)}>{t('logan.not_sure')}</Chip>
              </div>
            </div>
          </fieldset>
        ) : null}

        <Field label={which === 'out' ? t('logan.place_out') : which === 'back' ? t('logan.place_back') : t('logan.place_both')} hint={t('logan.place_hint')}>
          <AddressAutocomplete
            value={place.address}
            onChange={(a) => setPlace({ address: a, lat: null, lng: null })}
            onPlaceSelected={(p) => setPlace({ address: p.address, lat: p.lat, lng: p.lng })}
            label={null}
            includeAreas
            placeholder={t('logan.place_placeholder')}
          />
        </Field>

        <Field
          label={t('logan.way_q')}
          hint={way === 'split' ? t('logan.way_hint_split')
            : way === 'transit' ? t('logan.way_hint_transit') : t('logan.way_hint_either')}
        >
          <div className="flex flex-wrap gap-2">
            {WAYS_LOGAN.map((w) => <Chip key={w.id} on={way === w.id} onClick={() => setWay(w.id)}>{t(w.label)}</Chip>)}
          </div>
        </Field>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Stepper label={t('logan.party')} fewer={t('logan.party_fewer')} more={t('logan.party_more')} value={party} min={1} max={6} onChange={setParty} />
          {way !== 'transit' ? <Stepper label={t('logan.bags')} fewer={t('logan.bags_fewer')} more={t('logan.bags_more')} value={bags} min={0} max={8} onChange={setBags} /> : null}
        </div>

        {!termsDone && (
          <label className="flex items-start gap-3 rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {tt('terms')}{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">{tt('terms_link')}</a>
            </span>
          </label>
        )}
        {err ? <Notice tone="off">{err}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" busy={busy}>{t('logan.submit')}</Button>
          {onCancel ? <Button variant="ghost" onClick={onCancel}>{tt('cancel')}</Button> : null}
        </div>
      </Card>
    </form>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 text-[15px]">
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Stepper({ label, fewer, more, value, min, max, onChange }: {
  label: string; fewer: string; more: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={fewer} disabled={value <= min} onClick={() => onChange(value - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white disabled:opacity-40">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-6 text-center text-[18px] font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white disabled:opacity-40">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- a trip card */

function TripCard({ trip, onChange, onEdit }: { trip: LoganTrip; onChange: () => Promise<void>; onEdit: () => void }) {
  const { t, tt, locale } = useWords()
  const outbound = trip.kind === 'airport_out'
  const set = trip.matches.find((m) => m.status !== 'proposed')
  const offers = trip.matches.filter((m) => m.status === 'proposed')
  const [busy, setBusy] = useState(false)
  const Icon = outbound ? Plane : PlaneLanding
  const day = dayText(trip.trip_at, locale)
  const time = clockText(trip.trip_at, locale)

  async function notGoing() {
    if (!window.confirm(outbound ? t('logan.stop_out') : t('logan.stop_back'))) return
    setBusy(true)
    await stopTrip(trip.kind)
    track('together_logan_stopped', { kind: trip.kind })
    await onChange()
  }

  return (
    <Card className="grid grid-cols-1 gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-extrabold leading-tight">
            {outbound ? t('logan.card_out', { day }) : t('logan.card_back', { day })}
          </h2>
          <p className="text-[15px] text-(--ev-ink-80)">
            {outbound
              ? t('logan.card_out_line', { time, at: clockText(trip.at_airport, locale) })
              : trip.terminal ? t('logan.card_back_terminal', { time, terminal: trip.terminal }) : t('logan.card_back_line', { time })}
          </p>
        </div>
      </div>

      {set ? <Plan trip={trip} m={set} onChange={onChange} />
        : offers.length ? (
          <div className="grid grid-cols-1 gap-3">
            <p className="text-[17px] font-bold">{offers.length === 1 ? t('logan.offers_one') : t('logan.offers_many', { n: offers.length })}</p>
            {offers.map((m) => <Offer key={m.id} trip={trip} m={m} onChange={onChange} />)}
          </div>
        ) : <Looking />}

      {set ? null : (
        <div className="flex flex-wrap gap-2 border-t border-(--ev-line) pt-3">
          <Button size="sm" onClick={onEdit}>{tt('change')}</Button>
          <Button size="sm" variant="ghost" busy={busy} onClick={() => void notGoing()}>{t('logan.not_going')}</Button>
        </div>
      )}
    </Card>
  )
}

/**
 * The meeting spot the server sends (English, 01518 airport_back_meet) in the
 * page's language; any other spot as sent. In Chinese, a spot that starts or
 * ends in Latin letters gets a space there, so it doesn't run into the hanzi.
 */
function placeText(raw: string, t: T<LoganKey>, locale: SiteLocale): string {
  const sl = /^the Silver Line stop at Terminal ([A-Z])$/.exec(raw)
  const p = raw === 'the ride app pickup in the Central Parking garage' ? t('logan.place_rideapp')
    : raw === 'the same Silver Line bus into town' ? t('logan.place_same_bus')
      : sl ? t('logan.place_sl_stop', { terminal: sl[1] })
        : raw
  if (locale !== 'zh-Hans') return p
  return `${/^[A-Za-z0-9]/.test(p) ? ' ' : ''}${p}${/[A-Za-z0-9]$/.test(p) ? ' ' : ''}`
}

/** The plan in one line: where, when, how. */
function planLine(trip: LoganTrip, m: LoganMatch, t: T<LoganKey>, locale: SiteLocale): string {
  const time = clockText(m.meet_at, locale)
  const out = trip.kind === 'airport_out'
  if (m.meet_lx && m.meet_place) {
    const where = placeText(m.meet_place, t, locale).trim()
    const Place = where.charAt(0).toUpperCase() + where.slice(1)
    return out ? t('logan.plan_lx_out', { Place, time }) : t('logan.plan_lx_back', { Place, time })
  }
  const how = out
    ? (m.way === 'split' ? t('logan.how_out_split') : t('logan.how_out_t'))
    : (m.way === 'split' ? t('logan.how_back_split') : t('logan.how_back_t'))
  if (out) return t('logan.plan_out', { station: m.meet_station, time, how })
  const place = m.meet_place == null ? m.meet_place : placeText(m.meet_place, t, locale)
  if (m.way === 'transit' && m.meet_place?.startsWith('the same')) return t('logan.plan_same_bus', { place, time })
  return t('logan.plan_back', { place, time, how })
}

/** "within 20 minutes of you", from when each wants to be there or lands. */
function gapLine(trip: LoganTrip, m: LoganMatch, t: T<LoganKey>): string {
  const theirs = new Date(m.other.trip_at).getTime() - (trip.kind === 'airport_out' ? (m.other.international ? 3 : 2) * 3600_000 : 0)
  const mine = new Date(trip.kind === 'airport_out' ? trip.at_airport : trip.trip_at).getTime()
  const min = Math.round((theirs - mine) / 60_000)
  const out = trip.kind === 'airport_out'
  if (Math.abs(min) <= 5) return out ? t('logan.gap_out_same') : t('logan.gap_back_same')
  const n = Math.abs(min)
  if (out) return min > 0 ? t('logan.gap_out_after', { n }) : t('logan.gap_out_before', { n })
  return min > 0 ? t('logan.gap_back_after', { n }) : t('logan.gap_back_before', { n })
}

function Offer({ trip, m, onChange }: { trip: LoganTrip; m: LoganMatch; onChange: () => Promise<void> }) {
  const { t, locale } = useWords()
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const name = m.other.first_name?.trim() || t('logan.someone')
  async function reply(yes: boolean) {
    setBusy(yes ? 'yes' : 'no')
    await answer(m.id, yes)
    track('together_logan_answered', { yes })
    await onChange()
    setBusy(null)
  }
  const bagsN = m.other.big_bags
  const group = [
    m.other.party_size > 1 ? t('logan.people', { n: m.other.party_size }) : null,
    m.way === 'split' && bagsN > 0 ? t(bagsN === 1 ? 'logan.bag_one' : 'logan.bags_many', { n: bagsN }) : null,
  ].filter(Boolean)
  const miles = m.miles != null ? Math.max(m.miles, 0.1).toLocaleString(SITE_LOCALE_TAG[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-(--ev-line-strong) bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={name} url={m.other.avatar_url} size={48} />
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug">{m.other.town ? t('logan.from_town', { name, town: m.other.town }) : name}</p>
          <p className="text-[15px] leading-snug text-(--ev-ink-80)">
            {[miles != null ? t('logan.miles_from', { miles }) : null, gapLine(trip, m, t), ...group].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <p className="rounded-xl bg-(--ev-panel) px-4 py-3 text-[15px] leading-snug"><strong>{t('logan.plan_label')}</strong>{locale === 'zh-Hans' ? '' : ' '}{planLine(trip, m, t, locale)}</p>
      {m.my_answer === 'yes' ? (
        <p className="text-[15px] font-semibold">{t('logan.said_yes', { name })}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" busy={busy === 'yes'} onClick={() => void reply(true)}>{t('logan.go_with', { name })}</Button>
          <Button variant="ghost" busy={busy === 'no'} onClick={() => void reply(false)}>{t('logan.no_thanks')}</Button>
        </div>
      )}
    </div>
  )
}

function Plan({ trip, m, onChange }: { trip: LoganTrip; m: LoganMatch; onChange: () => Promise<void> }) {
  const { t, tt, locale } = useWords()
  const name = m.other.first_name?.trim() || t('logan.your_match')
  const full = [m.other.first_name, m.other.last_initial ? `${m.other.last_initial}.` : null].filter(Boolean).join(' ') || t('logan.your_match')
  const [phone, setPhoneText] = useState(m.my_phone ? phoneText(m.my_phone) : '')
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busBoard = trip.kind === 'airport_back' && m.way === 'transit' && m.meet_place?.startsWith('the same')

  async function savePhone() {
    setBusy(true)
    const r = await setPhone(m.id, phone)
    setBusy(false)
    setSaved(r.ok ? (r.phone ? t('logan.phone_saved', { name, phone: phoneText(r.phone) }) : t('logan.phone_removed')) : t('logan.phone_bad'))
  }
  async function cantGo() {
    if (!window.confirm(t('logan.cant_confirm', { name }))) return
    await leaveMatch(m.id)
    track('together_logan_left')
    await onChange()
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={m.other.avatar_url} size={48} />
        <p className="text-[18px] font-bold leading-snug">{t('logan.going_with', { name: full })}</p>
      </div>
      <div className="rounded-2xl bg-(--ev-panel) p-4">
        <p className="text-[19px] font-extrabold leading-snug">{planLine(trip, m, t, locale)}</p>
        {busBoard ? (
          <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
            {t('logan.bus_board')}
          </p>
        ) : null}
        {m.meet_lx ? (
          <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
            {t('logan.lx_ticket_a')}{' '}
            <a href="https://www.massport.com/logan-airport/getting-to-logan/logan-express" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">massport.com</a>{t('logan.lx_ticket_b')}
          </p>
        ) : null}
        {m.way === 'split' ? (
          <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">{t('logan.split_note')}</p>
        ) : null}
        <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
          {t('logan.wait_note', { name })}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 text-[16px]">
        {m.other.email ? (
          <a href={`mailto:${m.other.email}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-(--ev-accent) underline">
            <Mail className="h-5 w-5" aria-hidden /> {m.other.email}
          </a>
        ) : null}
        {m.other.phone ? (
          <a href={`sms:${m.other.phone}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-(--ev-accent) underline">
            <MessageSquare className="h-5 w-5" aria-hidden /> {t('logan.text_at', { name, phone: phoneText(m.other.phone) })}
          </a>
        ) : null}
      </div>
      <Field label={t('logan.phone_label')} optional optionalLabel={tt('optional')} hint={t('logan.phone_hint', { name })} htmlFor={`phone-${m.id}`}>
        <div className="flex flex-wrap gap-2">
          <Input id={`phone-${m.id}`} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhoneText(e.target.value)} className="max-w-[220px]" placeholder="617 555 0100" />
          <Button busy={busy} onClick={() => void savePhone()}>{t('logan.save')}</Button>
        </div>
      </Field>
      {saved ? <p className="text-[15px]" role="status">{saved}</p> : null}
      <div className="border-t border-(--ev-line) pt-3">
        <Button size="sm" variant="ghost" onClick={() => void cantGo()}>{t('logan.cant_go')}</Button>
      </div>
    </div>
  )
}

/** "+16175550199" as "(617) 555-0199"; other countries as given. */
function phoneText(p: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p)
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : p
}

function Looking() {
  const { t, locale } = useWords()
  const [copied, setCopied] = useState(false)
  const sp = locale === 'zh-Hans' ? '' : ' '
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-(--ev-panel) p-4">
      <p className="flex items-start gap-2 text-[16px] leading-snug">
        <Search className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
        <span><strong>{t('logan.looking')}</strong>{sp}{t('logan.email_soon')}</span>
      </p>
      <p className="text-[15px] leading-snug text-(--ev-ink-85)">
        {t('logan.know_someone')}{sp}
        <button
          type="button"
          className={cx('font-semibold underline', copied ? 'text-(--ev-ink)' : 'text-(--ev-accent)')}
          onClick={() => {
            void navigator.clipboard?.writeText('https://www.gogreenstreets.org/logan').then(() => setCopied(true)).catch(() => {})
            track('together_logan_link_copied')
          }}
        >
          {copied ? t('logan.copied') : t('logan.copy')}
        </button>
      </p>
    </div>
  )
}
