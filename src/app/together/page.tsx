'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Bike, Car, CheckCircle2, Footprints, Mail, Sprout, TrainFront, UsersRound } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Input, Notice, Spinner, Toggle, cx } from '@/components/organizers/ui'
import {
  DAYS, TERMS_TEXT, TIMES, WAYS, acceptTerms, claimLesson, hasAcceptedTerms, lessonOffer, myPlaces, myRequests,
  savePlace, saveSignUp, stopSignUp, track,
  type CarpoolRole, type LessonOffer, type PartnerDay, type PartnerKind, type PartnerRequest, type PartnerTime, type PartnerWay,
} from '@/lib/together'

/**
 * gogreenstreets.org/together: sign up for Shift Together on the web (Phase A,
 * Keith 2026-10-27). The same sign-up as the app (partner-request.tsx), one
 * screen: what you'd like to do, your ways, Home and Work, when, and the
 * basics. Expo sign-ups who sign in with the same email see their sheet's
 * choices filled in and add their trip.
 */

const KINDS: { id: PartnerKind; title: string; hint: string; Icon: typeof Sprout }[] = [
  { id: 'newcomer', title: 'Try a new way, with company', hint: 'A neighbor who knows the way goes with you the first time.', Icon: Sprout },
  { id: 'guide', title: 'Show someone the way', hint: 'Help a neighbor build confidence on a trip you already make.', Icon: UsersRound },
  { id: 'carpool', title: 'Share a drive', hint: 'With someone whose trip fits yours. Shift checks the detour first.', Icon: Car },
]
const WAY_ICON: Record<PartnerWay, typeof Bike> = { bike: Bike, walk: Footprints, transit: TrainFront }
const KIND_LABEL: Record<PartnerKind, string> = { newcomer: 'Trying a new way', guide: 'Showing the way', carpool: 'Sharing a drive' }
const ROLES: { id: CarpoolRole; label: string }[] = [
  { id: 'driver', label: "I'll drive" }, { id: 'rider', label: "I'd ride" }, { id: 'either', label: 'Either' },
]

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
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ kind: PartnerKind; matches: number } | null>(null)
  const [fromExpo, setFromExpo] = useState(false)

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
      setWays(paper.modes.filter((m): m is PartnerWay => m === 'bike' || m === 'walk' || m === 'transit'))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const startEdit = (r?: PartnerRequest) => {
    setSaved(null)
    setEditing(true)
    if (r) {
      setKind(r.kind)
      setWays(r.modes.filter((m): m is PartnerWay => m === 'bike' || m === 'walk' || m === 'transit'))
      if (r.days?.length) setDays(r.days)
      if (r.time_of_day?.length) setTimes(r.time_of_day)
      if (r.carpool_role) setRole(r.carpool_role)
      if (r.arrive_by) setArriveBy(r.arrive_by.slice(0, 5))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!userId || !kind) return
    if (kind !== 'carpool' && ways.length === 0) return setErr('Pick at least one way.')
    if (home.lat == null || work.lat == null) return setErr('Pick Home and Work from the suggestions.')
    if (days.length === 0 || times.length === 0) return setErr('Pick the days and times you usually go.')
    if (kind === 'carpool' && !arriveBy) return setErr('Add the time you need to get there.')
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
      const r = await saveSignUp({ kind, modes: ways, homeId, workId, days, times, carpoolRole: kind === 'carpool' ? role : null, arriveBy: arriveBy || null })
      if (!r.ok) {
        setErr("That didn't go through. Try again in a minute.")
        track('together_signup_failed', { kind, reason: r.reason })
        return
      }
      track('together_signup_saved', { kind, ways, matches: r.matches, from_expo: fromExpo })
      setSaved({ kind, matches: r.matches })
      setEditing(false)
      setFromExpo(false)
      await load()
    } catch {
      setErr("That didn't go through. Try again in a minute.")
    } finally {
      setBusy(false)
    }
  }

  async function stop(k: PartnerKind) {
    if (await stopSignUp(k)) {
      track('together_signup_stopped', { kind: k })
      await load()
    }
  }

  if (loading) return <Spinner label="Opening your sign-up" />
  const showForm = editing || requests.length === 0
  const newcomerBike = (saved?.kind === 'newcomer' && ways.includes('bike')) ||
    requests.some((r) => r.kind === 'newcomer' && r.modes.includes('bike') && r.origin_location_id)

  return (
    <div className="grid gap-6">
      {saved ? <Saved kind={saved.kind} matches={saved.matches} /> : null}

      {!showForm && (
        <Card>
          <h1 className="font-display text-[26px] font-extrabold">You&rsquo;re signed up</h1>
          <ul className="mt-4 grid gap-3">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-(--ev-line) p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-bold">{KIND_LABEL[r.kind]}</p>
                  <p className="text-[15px] text-(--ev-ink-80)">
                    {r.kind === 'carpool' ? 'By car' : r.modes.map((m) => WAYS.find((w) => w.id === m)?.label ?? m).join(', ')}
                  </p>
                </div>
                <Badge tone={r.status === 'matched' ? 'good' : 'info'}>{r.status === 'matched' ? 'Matched' : 'Looking for a match'}</Badge>
                <Button size="sm" onClick={() => startEdit(r)}>Change</Button>
                <Button size="sm" variant="ghost" onClick={() => void stop(r.kind)}>Stop</Button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/together/matches" className="inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)">See your matches</Link>
            <Button onClick={() => { setKind(null); startEdit() }}>Sign up for something else</Button>
          </div>
        </Card>
      )}

      {showForm && (
        <form onSubmit={submit} className="grid gap-6">
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">What would you like to do?</h1>
            {fromExpo ? (
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">From your Expo sign-up. Add your trip below and we&rsquo;ll look for a match.</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {KINDS.map(({ id, title, hint, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                aria-pressed={kind === id}
                className={cx(
                  'flex flex-col items-start gap-2 rounded-2xl border bg-white p-4 text-left transition',
                  kind === id ? 'border-(--ev-accent) ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line-strong) hover:bg-(--ev-panel)',
                )}
              >
                <Icon className="h-6 w-6 text-(--ev-accent)" aria-hidden />
                <span className="text-[17px] font-bold leading-snug">{title}</span>
                <span className="text-[15px] leading-snug text-(--ev-ink-80)">{hint}</span>
              </button>
            ))}
          </div>

          {kind && (
            <Card className="grid gap-5">
              {kind === 'carpool' ? (
                <Field label="Would you drive?">
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => <Toggle key={r.id} on={role === r.id} onClick={() => setRole(r.id)}>{r.label}</Toggle>)}
                  </div>
                </Field>
              ) : (
                <Field label={kind === 'guide' ? 'Which ways could you show?' : 'Which ways would you like to try?'} hint="Pick any that fit.">
                  <div className="flex flex-wrap gap-2">
                    {WAYS.map((w) => {
                      const Icon = WAY_ICON[w.id]
                      return (
                        <Toggle key={w.id} on={ways.includes(w.id)} onClick={() => setWays((v) => (v.includes(w.id) ? v.filter((x) => x !== w.id) : [...v, w.id]))}>
                          <Icon className="h-4 w-4" aria-hidden /> {w.label}
                        </Toggle>
                      )
                    })}
                  </div>
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Home" hint="Never shown to anyone.">
                  <AddressAutocomplete
                    value={home.address}
                    onChange={(a) => setHome({ address: a, lat: null, lng: null, placeId: null })}
                    onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                    label={null}
                    placeholder="Your street address"
                  />
                </Field>
                <Field label="Work or school" hint="Where the trip goes.">
                  <AddressAutocomplete
                    value={work.address}
                    onChange={(a) => setWork({ address: a, lat: null, lng: null, placeId: null })}
                    onPlaceSelected={(p) => setWork({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                    label={null}
                    placeholder="Address or place name"
                  />
                </Field>
              </div>

              <Field label="Which days?">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => <Toggle key={d.id} on={days.includes(d.id)} onClick={() => setDays((v) => (v.includes(d.id) ? v.filter((x) => x !== d.id) : [...v, d.id]))}>{d.label}</Toggle>)}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="When do you usually go?">
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => <Toggle key={t.id} on={times.includes(t.id)} onClick={() => setTimes((v) => (v.includes(t.id) ? v.filter((x) => x !== t.id) : [...v, t.id]))}>{t.label}</Toggle>)}
                  </div>
                </Field>
                <Field label="Need to get there by" optional={kind !== 'carpool'} htmlFor="together-arrive">
                  <Input id="together-arrive" type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} />
                </Field>
              </div>

              {!termsDone && (
                <label className="flex items-start gap-3 rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>{TERMS_TEXT}</span>
                </label>
              )}
              {err ? <Notice tone="off">{err}</Notice> : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" busy={busy}>
                  {kind === 'guide' ? 'Offer to show the way' : kind === 'carpool' ? 'Find a carpool partner' : 'Find someone to go with'}
                </Button>
                {requests.length > 0 && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
              </div>
              <p className="text-[14px] leading-snug text-(--ev-ink-75)">
                Your match sees your first name, your ways and when you go. Your email is shared only once you both say yes.
              </p>
            </Card>
          )}
        </form>
      )}

      {newcomerBike && !showForm ? <LessonCard /> : null}
    </div>
  )
}

function Saved({ kind, matches }: { kind: PartnerKind; matches: number }) {
  return (
    <Notice tone="good">
      <span className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <span>
          {matches > 0
            ? <>We found {matches === 1 ? 'a possible match' : `${matches} possible matches`}. <Link href="/together/matches" className="font-semibold underline">See them</Link> and say yes or no.</>
            : kind === 'guide'
              ? "Thank you. We'll email you when someone near you would like to try your way."
              : "You're on the list. We'll email you when someone's trip fits yours."}
        </span>
      </span>
    </Notice>
  )
}

/** The free 1:1 road lesson, for newcomers by bike near the school (Shift 01454). */
function LessonCard() {
  const [offer, setOffer] = useState<LessonOffer | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void lessonOffer().then(setOffer) }, [])
  if (!offer || (offer.state !== 'offer' && offer.state !== 'has_code')) return null

  if (offer.state === 'has_code') {
    return (
      <Card>
        <h2 className="font-display text-[22px] font-extrabold">Your free lesson code</h2>
        <p className="mt-3 inline-block rounded-xl border-2 border-(--ev-accent) px-4 py-2 font-display text-[26px] font-extrabold tracking-[0.12em]">{offer.code}</p>
        <p className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">
          Email an instructor from the {offer.school} to pick a time, and give them this code. Green Streets pays for the lesson.
        </p>
        <ul className="mt-3 grid gap-2">
          {offer.contacts.map((c) => (
            <li key={c.name}>
              <a
                href={c.email ? `mailto:${c.email}?subject=${encodeURIComponent(`Free road riding lesson (Green Streets code ${offer.code})`)}` : `tel:${c.phone}`}
                onClick={() => track('together_lesson_contact')}
                className="flex min-h-[48px] items-center gap-3 rounded-xl bg-(--ev-panel) px-4 py-2"
              >
                <Mail className="h-5 w-5 text-(--ev-accent)" aria-hidden />
                <span><strong>{c.name}</strong> <span className="text-(--ev-ink-80)">{c.email ?? c.phone}</span></span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    )
  }
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[22px] font-extrabold">Book a free 1:1 lesson</h2>
          {offer.left != null && <Badge tone="good">{offer.left} left</Badge>}
        </div>
        <p className="mt-1 text-[16px] text-(--ev-ink-85)">Ride in traffic with an instructor from the {offer.school}, near Somerville. Green Streets pays.</p>
      </div>
      <Button
        variant="primary"
        busy={busy}
        onClick={async () => {
          setBusy(true)
          const o = await claimLesson()
          setBusy(false)
          if (o) setOffer(o)
          track('together_lesson_claimed', { state: o?.state ?? 'error' })
        }}
      >
        Get my free lesson code
      </Button>
    </Card>
  )
}
