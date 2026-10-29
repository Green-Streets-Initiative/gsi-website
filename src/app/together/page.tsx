'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Bike, Car, CheckCircle2, Sprout, UsersRound, type LucideIcon } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import NextSteps from '@/components/together/NextSteps'
import { Chip, WAY_ICON } from '@/components/together/bits'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Input, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import {
  DAYS, LANGUAGES, SLOTS, TERMS_TEXT, TIMES, WAYS, acceptTerms, clock, hasAcceptedTerms, isSlot, isWay, myPlaces, mySignUps,
  saveExtras, savePlace, saveSignUp, slotsText, stopSignUp, track, waysText,
  type CarpoolRole, type PartnerDay, type PartnerKind, type PartnerLanguage, type PartnerRequest, type PartnerTime, type PartnerWay,
  type PracticeRequest, type PracticeSlot,
} from '@/lib/together'

/**
 * gogreenstreets.org/together: sign up for Shift Together on the web (Phase A,
 * Keith 2026-10-27). The app's sign-up (partner-request.tsx) on one screen, in
 * the app's words: what you'd like to do, your ways, your trip, when, and the
 * basics. Expo sign-ups who sign in with the same email see their sheet's
 * choices filled in and add their trip. Once saved, the page says what
 * happens next and what to do while Shift looks.
 */

const KINDS: { id: PartnerKind; title: string; hint: string; Icon: LucideIcon }[] = [
  { id: 'newcomer', title: 'Have someone show you how to bike, walk or take transit', hint: 'A neighbor who knows the way goes with you the first time.', Icon: Sprout },
  { id: 'guide', title: 'Show someone how you bike, walk or take transit', hint: 'Go with a neighbor the first time they try a new way to get somewhere.', Icon: UsersRound },
  { id: 'carpool', title: 'Find a carpool partner', hint: 'Share the drive with someone who lives near you and works near your work.', Icon: Car },
]
const KIND_ICON: Record<PartnerKind, LucideIcon> = { newcomer: Sprout, guide: UsersRound, carpool: Car }
const KIND_LABEL: Record<PartnerKind, string> = { newcomer: 'Someone to show me how', guide: 'Showing someone how', carpool: 'Sharing a drive' }
const ROLES: { id: CarpoolRole; label: string }[] = [
  { id: 'driver', label: "I'd drive" }, { id: 'rider', label: "I'd ride along" }, { id: 'either', label: 'Either' },
]
const COPY: Record<PartnerKind, { ways: string; trip: string; note: string; submit: string; privacy: string; doneTitle: string; doneBody: (ways: PartnerWay[]) => string }> = {
  newcomer: {
    ways: 'What would you like to try?',
    trip: 'Which trip?',
    note: 'For example: I’d like to try the bus from Union Square to work.',
    submit: 'Find someone to go with',
    privacy: 'You each see the other’s email only after you both say yes.',
    doneTitle: 'Thanks, you’re signed up',
    doneBody: (w) => `We’ll email you when we find someone who lives near you, already ${waysText(w, 'does')}, and can go with you.`,
  },
  guide: {
    ways: 'How do you get around?',
    trip: 'Your home, and a trip you make',
    note: 'For example: I bike from Somerville to Kendall most weekdays.',
    submit: 'Count me in',
    privacy: 'You each see the other’s email only after you both say yes.',
    doneTitle: 'Thank you',
    doneBody: (w) => `We’ll email you when someone who lives near you wants to start ${waysText(w, 'ing')}. You decide whether to say yes.`,
  },
  carpool: {
    ways: '',
    trip: 'Your trip to work',
    note: 'For example: I could pick someone up along Route 9.',
    submit: 'Find a carpool partner',
    privacy: 'Your answers stay private. Emails are shared only after you both say yes.',
    doneTitle: 'Thanks, you’re signed up',
    doneBody: () => 'We’ll email you when Shift finds someone who lives near you, works near your work and keeps similar hours.',
  },
}

/** "Weekdays · Morning", "Mon, Wed · Evening". */
function whenLabel(days: PartnerDay[], times: PartnerTime[]): string {
  const d = days.length === 7 ? 'Every day'
    : days.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((x) => days.includes(x as PartnerDay)) ? 'Weekdays'
      : DAYS.filter((x) => days.includes(x.id)).map((x) => x.label).join(', ')
  const t = TIMES.filter((x) => times.includes(x.id)).map((x) => x.label).join(', ')
  return [d, t].filter(Boolean).join(' · ')
}

type PlacePick = { address: string; lat: number | null; lng: number | null; placeId: string | null }
const emptyPlace: PlacePick = { address: '', lat: null, lng: null, placeId: null }

/** How far a guide would go with someone (Shift 01504: 5 unless they say, 1 to 20 allowed). */
const GUIDE_MILES = [2, 3, 5, 8]
const GUIDE_MILES_DEFAULT = 5
/** A new newcomer sign-up offers a calm weekend first trip unless they untick it (Keith 2026-10-29). */
const NEWCOMER_SLOTS: PracticeSlot[] = ['weekend_morning', 'weekend_afternoon']

export default function TogetherPage() {
  const { userId } = useTogether()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PartnerRequest[]>([])
  const [editing, setEditing] = useState(false)
  const [termsDone, setTermsDone] = useState(false)

  const [kind, setKind] = useState<PartnerKind | null>(null)
  const [ways, setWays] = useState<PartnerWay[]>([])
  const [role, setRole] = useState<CarpoolRole>('either')
  const [home, setHome] = useState<PlacePick>(emptyPlace)
  const [work, setWork] = useState<PlacePick>(emptyPlace)
  const [days, setDays] = useState<PartnerDay[]>(['mon', 'tue', 'wed', 'thu', 'fri'])
  const [times, setTimes] = useState<PartnerTime[]>(['morning'])
  const [arriveBy, setArriveBy] = useState('')
  const [leaveAt, setLeaveAt] = useState('')
  const [note, setNote] = useState('')
  const [languages, setLanguages] = useState<PartnerLanguage[]>(['en'])
  const [slots, setSlots] = useState<PracticeSlot[]>([])
  const [maxMiles, setMaxMiles] = useState(GUIDE_MILES_DEFAULT)
  const [savedWork, setSavedWork] = useState<PlacePick | null>(null)
  const [practice, setPractice] = useState<PracticeRequest | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ kind: PartnerKind; ways: PartnerWay[]; matches: number } | null>(null)
  const [fromExpo, setFromExpo] = useState(false)
  const [stopping, setStopping] = useState<PartnerKind | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const [signUps, places, terms] = await Promise.all([
      mySignUps().catch(() => ({ trips: [] as PartnerRequest[], practice: null })), myPlaces(userId), hasAcceptedTerms(userId),
    ])
    const reqs = signUps.trips
    setRequests(reqs.filter((r) => r.status !== 'closed'))
    setPractice(signUps.practice && signUps.practice.status !== 'closed' ? signUps.practice : null)
    setTermsDone(terms)
    const h = places.find((p) => p.label === 'Home')
    const w = places.find((p) => p.label === 'Work')
    if (h) setHome({ address: h.address_text ?? '', lat: h.lat, lng: h.lng, placeId: null })
    if (w) {
      const wp = { address: w.address_text ?? '', lat: w.lat, lng: w.lng, placeId: null }
      setWork(wp)
      setSavedWork(wp)
    }
    // A paper sign-up (the Expo) has the choices but no trip: start from it.
    const paper = reqs.find((r) => r.source === 'event_signup' && !r.origin_location_id && r.status !== 'closed')
    if (paper) {
      setFromExpo(true)
      setEditing(true)
      setKind(paper.kind)
      setWays(paper.modes.filter(isWay))
      // The sheet never asked about other times: start from the usual default.
      setSlots(paper.kind === 'newcomer' ? NEWCOMER_SLOTS : [])
      if (paper.note) setNote(paper.note)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const pickKind = (k: PartnerKind) => {
    const first = kind == null
    setKind(k)
    setErr(null)
    // The details open below the three choices: bring them into view on a phone.
    if (first && window.innerWidth < 640) {
      requestAnimationFrame(() => document.getElementById('together-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    // Signed up for this already: start from those answers.
    const r = requests.find((x) => x.kind === k)
    if (r) fill(r)
    else {
      setSlots(k === 'newcomer' ? NEWCOMER_SLOTS : [])
      setMaxMiles(GUIDE_MILES_DEFAULT)
      if (savedWork && work.lat == null) setWork(savedWork)
    }
  }

  const fill = (r: PartnerRequest) => {
    setWays(r.modes.filter(isWay))
    setSlots((r.practice_slots ?? []).filter(isSlot))
    setMaxMiles(r.guide_max_miles != null ? Number(r.guide_max_miles) : GUIDE_MILES_DEFAULT)
    // A guide who signed up without a trip keeps it that way; any other sign-up starts from their saved Work.
    if (r.kind === 'guide' && !r.destination_location_id) setWork(emptyPlace)
    else if (savedWork && work.lat == null) setWork(savedWork)
    if (r.days?.length) setDays(r.days)
    if (r.time_of_day?.length) setTimes(r.time_of_day)
    if (r.carpool_role) setRole(r.carpool_role)
    setArriveBy(r.arrive_by?.slice(0, 5) ?? '')
    setLeaveAt(r.leave_at?.slice(0, 5) ?? '')
    setNote(r.note ?? '')
    if (r.languages?.length) setLanguages(r.languages)
  }

  const startEdit = (r?: PartnerRequest) => {
    setSaved(null)
    setErr(null)
    setEditing(true)
    setKind(r?.kind ?? null)
    if (r) fill(r)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!userId || !kind) return
    if (kind !== 'carpool' && ways.length === 0) return setErr(kind === 'guide' ? 'Pick at least one way you get around.' : 'Pick at least one way you’d like to try.')
    // A guide needs only Home (Shift 01504); a Work they typed must still be picked from the list.
    const workOptional = kind === 'guide' && !work.address.trim()
    if (home.lat == null || (work.lat == null && !workOptional)) {
      return setErr(kind === 'guide' ? 'Pick your places from the suggestions as you type.' : 'Pick both places from the suggestions as you type.')
    }
    if (days.length === 0 || times.length === 0) return setErr('Pick the days and times you usually go.')
    if (kind === 'carpool' && !arriveBy) return setErr('Add when you get to work, so Shift matches you with someone on your schedule.')
    if (!termsDone && !agreed) return setErr('Please check the box at the bottom to continue.')
    setBusy(true)
    setErr(null)
    try {
      if (!termsDone) {
        await acceptTerms()
        setTermsDone(true)
      }
      const [homeId, workId] = await Promise.all([
        savePlace(userId, { label: 'Home', address: home.address, lat: home.lat!, lng: home.lng!, placeId: home.placeId }),
        workOptional ? Promise.resolve(null) : savePlace(userId, { label: 'Work', address: work.address, lat: work.lat!, lng: work.lng!, placeId: work.placeId }),
      ])
      const r = await saveSignUp({
        kind, modes: kind === 'carpool' ? [] : ways, homeId, workId, days, times,
        carpoolRole: kind === 'carpool' ? role : null,
        arriveBy: kind === 'carpool' ? arriveBy || null : null,
        leaveAt: kind === 'carpool' ? leaveAt || null : null,
        note: note.trim() || null,
        languages,
      })
      if (!r.ok) {
        setErr('That didn’t save. Please try again.')
        track('together_signup_failed', { kind, reason: r.reason })
        return
      }
      // Other times, and how far a guide would go: saved on the sign-up just made, then matching runs again.
      let matches = r.matches
      if (kind !== 'carpool') {
        const x = await saveExtras(kind, slots, kind === 'guide' ? maxMiles : null)
        if (!x.ok) {
          setErr('Your sign-up saved, but your other times didn’t. Please try again.')
          track('together_extras_failed', { kind, reason: x.reason })
          await load()
          return
        }
        matches += x.matches
      }
      track('together_signup_saved', { kind, ways, languages, slots, max_miles: kind === 'guide' ? maxMiles : null, no_work: workOptional, matches, from_expo: fromExpo })
      setSaved({ kind, ways: kind === 'carpool' ? [] : ways, matches })
      setEditing(false)
      setFromExpo(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await load()
    } catch {
      setErr('That didn’t save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function stop(k: PartnerKind) {
    if (await stopSignUp(k)) {
      track('together_signup_stopped', { kind: k })
      setStopping(null)
      setSaved(null)
      await load()
    }
  }

  if (loading) return <Spinner label="Opening your sign-up" />
  const showForm = editing || (requests.length === 0 && !practice)
  const copy = kind ? COPY[kind] : null
  const milesChoices = GUIDE_MILES.includes(maxMiles) ? GUIDE_MILES : [...GUIDE_MILES, maxMiles].sort((a, b) => a - b)
  // What to suggest while waiting: the newest sign-up's kind and ways.
  const latest = saved ?? (requests[0] ? { kind: requests[0].kind, ways: requests[0].modes.filter(isWay), matches: 0 } : null)

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm ? 1 : 2} />

      {saved && saved.matches > 0 ? <Saved kind={saved.kind} matches={saved.matches} /> : null}

      {!showForm && (
        <Card>
          {/* Just saved with no match yet: the thank-you is the heading, so nothing says it twice. */}
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? COPY[saved.kind].doneTitle : 'You\u2019re signed up'}
          </h1>
          {saved && saved.matches === 0 ? <p className="mt-1 text-[16px] text-(--ev-ink-85)">{COPY[saved.kind].doneBody(saved.ways)}</p> : null}
          <ul className="mt-4 grid gap-3">
            {requests.map((r) => {
              const Icon = KIND_ICON[r.kind]
              const rWays = r.modes.filter(isWay)
              return (
                <li key={r.id} className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ev-accent-fill) text-(--ev-on-accent-fill)" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-bold">{KIND_LABEL[r.kind]}</p>
                      <p className="text-[15px] text-(--ev-ink-80)">{whenLabel(r.days ?? [], r.time_of_day ?? [])}{r.arrive_by ? ` · by ${clock(r.arrive_by)}` : ''}</p>
                    </div>
                    <Badge tone={r.status === 'matched' ? 'good' : 'info'}>{r.status === 'matched' ? 'Matched' : 'Looking'}</Badge>
                  </div>
                  {rWays.length ? (
                    <div className="flex flex-wrap gap-2">
                      {rWays.map((w) => {
                        const WI = WAY_ICON[w]
                        return (
                          <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-semibold">
                            <WI className="h-4 w-4" aria-hidden /> {WAYS.find((x) => x.id === w)?.label}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                  {stopping === r.kind ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--ev-panel) p-3">
                      <span className="text-[15px] font-semibold">Stop looking? You can sign up again anytime.</span>
                      <Button size="sm" onClick={() => void stop(r.kind)}>Yes, stop</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStopping(null)}>Keep it</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => startEdit(r)}>Change</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStopping(r.kind)}>{r.kind === 'guide' ? 'Stop offering' : 'Stop looking'}</Button>
                    </div>
                  )}
                </li>
              )
            })}
            {practice ? (
              <li className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ev-accent-fill) text-(--ev-on-accent-fill)" aria-hidden>
                    <Bike className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold">A practice ride near home</p>
                    <p className="text-[15px] text-(--ev-ink-80)">
                      {[practice.practice_label ?? 'Quiet streets near home', slotsText((practice.practice_slots ?? []).filter(isSlot))].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge tone={practice.status === 'matched' ? 'good' : 'info'}>{practice.status === 'matched' ? 'Matched' : 'Looking'}</Badge>
                </div>
                <div>
                  <Link href="/together/practice" className="inline-flex min-h-[36px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-3 text-[14px] font-semibold hover:bg-(--ev-panel)">Change</Link>
                </div>
              </li>
            ) : null}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/together/matches" className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold">See your matches</Link>
            {requests.length < 3 ? <Button onClick={() => startEdit()}>Sign up for something else</Button> : null}
          </div>
        </Card>
      )}

      {!showForm && latest && latest.matches === 0 ? <NextSteps kind={latest.kind} ways={latest.ways} source="saved" /> : null}

      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">What would you like to do?</h1>
            {fromExpo ? (
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">
                You signed up for Tag Along at the Somerville Connection Expo. Add your trip below so we can find a good match.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="What would you like to do?">
            {KINDS.map(({ id, title, hint, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                onClick={() => pickKind(id)}
                aria-checked={kind === id}
                className={cx(
                  'flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition sm:flex-col sm:gap-2',
                  kind === id ? 'border-(--ev-accent) ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line-strong) hover:bg-(--ev-panel)',
                )}
              >
                <span
                  className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', kind === id ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-accent)')}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="grid grid-cols-1 gap-1">
                  <span className="text-[17px] font-bold leading-snug">{title}</span>
                  <span className="text-[15px] leading-snug text-(--ev-ink-80)">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          {kind && copy && (
            <Card id="together-details" className="scroll-mt-[76px] grid grid-cols-1 gap-6">
              {kind === 'newcomer' && !practice ? (
                <p className="rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
                  Rather start with an easy practice ride near home?{' '}
                  <Link href="/together/practice" onClick={() => track('together_practice_link', { from: 'newcomer_form' })} className="font-semibold text-(--ev-accent) underline">
                    Ask for a practice ride
                  </Link>
                </p>
              ) : null}
              {kind === 'carpool' ? (
                <Field label="Would you drive, ride along, or either?">
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => <Chip key={r.id} on={role === r.id} onClick={() => setRole(r.id)}>{r.label}</Chip>)}
                  </div>
                </Field>
              ) : (
                <Field label={copy.ways} hint="Pick any that fit.">
                  <div className="flex flex-wrap gap-2">
                    {WAYS.map((w) => {
                      const Icon = WAY_ICON[w.id]
                      return (
                        <Chip key={w.id} on={ways.includes(w.id)} onClick={() => setWays((v) => (v.includes(w.id) ? v.filter((x) => x !== w.id) : [...v, w.id]))}>
                          <Icon className="h-4 w-4" aria-hidden /> {w.label}
                        </Chip>
                      )
                    })}
                  </div>
                </Field>
              )}

              <fieldset className="grid grid-cols-1 gap-3">
                <legend className="mb-1 text-[16px] font-bold">{copy.trip}</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="From home" hint="Only used to find someone nearby.">
                    <AddressAutocomplete
                      value={home.address}
                      onChange={(a) => setHome({ address: a, lat: null, lng: null, placeId: null })}
                      onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                      label={null}
                      placeholder="Your street address"
                    />
                  </Field>
                  <Field
                    label={kind === 'guide' ? 'Where you go' : 'To work or school'}
                    optional={kind === 'guide'}
                    hint={kind === 'guide' ? 'If you make a trip yourself, people who make a trip like it see you first.' : 'Where the trip goes.'}
                  >
                    <AddressAutocomplete
                      value={work.address}
                      onChange={(a) => setWork({ address: a, lat: null, lng: null, placeId: null })}
                      onPlaceSelected={(p) => setWork({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                      label={null}
                      placeholder="Address or place name"
                    />
                  </Field>
                </div>
              </fieldset>

              {kind === 'guide' ? (
                <Field label="How far would you go with someone?" hint="The longest trip you’d make with them, from near your home.">
                  <div className="flex flex-wrap gap-2">
                    {milesChoices.map((m) => <Chip key={m} on={maxMiles === m} onClick={() => setMaxMiles(m)}>{m} miles</Chip>)}
                  </div>
                </Field>
              ) : null}

              <div className="grid grid-cols-1 gap-5">
                <Field label={kind === 'carpool' ? 'Which days do you go in?' : kind === 'guide' ? 'Which days could you go?' : 'Which days?'}>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => <Chip key={d.id} on={days.includes(d.id)} onClick={() => setDays((v) => (v.includes(d.id) ? v.filter((x) => x !== d.id) : [...v, d.id]))}>{d.label}</Chip>)}
                  </div>
                </Field>
                <Field label="What time of day?">
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => <Chip key={t.id} on={times.includes(t.id)} onClick={() => setTimes((v) => (v.includes(t.id) ? v.filter((x) => x !== t.id) : [...v, t.id]))}>{t.label}</Chip>)}
                  </div>
                </Field>
                {kind !== 'carpool' ? (
                  <Field
                    label={kind === 'guide' ? 'Other times you’re free' : 'Or a first trip at a quieter time'}
                    optional
                    hint={kind === 'guide'
                      ? 'For a first trip on a weekend or evening instead of rush hour. If you bike, also for an easy practice ride near home.'
                      : 'Someone may be free then, even if not at your usual time.'}
                  >
                    <div className="flex flex-wrap gap-2">
                      {SLOTS.map((s) => <Chip key={s.id} on={slots.includes(s.id)} onClick={() => setSlots((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>{s.label}</Chip>)}
                    </div>
                  </Field>
                ) : null}
              </div>

              {kind === 'carpool' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Get to work by" htmlFor="together-arrive">
                    <Input id="together-arrive" type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} />
                  </Field>
                  <Field label="Leave work at" optional htmlFor="together-leave">
                    <Input id="together-leave" type="time" value={leaveAt} onChange={(e) => setLeaveAt(e.target.value)} />
                  </Field>
                </div>
              ) : null}

              <Field label="Which languages do you speak?" hint="Someone who speaks one of these comes first. Your match sees them.">
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Chip key={l.id} on={languages.includes(l.id)} onClick={() => setLanguages((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]))}>
                      <span lang={l.id}>{l.label}</span>
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Anything else we should know?" optional htmlFor="together-note">
                <Textarea id="together-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.note} />
              </Field>

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
              <div className="grid grid-cols-1 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="primary" busy={busy}>{copy.submit}</Button>
                  {requests.length > 0 && <Button variant="ghost" onClick={() => { setEditing(false); setErr(null) }}>Cancel</Button>}
                </div>
                <p className="text-[15px] leading-snug text-(--ev-ink-80)">{copy.privacy}</p>
              </div>
            </Card>
          )}
        </form>
      )}
    </div>
  )
}

function Saved({ kind, matches }: { kind: PartnerKind; matches: number }) {
  // Carpools line up both ends of the trip; a guide only needs to live nearby (Shift 01504).
  const one = kind === 'carpool' ? 'Shift found someone who lives near you and works near your work'
    : kind === 'guide' ? 'Shift found someone near you who’d like you to show them how' : 'Shift found someone near you who can go with you'
  const many = kind === 'carpool' ? `Shift found ${matches} people who live near you and work near your work`
    : kind === 'guide' ? `Shift found ${matches} people near you who’d like you to show them how` : `Shift found ${matches} people near you who can go with you`
  return (
    <Notice tone="good">
      <span className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <span className="grid grid-cols-1 gap-1">
          <strong className="text-[17px]">{matches === 1 ? one : many}</strong>
          <span>
            Say yes to anyone you&rsquo;d like to go with.{' '}
            <Link href="/together/matches" className="font-semibold underline">See your matches</Link>
          </span>
        </span>
      </span>
    </Notice>
  )
}
