'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Loader2, Mail, MessageSquare, Minus, Plane, PlaneLanding, Plus, Search } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Avatar, Chip } from '@/components/together/bits'
import { useTogether } from '@/components/together/TogetherShell'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import { acceptTerms, myPlaces, track } from '@/lib/together'
import { SITE_LOCALE_TAG, translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { loganStrings, type LoganKey } from '@/lib/site-strings/logan'
import {
  answer, bostonInstant, bostonParts, leaveMatch, lookupFlight, myTrips, normalizeFlight, runningLate, saveTrip, setPhone, stopTrip,
  type FlightInfo, type LoganMatch, type LoganTrip, type Terminal, type TripKind, type TripWay,
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
  bad_flight: 'logan.reason_bad_flight',
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
  const outF = useFlight('airport_out', out)
  const backF = useFlight('airport_back', back)
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
    const outR = goOut ? outF.result() : null
    const backR = goBack ? backF.result() : null
    if (outR && 'error' in outR) return setErr(outR.error === 'bad_flight' ? t('logan.flight_bad') : t('logan.err_leave'))
    if (backR && 'error' in backR) return setErr(backR.error === 'bad_flight' ? t('logan.flight_bad') : t('logan.err_land'))
    if (place.lat == null || place.lng == null) return setErr(t('logan.err_place'))
    if (!termsDone && !agreed) return setErr(t('logan.err_terms'))
    setBusy(true)
    try {
      if (!termsDone) await acceptTerms()
      let matches = 0
      for (const [kind, f] of [
        ...(outR && !('error' in outR) ? [['airport_out', outR] as const] : []),
        ...(backR && !('error' in backR) ? [['airport_back', backR] as const] : []),
      ]) {
        const r = await saveTrip({
          kind, tripAt: f.at, international: f.international, terminal: f.terminal, way, party, bags,
          lat: place.lat, lng: place.lng, label: place.address, flight: f.flight, flightLabel: f.label,
        })
        if (!r.ok) {
          setErr(locale === 'en' ? r.reason : t(REASON_KEY[r.code] ?? 'logan.err_save'))
          setBusy(false)
          return
        }
        matches += r.matches
      }
      track('together_logan_saved', { which, way, party, matches, by_number: !!(outR && !('error' in outR) && outR.flight) || !!(backR && !('error' in backR) && backR.flight) })
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

        {goOut ? <FlightFields f={outF} minDate={today} /> : null}
        {goBack ? <FlightFields f={backF} minDate={(goOut && outF.date) || today} /> : null}

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

/* ------------------------------------------------------------- the flight */

type Look =
  | { state: 'idle' }
  | { state: 'looking'; key: string }
  | { state: 'found'; key: string; info: Extract<FlightInfo, { found: true }>; label: string }
  | { state: 'missing'; key: string; reason: string }

type FlightResult =
  | { at: string; international: boolean; terminal: Terminal | null; flight: string | null; label: string | null }
  | { error: 'time' | 'bad_flight' }

/**
 * One direction's flight: the date and the flight number, looked up as they
 * type (logan-flights), which fills in the time, terminal and whether it's
 * international. When it can't be found, or they have no number yet, they
 * type the time instead, as before.
 */
function useFlight(kind: TripKind, trip: LoganTrip | undefined) {
  const { t } = useWords()
  const init = trip ? bostonParts(trip.trip_at) : null
  const [date, setDate] = useState(init?.date ?? '')
  const [number, setNumber] = useState(trip?.flight ?? '')
  const [manual, setManual] = useState(!!trip && !trip.flight)
  const [time, setTime] = useState(init?.time ?? '')
  const [intl, setIntl] = useState(trip?.international ?? false)
  const [terminal, setTerminal] = useState<Terminal | null>(trip?.terminal ?? null)
  const storedKey = trip?.flight && init ? `${trip.flight}|${init.date}` : ''
  const [stored] = useState<Look>(() => (trip?.flight && init
    ? {
      state: 'found', key: storedKey, label: trip.flight_label ?? trip.flight,
      info: { found: true, number: trip.flight, airline: null, city: null, international: trip.international, sched: trip.trip_at, expected: trip.trip_at, terminal: trip.terminal, status: '' },
    }
    : { state: 'idle' }))
  const [look, setLook] = useState<Look>(stored)

  const norm = normalizeFlight(number)
  const key = norm && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${norm}|${date}` : ''
  useEffect(() => {
    if (manual || !key) return
    if (key === storedKey) { setLook(stored); return }
    let live = true
    const timer = window.setTimeout(async () => {
      setLook({ state: 'looking', key })
      const [flight, day] = key.split('|')
      const r = await lookupFlight(flight, day, kind)
      if (!live) return
      if (r.found) {
        const num = r.number.split(' ')[1] ?? r.number
        const name = r.airline ? `${r.airline} ${num}` : r.number
        const label = r.city ? t(kind === 'airport_out' ? 'logan.flight_to' : 'logan.flight_from', { flight: name, city: r.city }) : name
        setLook({ state: 'found', key, info: r, label })
        track('together_logan_flight_found', { kind })
      } else {
        setLook({ state: 'missing', key, reason: r.reason })
        track('together_logan_flight_missing', { kind, reason: r.reason })
      }
    }, 600)
    return () => { live = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- looks up when the number or date settles
  }, [key, manual, kind])

  const found = !manual && look.state === 'found' && look.key === key ? look : null
  const missing = !manual && look.state === 'missing' && look.key === key ? look : null
  const looking = !manual && !!key && !found && !missing

  function result(): FlightResult {
    if (found) {
      return { at: found.info.sched, international: found.info.international, terminal: found.info.terminal ?? terminal, flight: norm, label: found.label }
    }
    if (!manual && number.trim() && !norm) return { error: 'bad_flight' }
    const at = bostonInstant(date, time)
    if (!at) return { error: 'time' }
    // A number we couldn't find today is still kept: on the day it may show up.
    return { at, international: intl, terminal, flight: manual ? null : norm, label: null }
  }

  return { kind, date, setDate, number, setNumber, manual, setManual, time, setTime, intl, setIntl, terminal, setTerminal, norm, found, missing, looking, result }
}

function FlightFields({ f, minDate }: { f: ReturnType<typeof useFlight>; minDate: string }) {
  const { t, locale } = useWords()
  const out = f.kind === 'airport_out'
  const showTime = f.manual || !!f.missing
  const id = out ? 'out' : 'back'
  const info = f.found?.info
  const facts = info ? [
    t(out ? 'logan.found_out' : 'logan.found_back', { time: clockText(info.sched, locale) }),
    info.terminal ? t('logan.found_terminal', { terminal: info.terminal }) : null,
    info.international ? t('logan.found_intl') : null,
  ].filter(Boolean).join(' · ') : ''
  return (
    <fieldset className="grid grid-cols-1 gap-3">
      <legend className="mb-2 text-[16px] font-bold">{t(out ? 'logan.out_legend' : 'logan.back_legend')}</legend>
      <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('logan.date')}
          <Input type="date" aria-label={t(out ? 'logan.leave_date' : 'logan.land_date')} min={minDate} value={f.date} onChange={(e) => f.setDate(e.target.value)} />
        </label>
        {f.manual ? (
          <label className="grid gap-1 text-[15px] font-semibold">
            {t('logan.time')}
            <Input type="time" aria-label={t(out ? 'logan.leave_time' : 'logan.land_time')} value={f.time} onChange={(e) => f.setTime(e.target.value)} />
          </label>
        ) : (
          <label className="grid gap-1 text-[15px] font-semibold" htmlFor={`flight-${id}`}>
            {t('logan.flight_number')}
            <Input
              id={`flight-${id}`} aria-label={t('logan.flight_number')} placeholder="B6 1234" value={f.number}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="next"
              onChange={(e) => f.setNumber(e.target.value)}
            />
          </label>
        )}
      </div>
      {!f.manual && !f.found && !f.missing && !f.looking ? (
        <p className="text-[14px] leading-snug text-(--ev-ink-75)">
          {f.number.trim() && !f.norm ? t('logan.flight_bad') : t('logan.flight_hint')}
        </p>
      ) : null}
      {f.looking ? (
        <p className="flex items-center gap-2 text-[15px] text-(--ev-ink-80)" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-(--ev-accent)" aria-hidden /> {t('logan.flight_looking')}
        </p>
      ) : null}
      {f.found ? (
        <div className="flex items-start gap-3 rounded-xl bg-(--ev-panel) px-4 py-3" role="status">
          {out ? <Plane className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden /> : <PlaneLanding className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />}
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-snug">{f.found.label}</span>
            <span className="block text-[15px] leading-snug text-(--ev-ink-80)">{facts}</span>
            {f.found.info.status ? <span className="mt-1 block text-[13px] leading-snug text-(--ev-ink-75)">{t('logan.adb_credit')}</span> : null}
          </span>
        </div>
      ) : null}
      {f.missing ? (
        <p className="text-[15px] leading-snug text-(--ev-ink-85)" role="status">
          {f.missing.reason === 'unavailable' ? t('logan.flight_unavailable') : t(out ? 'logan.nf_out' : 'logan.nf_back')}
        </p>
      ) : null}
      {f.missing ? (
        <label className="grid gap-1 text-[15px] font-semibold sm:max-w-[260px]">
          {t(out ? 'logan.leave_time' : 'logan.land_time')}
          <Input type="time" aria-label={t(out ? 'logan.leave_time' : 'logan.land_time')} value={f.time} onChange={(e) => f.setTime(e.target.value)} />
        </label>
      ) : null}
      {showTime ? <Check checked={f.intl} onChange={f.setIntl} label={t(out ? 'logan.intl_out' : 'logan.intl_back')} /> : null}
      {showTime && !out ? (
        <div>
          <p className="mb-2 text-[15px] font-semibold">{t('logan.terminal_q')} <span className="font-normal text-(--ev-ink-75)">{t('logan.terminal_hint')}</span></p>
          <div className="flex flex-wrap gap-2">
            {TERMINALS.map((x) => <Chip key={x} on={f.terminal === x} onClick={() => f.setTerminal(x)}>{x}</Chip>)}
            <Chip on={f.terminal === null} onClick={() => f.setTerminal(null)}>{t('logan.not_sure')}</Chip>
          </div>
        </div>
      ) : null}
      {f.missing ? null : <p className="text-[14px]">
        <button type="button" className="font-semibold text-(--ev-accent) underline underline-offset-2" onClick={() => f.setManual(!f.manual)}>
          {f.manual ? t('logan.use_number') : f.found ? t('logan.not_mine') : t('logan.no_number')}
        </button>
      </p>}
    </fieldset>
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
  const now = flightNow(trip.trip_at, trip.flight_expected_at, trip.flight_status, outbound, t, locale)
  // Told not to wait because of my own flight: they can add the new one.
  const goneMine = set?.delay_state === 'go_ahead' && whoseGo(trip, set) === 'my_flight'

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
          {trip.flight ? <p className="text-[15px] text-(--ev-ink-80)">{trip.flight_label ?? trip.flight}</p> : null}
          {now ? (
            <p className="mt-1 flex items-start gap-1.5 text-[15px] font-bold leading-snug">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />{now}
            </p>
          ) : null}
        </div>
      </div>

      {set ? <Plan trip={trip} m={set} onChange={onChange} />
        : offers.length ? (
          <div className="grid grid-cols-1 gap-3">
            <p className="text-[17px] font-bold">{offers.length === 1 ? t('logan.offers_one') : t('logan.offers_many', { n: offers.length })}</p>
            {offers.map((m) => <Offer key={m.id} trip={trip} m={m} onChange={onChange} />)}
          </div>
        ) : <Looking />}

      {set && !goneMine ? null : (
        <div className="flex flex-wrap gap-2 border-t border-(--ev-line) pt-3">
          <Button size="sm" variant={goneMine ? 'primary' : undefined} onClick={onEdit}>{goneMine ? t('logan.add_new_flight') : tt('change')}</Button>
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

/** "1 hr 5 min" in the page's language. */
function lateText(min: number, t: T<LoganKey>): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? t('logan.late_min', { n: m }) : m === 0 ? t('logan.late_hr', { h }) : t('logan.late_hr_min', { h, m })
}

const GONE = new Set(['Canceled', 'CanceledUncertain', 'Diverted'])

/** What the last check said, when it's news: "Now lands 6:40 PM, 35 min late." or "Canceled." */
function flightNow(sched: string, expected: string | null, status: string | null, out: boolean, t: T<LoganKey>, locale: SiteLocale): string | null {
  if (status && GONE.has(status)) return t('logan.flight_canceled')
  if (!expected) return null
  const late = Math.round((new Date(expected).getTime() - new Date(sched).getTime()) / 60_000)
  if (late < 10) return null
  return t(out ? 'logan.now_leaves' : 'logan.now_lands', { time: clockText(expected, locale), late: lateText(late, t) })
}

/** Why the plan became "go on your own": who said so, or whose flight. */
function whoseGo(trip: LoganTrip, m: LoganMatch): 'i_said' | 'they_said' | 'my_flight' | 'their_flight' {
  if (m.late_minutes === 30 && m.late_mine != null) return m.late_mine ? 'i_said' : 'they_said'
  if (trip.flight_status && GONE.has(trip.flight_status)) return 'my_flight'
  if (m.other.flight_status && GONE.has(m.other.flight_status)) return 'their_flight'
  const lateBy = (sched: string, exp: string | null) => (exp ? new Date(exp).getTime() - new Date(sched).getTime() : 0)
  return lateBy(trip.trip_at, trip.flight_expected_at) > lateBy(m.other.trip_at, m.other.expected_at) ? 'my_flight' : 'their_flight'
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
  const gone = m.delay_state === 'go_ahead'
  const mineWatched = !!trip.flight
  const theirsWatched = !!m.other.watched
  const watch = mineWatched && theirsWatched ? t('logan.watch_both')
    : theirsWatched ? t('logan.watch_theirs', { name }) : mineWatched ? t('logan.watch_mine', { name }) : null

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

  if (gone) {
    const why = whoseGo(trip, m)
    return (
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} url={m.other.avatar_url} size={48} />
          <p className="text-[18px] font-bold leading-snug">{full}</p>
        </div>
        <Notice tone="warn">
          <span className="text-[16px] leading-snug">
            {why === 'i_said' ? t('logan.go_i_said', { name }) : why === 'they_said' ? t('logan.go_they_said', { name })
              : why === 'my_flight' ? t('logan.go_my_flight', { name }) : t('logan.go_their_flight', { name })}
          </span>
        </Notice>
        {m.other.email ? (
          <a href={`mailto:${m.other.email}`} className="inline-flex min-h-[44px] items-center gap-2 text-[16px] font-semibold text-(--ev-accent) underline">
            <Mail className="h-5 w-5" aria-hidden /> {m.other.email}
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={m.other.avatar_url} size={48} />
        <p className="text-[18px] font-bold leading-snug">{t('logan.going_with', { name: full })}</p>
      </div>
      <div className="rounded-2xl bg-(--ev-panel) p-4">
        <p className="text-[19px] font-extrabold leading-snug">{planLine(trip, m, t, locale)}</p>
        {m.delay_state === 'moved' && m.orig_meet_at ? (
          <p className="mt-2 flex items-start gap-2 text-[15px] font-semibold leading-snug">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />
            {t('logan.moved_note', { time: clockText(m.orig_meet_at, locale) })}
          </p>
        ) : null}
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
        {watch ? <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">{watch}</p> : null}
      </div>
      <RunningLate m={m} name={name} onChange={onChange} />
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

/**
 * On the day (6 hours before to 2 hours after meeting): "About 10 min",
 * "About 20 min" or "Go without me"; the other person is emailed at once
 * (airport_running_late). Before then, a line saying it will be here.
 */
function RunningLate({ m, name, onChange }: { m: LoganMatch; name: string; onChange: () => Promise<void> }) {
  const { t, locale } = useWords()
  const [busy, setBusy] = useState<10 | 20 | 30 | null>(null)
  const [failed, setFailed] = useState(false)
  const meet = new Date(m.meet_at).getTime()
  const [nowMs] = useState(() => Date.now())
  const open = nowMs >= meet - 6 * 3600_000 && nowMs <= meet + 2 * 3600_000
  const theirs = m.late_mine === false && (m.late_minutes === 10 || m.late_minutes === 20) ? m.late_minutes : null
  const mine = m.late_mine === true && (m.late_minutes === 10 || m.late_minutes === 20) ? m.late_minutes : null

  async function tell(min: 10 | 20 | 30) {
    if (min === 30 && !window.confirm(t('logan.late_go_confirm', { name }))) return
    setBusy(min)
    setFailed(false)
    const ok = await runningLate(m.id, min)
    track('together_logan_running_late', { minutes: min, ok })
    if (!ok) setFailed(true)
    await onChange()
    setBusy(null)
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {theirs ? (
        <Notice tone="warn">
          <span className="text-[16px] leading-snug">
            {t('logan.late_theirs', { name, n: theirs, time: clockText(new Date(meet + theirs * 60_000).toISOString(), locale) })}
          </span>
        </Notice>
      ) : null}
      {open ? (
        <div>
          <p className="mb-2 text-[16px] font-bold">{t('logan.late_q')}</p>
          <div className="flex flex-wrap gap-2">
            <Button busy={busy === 10} onClick={() => void tell(10)}>{t('logan.late_10')}</Button>
            <Button busy={busy === 20} onClick={() => void tell(20)}>{t('logan.late_20')}</Button>
            <Button variant="ghost" busy={busy === 30} onClick={() => void tell(30)}>{t('logan.late_go')}</Button>
          </div>
          {mine ? <p className="mt-2 text-[15px] leading-snug" role="status">{t('logan.late_mine', { name, n: mine })}</p> : null}
          {failed ? <p className="mt-2 text-[15px] leading-snug" role="alert">{t('logan.late_failed', { name })}</p> : null}
        </div>
      ) : nowMs < meet ? (
        <p className="text-[15px] leading-snug text-(--ev-ink-80)">{t('logan.late_later', { name })}</p>
      ) : null}
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
