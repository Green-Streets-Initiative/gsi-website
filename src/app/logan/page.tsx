'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Mail, MessageSquare, Minus, Plane, PlaneLanding, Plus, Search } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Avatar, Chip } from '@/components/together/bits'
import { useTogether } from '@/components/together/TogetherShell'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import { acceptTerms, myPlaces, TERMS_TEXT, track } from '@/lib/together'
import {
  answer, bostonInstant, bostonParts, clockText, dayText, leaveMatch, myTrips, saveTrip, setPhone, stopTrip,
  type LoganMatch, type LoganTrip, type Terminal, type TripKind, type TripWay,
} from '@/lib/logan'

/**
 * gogreenstreets.org/logan (Shift 01518, Keith 2026-10-30: "I'd much rather
 * run Logan around Thanksgiving and December holidays"). Designed simple
 * from the start (Keith, same day): one short form with everything but the
 * flight and the place filled in, then one card per trip that leads with the
 * outcome (the plan, or the people to say yes to, or that we're looking).
 */

type Place = { address: string; lat: number | null; lng: number | null }
const noPlace: Place = { address: '', lat: null, lng: null }

const WAYS_LOGAN: { id: TripWay; label: string }[] = [
  { id: 'either', label: 'Either' },
  { id: 'transit', label: 'The T together' },
  { id: 'split', label: 'Share a taxi or ride app' },
]
const TERMINALS: Terminal[] = ['A', 'B', 'C', 'E']

export default function LoganPage() {
  const { userId } = useTogether()
  const [trips, setTrips] = useState<LoganTrip[] | null>(null)
  const [terms, setTerms] = useState(false)
  const [editing, setEditing] = useState<TripKind | 'new' | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await myTrips()
      setTrips(r.trips)
      setTerms(r.terms)
    } catch {
      setErr("We couldn't load your trips. Refresh to try again.")
    }
  }, [])
  useEffect(() => {
    let live = true
    myTrips()
      .then((r) => { if (live) { setTrips(r.trips); setTerms(r.terms) } })
      .catch(() => { if (live) setErr("We couldn't load your trips. Refresh to try again.") })
    track('together_logan_viewed')
    return () => { live = false }
  }, [])

  if (err) return <Notice tone="off">{err}</Notice>
  if (!trips || !userId) return <Spinner label="Loading your trips" />

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

  const has = (k: TripKind) => trips.some((t) => t.kind === k)
  return (
    <div className="grid grid-cols-1 gap-5">
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">Your Logan trips</h1>
      {flash != null ? (
        <Notice tone="good" onClose={() => setFlash(null)}>
          <span className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <span className="text-[16px]">
              {flash > 0
                ? <><strong>We found {flash === 1 ? 'someone' : `${flash} people`} going when you are.</strong> Say yes below to go together.</>
                : <><strong>You’re signed up.</strong> We’ll email you as soon as someone near you signs up for the same time.</>}
            </span>
          </span>
        </Notice>
      ) : null}
      {trips.map((t) => <TripCard key={t.id} trip={t} onChange={load} onEdit={() => setEditing(t.kind)} />)}
      {!has('airport_out') || !has('airport_back') ? (
        <div>
          <Button onClick={() => setEditing('new')}>
            {has('airport_out') ? 'Add your trip home from Logan' : 'Add your trip to Logan'}
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
  const out = trips.find((t) => t.kind === 'airport_out')
  const back = trips.find((t) => t.kind === 'airport_back')
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
    if (goOut && !outAt) return setErr('Add the date and time your flight leaves.')
    if (goBack && !backAt) return setErr('Add the date and time your flight lands.')
    if (place.lat == null || place.lng == null) return setErr('Pick where you live from the list.')
    if (!termsDone && !agreed) return setErr('Check the box to agree first.')
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
          setErr(r.reason)
          setBusy(false)
          return
        }
        matches += r.matches
      }
      track('together_logan_saved', { which, way, party, matches })
      onSaved(matches)
    } catch {
      setErr("We couldn't save that. Try again in a minute.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">Your flight</h1>
        <p className="mt-2 text-[16px] leading-snug text-(--ev-ink-85)">
          We’ll find someone near you who’s at the airport when you are, and work out where and when to meet.
        </p>
      </div>
      <Card className="grid grid-cols-1 gap-6">
        {only ? null : (
          <Field label="Which trip?">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which trip?">
              <Chip on={which === 'out'} onClick={() => setWhich('out')} role="radio" aria-checked={which === 'out'}><Plane className="h-4 w-4" aria-hidden /> Going to Logan</Chip>
              <Chip on={which === 'back'} onClick={() => setWhich('back')} role="radio" aria-checked={which === 'back'}><PlaneLanding className="h-4 w-4" aria-hidden /> Coming home</Chip>
              <Chip on={which === 'both'} onClick={() => setWhich('both')} role="radio" aria-checked={which === 'both'}>Both</Chip>
            </div>
          </Field>
        )}

        {goOut ? (
          <fieldset className="grid grid-cols-1 gap-3">
            <legend className="mb-1 text-[16px] font-bold">When does your flight leave?</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
              <Input type="date" aria-label="Date your flight leaves" min={today} value={outDate} onChange={(e) => setOutDate(e.target.value)} />
              <Input type="time" aria-label="Time your flight leaves" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
            </div>
            <Check checked={outIntl} onChange={setOutIntl} label="International flight (we’ll plan three hours, not two)" />
          </fieldset>
        ) : null}

        {goBack ? (
          <fieldset className="grid grid-cols-1 gap-3">
            <legend className="mb-1 text-[16px] font-bold">When does your flight home land?</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
              <Input type="date" aria-label="Date your flight lands" min={outDate || today} value={backDate} onChange={(e) => setBackDate(e.target.value)} />
              <Input type="time" aria-label="Time your flight lands" value={backTime} onChange={(e) => setBackTime(e.target.value)} />
            </div>
            <Check checked={backIntl} onChange={setBackIntl} label="International flight (customs takes longer)" />
            <div>
              <p className="mb-2 text-[15px] font-semibold">Which terminal? <span className="font-normal text-(--ev-ink-75)">It’s in your airline’s app.</span></p>
              <div className="flex flex-wrap gap-2">
                {TERMINALS.map((x) => <Chip key={x} on={terminal === x} onClick={() => setTerminal(x)}>{x}</Chip>)}
                <Chip on={terminal === null} onClick={() => setTerminal(null)}>Not sure</Chip>
              </div>
            </div>
          </fieldset>
        ) : null}

        <Field label={which === 'out' ? 'Where are you leaving from?' : which === 'back' ? 'Where are you headed home to?' : 'Where do you live?'} hint="Your match sees only the town.">
          <AddressAutocomplete
            value={place.address}
            onChange={(a) => setPlace({ address: a, lat: null, lng: null })}
            onPlaceSelected={(p) => setPlace({ address: p.address, lat: p.lat, lng: p.lng })}
            label={null}
            includeAreas
            placeholder="Your address or neighborhood"
          />
        </Field>

        <Field
          label="How would you like to go?"
          hint={way === 'split' ? 'You split the fare: one of you books, the other pays them back. Green Streets handles no payments.'
            : way === 'transit' ? 'Each of you pays your own fare.' : 'Either gives you the most people to match with.'}
        >
          <div className="flex flex-wrap gap-2">
            {WAYS_LOGAN.map((w) => <Chip key={w.id} on={way === w.id} onClick={() => setWay(w.id)}>{w.label}</Chip>)}
          </div>
        </Field>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Stepper label="People in your group" value={party} min={1} max={6} onChange={setParty} />
          {way !== 'transit' ? <Stepper label="Big bags" value={bags} min={0} max={8} onChange={setBags} /> : null}
        </div>

        {!termsDone && (
          <label className="flex items-start gap-3 rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {TERMS_TEXT}{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">Terms</a>
            </span>
          </label>
        )}
        {err ? <Notice tone="off">{err}</Notice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" busy={busy}>Find someone to go with</Button>
          {onCancel ? <Button variant="ghost" onClick={onCancel}>Cancel</Button> : null}
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

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white disabled:opacity-40">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-6 text-center text-[18px] font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-(--ev-line-strong) bg-white disabled:opacity-40">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- a trip card */

function TripCard({ trip, onChange, onEdit }: { trip: LoganTrip; onChange: () => Promise<void>; onEdit: () => void }) {
  const outbound = trip.kind === 'airport_out'
  const set = trip.matches.find((m) => m.status !== 'proposed')
  const offers = trip.matches.filter((m) => m.status === 'proposed')
  const [busy, setBusy] = useState(false)
  const Icon = outbound ? Plane : PlaneLanding

  async function notGoing() {
    if (!window.confirm(outbound ? 'Take your trip to Logan off?' : 'Take your trip home off?')) return
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
            {outbound ? 'To Logan' : 'Home from Logan'}, {dayText(trip.trip_at)}
          </h2>
          <p className="text-[15px] text-(--ev-ink-80)">
            {outbound
              ? `Flight at ${clockText(trip.trip_at)}. Be at the airport by ${clockText(trip.at_airport)}.`
              : `Lands at ${clockText(trip.trip_at)}${trip.terminal ? `, Terminal ${trip.terminal}` : ''}.`}
          </p>
        </div>
      </div>

      {set ? <Plan trip={trip} m={set} onChange={onChange} />
        : offers.length ? (
          <div className="grid grid-cols-1 gap-3">
            <p className="text-[17px] font-bold">{offers.length === 1 ? 'Someone could go with you' : `${offers.length} people could go with you`}</p>
            {offers.map((m) => <Offer key={m.id} trip={trip} m={m} onChange={onChange} />)}
          </div>
        ) : <Looking />}

      {set ? null : (
        <div className="flex flex-wrap gap-2 border-t border-(--ev-line) pt-3">
          <Button size="sm" onClick={onEdit}>Change</Button>
          <Button size="sm" variant="ghost" busy={busy} onClick={() => void notGoing()}>Not going</Button>
        </div>
      )}
    </Card>
  )
}

/** The plan in one line: where, when, how. */
function planLine(trip: LoganTrip, m: LoganMatch): string {
  const how = trip.kind === 'airport_out'
    ? (m.way === 'split' ? 'share a taxi or ride app, splitting the fare' : 'take the T together')
    : (m.way === 'split' ? 'share a ride home, splitting the fare' : 'take the T home together')
  if (trip.kind === 'airport_out') return `Meet at ${m.meet_station} at ${clockText(m.meet_at)} and ${how}.`
  if (m.way === 'transit' && m.meet_place?.startsWith('the same')) return `Ride ${m.meet_place} together, about ${clockText(m.meet_at)}.`
  return `Meet at ${m.meet_place} about ${clockText(m.meet_at)} and ${how}.`
}

/** "within 20 minutes of you", from when each wants to be there or lands. */
function gapLine(trip: LoganTrip, m: LoganMatch): string {
  const theirs = new Date(m.other.trip_at).getTime() - (trip.kind === 'airport_out' ? (m.other.international ? 3 : 2) * 3600_000 : 0)
  const mine = new Date(trip.kind === 'airport_out' ? trip.at_airport : trip.trip_at).getTime()
  const min = Math.round((theirs - mine) / 60_000)
  const verb = trip.kind === 'airport_out' ? 'At the airport' : 'Lands'
  if (Math.abs(min) <= 5) return `${verb} about when you ${trip.kind === 'airport_out' ? 'are' : 'do'}`
  return `${verb} ${Math.abs(min)} minutes ${min > 0 ? 'after' : 'before'} you`
}

function Offer({ trip, m, onChange }: { trip: LoganTrip; m: LoganMatch; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const name = m.other.first_name?.trim() || 'Someone'
  async function reply(yes: boolean) {
    setBusy(yes ? 'yes' : 'no')
    await answer(m.id, yes)
    track('together_logan_answered', { yes })
    await onChange()
    setBusy(null)
  }
  const group = [m.other.party_size > 1 ? `${m.other.party_size} people` : null, m.way === 'split' && m.other.big_bags > 0 ? `${m.other.big_bags} big ${m.other.big_bags === 1 ? 'bag' : 'bags'}` : null].filter(Boolean)
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-(--ev-line-strong) bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={name} url={m.other.avatar_url} size={48} />
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug">{name}{m.other.town ? ` from ${m.other.town}` : ''}</p>
          <p className="text-[15px] leading-snug text-(--ev-ink-80)">
            {[m.miles != null ? `${Math.max(m.miles, 0.1).toFixed(1)} miles from you` : null, gapLine(trip, m), ...group].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <p className="rounded-xl bg-(--ev-panel) px-4 py-3 text-[15px] leading-snug"><strong>The plan:</strong> {planLine(trip, m)}</p>
      {m.my_answer === 'yes' ? (
        <p className="text-[15px] font-semibold">You said yes. We’ll email you when {name} answers.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" busy={busy === 'yes'} onClick={() => void reply(true)}>Go with {name}</Button>
          <Button variant="ghost" busy={busy === 'no'} onClick={() => void reply(false)}>No thanks</Button>
        </div>
      )}
    </div>
  )
}

function Plan({ trip, m, onChange }: { trip: LoganTrip; m: LoganMatch; onChange: () => Promise<void> }) {
  const name = m.other.first_name?.trim() || 'your match'
  const full = [m.other.first_name, m.other.last_initial ? `${m.other.last_initial}.` : null].filter(Boolean).join(' ') || 'your match'
  const [phone, setPhoneText] = useState(m.my_phone ? phoneText(m.my_phone) : '')
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busBoard = trip.kind === 'airport_back' && m.way === 'transit' && m.meet_place?.startsWith('the same')

  async function savePhone() {
    setBusy(true)
    const r = await setPhone(m.id, phone)
    setBusy(false)
    setSaved(r.ok ? (r.phone ? `${name} can text you at ${phoneText(r.phone)}.` : 'Number removed.') : 'That number doesn’t look right.')
  }
  async function cantGo() {
    if (!window.confirm(`Tell ${name} you can’t go together? We’ll look for someone else for both of you.`)) return
    await leaveMatch(m.id)
    track('together_logan_left')
    await onChange()
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={m.other.avatar_url} size={48} />
        <p className="text-[18px] font-bold leading-snug">You’re going with {full}</p>
      </div>
      <div className="rounded-2xl bg-(--ev-panel) p-4">
        <p className="text-[19px] font-extrabold leading-snug">{planLine(trip, m)}</p>
        {busBoard ? (
          <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
            The Silver Line stops at Terminal A, then B, C and E. Whoever’s terminal comes first gets on and texts the other which bus.
          </p>
        ) : null}
        {m.way === 'split' ? (
          <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">One of you books the car; the other pays them back their half. Agree who books before the day.</p>
        ) : null}
        <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
          If {name} isn’t there 10 minutes after that, go without them. Nobody misses a flight waiting.
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
            <MessageSquare className="h-5 w-5" aria-hidden /> Text {name} at {phoneText(m.other.phone)}
          </a>
        ) : null}
      </div>
      <Field label="Your number for the day" optional hint={`Only ${name} sees it, so you can text when you’re there.`} htmlFor={`phone-${m.id}`}>
        <div className="flex flex-wrap gap-2">
          <Input id={`phone-${m.id}`} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhoneText(e.target.value)} className="max-w-[220px]" placeholder="617 555 0100" />
          <Button busy={busy} onClick={() => void savePhone()}>Save</Button>
        </div>
      </Field>
      {saved ? <p className="text-[15px]" role="status">{saved}</p> : null}
      <div className="border-t border-(--ev-line) pt-3">
        <Button size="sm" variant="ghost" onClick={() => void cantGo()}>Can’t make it?</Button>
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
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-(--ev-panel) p-4">
      <p className="flex items-start gap-2 text-[16px] leading-snug">
        <Search className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
        <span><strong>We’re looking.</strong> We’ll email you as soon as someone near you signs up for the same time.</span>
      </p>
      <p className="text-[15px] leading-snug text-(--ev-ink-85)">
        Know someone flying around then?{' '}
        <button
          type="button"
          className={cx('font-semibold underline', copied ? 'text-(--ev-ink)' : 'text-(--ev-accent)')}
          onClick={() => {
            void navigator.clipboard?.writeText('https://www.gogreenstreets.org/logan').then(() => setCopied(true)).catch(() => {})
            track('together_logan_link_copied')
          }}
        >
          {copied ? 'Link copied' : 'Copy the link to send them'}
        </button>
      </p>
    </div>
  )
}
