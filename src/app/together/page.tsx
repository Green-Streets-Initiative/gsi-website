'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Car, CheckCircle2, Sprout, UsersRound, type LucideIcon } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import NextSteps from '@/components/together/NextSteps'
import { Chip, WAY_ICON } from '@/components/together/bits'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Input, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import {
  DAYS, TERMS_TEXT, TIMES, WAYS, acceptTerms, clock, hasAcceptedTerms, isWay, myPlaces, myRequests,
  savePlace, saveSignUp, stopSignUp, track,
  type CarpoolRole, type PartnerDay, type PartnerKind, type PartnerRequest, type PartnerTime, type PartnerWay,
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
  { id: 'newcomer', title: 'Go with someone who knows the way', hint: 'Try a new way with a neighbor the first time.', Icon: Sprout },
  { id: 'guide', title: 'Show someone the way', hint: 'Help a neighbor try a trip you already make.', Icon: UsersRound },
  { id: 'carpool', title: 'Find a carpool partner', hint: 'Share the drive with someone who goes your way.', Icon: Car },
]
const KIND_ICON: Record<PartnerKind, LucideIcon> = { newcomer: Sprout, guide: UsersRound, carpool: Car }
const KIND_LABEL: Record<PartnerKind, string> = { newcomer: 'Going with someone', guide: 'Showing the way', carpool: 'Sharing a drive' }
const ROLES: { id: CarpoolRole; label: string }[] = [
  { id: 'driver', label: "I'd drive" }, { id: 'rider', label: "I'd ride along" }, { id: 'either', label: 'Either' },
]
const COPY: Record<PartnerKind, { ways: string; trip: string; note: string; submit: string; privacy: string; doneTitle: string; doneBody: string }> = {
  newcomer: {
    ways: 'What would you like to try?',
    trip: 'Which trip?',
    note: 'For example: I’d like to try the bus from Union Square to work.',
    submit: 'Find someone to go with',
    privacy: 'You each see the other’s email only after you both say yes.',
    doneTitle: 'Thanks, you’re signed up',
    doneBody: 'We’ll email you when someone who makes this trip can show you the way.',
  },
  guide: {
    ways: 'How do you get around?',
    trip: 'Your usual trip',
    note: 'For example: I bike from Somerville to Kendall most weekdays.',
    submit: 'Count me in',
    privacy: 'You each see the other’s email only after you both say yes.',
    doneTitle: 'Thank you',
    doneBody: 'We’ll email you when someone wants to try a trip like yours. You decide whether to say yes.',
  },
  carpool: {
    ways: '',
    trip: 'Your trip to work',
    note: 'For example: I could pick someone up along Route 9.',
    submit: 'Find a carpool partner',
    privacy: 'Your answers stay private. Emails are shared only after you both say yes.',
    doneTitle: 'Thanks, you’re signed up',
    doneBody: 'We’ll email you when Shift finds someone whose drive fits yours.',
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
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ kind: PartnerKind; ways: PartnerWay[]; matches: number } | null>(null)
  const [fromExpo, setFromExpo] = useState(false)
  const [stopping, setStopping] = useState<PartnerKind | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const [reqs, places, terms] = await Promise.all([myRequests().catch(() => []), myPlaces(userId), hasAcceptedTerms(userId)])
    setRequests(reqs.filter((r) => r.status !== 'closed'))
    setTermsDone(terms)
    const h = places.find((p) => p.label === 'Home')
    const w = places.find((p) => p.label === 'Work')
    if (h) setHome({ address: h.address_text ?? '', lat: h.lat, lng: h.lng, placeId: null })
    if (w) setWork({ address: w.address_text ?? '', lat: w.lat, lng: w.lng, placeId: null })
    // A paper sign-up (the Expo) has the choices but no trip: start from it.
    const paper = reqs.find((r) => r.source === 'event_signup' && !r.origin_location_id && r.status !== 'closed')
    if (paper) {
      setFromExpo(true)
      setEditing(true)
      setKind(paper.kind)
      setWays(paper.modes.filter(isWay))
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
  }

  const fill = (r: PartnerRequest) => {
    setWays(r.modes.filter(isWay))
    if (r.days?.length) setDays(r.days)
    if (r.time_of_day?.length) setTimes(r.time_of_day)
    if (r.carpool_role) setRole(r.carpool_role)
    setArriveBy(r.arrive_by?.slice(0, 5) ?? '')
    setLeaveAt(r.leave_at?.slice(0, 5) ?? '')
    setNote(r.note ?? '')
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
    if (home.lat == null || work.lat == null) return setErr('Pick both places from the suggestions as you type.')
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
        savePlace(userId, { label: 'Work', address: work.address, lat: work.lat!, lng: work.lng!, placeId: work.placeId }),
      ])
      const r = await saveSignUp({
        kind, modes: kind === 'carpool' ? [] : ways, homeId, workId, days, times,
        carpoolRole: kind === 'carpool' ? role : null,
        arriveBy: kind === 'carpool' ? arriveBy || null : null,
        leaveAt: kind === 'carpool' ? leaveAt || null : null,
        note: note.trim() || null,
      })
      if (!r.ok) {
        setErr('That didn’t save. Please try again.')
        track('together_signup_failed', { kind, reason: r.reason })
        return
      }
      track('together_signup_saved', { kind, ways, matches: r.matches, from_expo: fromExpo })
      setSaved({ kind, ways: kind === 'carpool' ? [] : ways, matches: r.matches })
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
  const showForm = editing || requests.length === 0
  const copy = kind ? COPY[kind] : null
  // What to suggest while waiting: the newest sign-up's kind and ways.
  const latest = saved ?? (requests[0] ? { kind: requests[0].kind, ways: requests[0].modes.filter(isWay), matches: 0 } : null)

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm ? 1 : 2} />

      {saved && saved.matches > 0 ? <Saved matches={saved.matches} /> : null}

      {!showForm && (
        <Card>
          {/* Just saved with no match yet: the thank-you is the heading, so nothing says it twice. */}
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? COPY[saved.kind].doneTitle : 'You\u2019re signed up'}
          </h1>
          {saved && saved.matches === 0 ? <p className="mt-1 text-[16px] text-(--ev-ink-85)">{COPY[saved.kind].doneBody}</p> : null}
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
                  <Field label="To work or school" hint="Where the trip goes.">
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

              <div className="grid grid-cols-1 gap-5">
                <Field label={kind === 'carpool' ? 'Which days do you go in?' : 'Which days?'}>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => <Chip key={d.id} on={days.includes(d.id)} onClick={() => setDays((v) => (v.includes(d.id) ? v.filter((x) => x !== d.id) : [...v, d.id]))}>{d.label}</Chip>)}
                  </div>
                </Field>
                <Field label="What time of day?">
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => <Chip key={t.id} on={times.includes(t.id)} onClick={() => setTimes((v) => (v.includes(t.id) ? v.filter((x) => x !== t.id) : [...v, t.id]))}>{t.label}</Chip>)}
                  </div>
                </Field>
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

function Saved({ matches }: { matches: number }) {
  return (
    <Notice tone="good">
      <span className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <span className="grid grid-cols-1 gap-1">
          <strong className="text-[17px]">{matches === 1 ? 'Shift found someone who makes a trip like yours' : `Shift found ${matches} people who make a trip like yours`}</strong>
          <span>
            Say yes to anyone you&rsquo;d like to go with.{' '}
            <Link href="/together/matches" className="font-semibold underline">See your matches</Link>
          </span>
        </span>
      </span>
    </Notice>
  )
}
