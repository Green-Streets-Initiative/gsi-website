'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Home, Route } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Chip } from '@/components/together/bits'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import {
  LANGUAGES, SLOTS, TERMS_TEXT, acceptTerms, hasAcceptedTerms, isSlot, mySignUps, practicePlaces, savePlace, savePractice,
  slotsText, stopSignUp, track,
  type PartnerLanguage, type PartnerRequest, type PracticePlace, type PracticeRequest, type PracticeSlot,
} from '@/lib/together'

/**
 * gogreenstreets.org/together/practice: ask for a practice ride (Shift 01503,
 * Keith 2026-10-29). An easy bike ride near home, on a quiet path or the
 * streets around it, with a Shift Together guide who lives within 2 miles and
 * is free then. The app's partner-practice screen on the web, for people who
 * don't use the app (the Expo sign-ups). Same sign-in, agreement and double
 * opt-in as /together.
 */

/** Both null: the quiet streets near home. */
type Pick = { trailId: string | null; point: string | null }
const STREETS: Pick = { trailId: null, point: null }

const REASONS: Record<string, string> = {
  needs_terms: 'Please check the box at the bottom to continue.',
  under_18: 'Shift Together is for people 18 and older.',
  pick_a_time: 'Pick at least one time you’re free.',
  bad_place: 'That path didn’t load. Pick a place again.',
  no_home: 'Add your home address first.',
}

type PlacePick = { address: string; lat: number | null; lng: number | null; placeId: string | null }

export default function PracticePage() {
  const { userId } = useTogether()
  const [loading, setLoading] = useState(true)
  const [hasHome, setHasHome] = useState(false)
  const [places, setPlaces] = useState<PracticePlace[]>([])
  const [existing, setExisting] = useState<PracticeRequest | null>(null)
  const [termsDone, setTermsDone] = useState(false)
  const [editing, setEditing] = useState(false)

  const [pick, setPick] = useState<Pick>(STREETS)
  const [slots, setSlots] = useState<PracticeSlot[]>(['weekend_morning'])
  const [languages, setLanguages] = useState<PartnerLanguage[]>(['en'])
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ matches: number } | null>(null)
  const [stopping, setStopping] = useState(false)

  const [home, setHome] = useState<PlacePick>({ address: '', lat: null, lng: null, placeId: null })
  const [homeBusy, setHomeBusy] = useState(false)
  const [homeErr, setHomeErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    const [signUps, near, terms] = await Promise.all([
      mySignUps().catch(() => ({ trips: [] as PartnerRequest[], practice: null })),
      practicePlaces().catch(() => ({ home: false, places: [] as PracticePlace[] })),
      hasAcceptedTerms(userId),
    ])
    const p = signUps.practice && signUps.practice.status !== 'closed' ? signUps.practice : null
    setExisting(p)
    setHasHome(near.home)
    setPlaces(near.places)
    setTermsDone(terms)
    if (p) {
      setPick(p.practice_trail_id ? { trailId: p.practice_trail_id, point: p.practice_point } : STREETS)
      const s = (p.practice_slots ?? []).filter(isSlot)
      if (s.length) setSlots(s)
      setNote(p.note ?? '')
      if (p.languages?.length) setLanguages(p.languages)
    } else {
      // Start from the languages on their trip sign-up, if any; otherwise the nearest path.
      const langs = signUps.trips.find((r) => r.languages?.length)?.languages
      if (langs?.length) setLanguages(langs)
      setPick(near.places[0] ? { trailId: near.places[0].trail_id, point: near.places[0].point } : STREETS)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  async function saveHome() {
    if (!userId) return
    if (home.lat == null || home.lng == null) return setHomeErr('Pick your address from the suggestions as you type.')
    setHomeBusy(true)
    setHomeErr(null)
    try {
      await savePlace(userId, { label: 'Home', address: home.address, lat: home.lat, lng: home.lng, placeId: home.placeId })
      track('together_practice_home_saved')
      await load()
    } catch {
      setHomeErr('That didn’t save. Check your connection and try again.')
    } finally {
      setHomeBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (slots.length === 0) return setErr(REASONS.pick_a_time)
    if (!termsDone && !agreed) return setErr(REASONS.needs_terms)
    setBusy(true)
    setErr(null)
    try {
      if (!termsDone) {
        await acceptTerms()
        setTermsDone(true)
      }
      const r = await savePractice({ trailId: pick.trailId, point: pick.point, slots, note: note.trim() || null, languages })
      if (!r.ok) {
        setErr(REASONS[r.reason] ?? 'That didn’t save. Please try again.')
        track('together_practice_failed', { reason: r.reason })
        if (r.reason === 'bad_place' || r.reason === 'no_home') await load()
        return
      }
      track('together_practice_saved', { place: pick.trailId ? 'path' : 'streets', slots, matches: r.matches })
      setSaved({ matches: r.matches })
      setEditing(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await load()
    } catch {
      setErr('That didn’t save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (await stopSignUp('practice')) {
      track('together_practice_stopped')
      setStopping(false)
      setSaved(null)
      await load()
    }
  }

  if (loading) return <Spinner label="Opening your practice ride" />
  const showForm = hasHome && (editing || !existing)
  const pickedLabel = existing?.practice_label ?? 'Quiet streets near home'

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm ? 1 : 2} />

      {saved && saved.matches > 0 ? (
        <Notice tone="good">
          <span className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <span className="grid grid-cols-1 gap-1">
              <strong className="text-[17px]">We found a guide who can go</strong>
              <span>
                Say yes if you&rsquo;d like to ride with them.{' '}
                <Link href="/together/matches" className="font-semibold underline">See your matches</Link>
              </span>
            </span>
          </span>
        </Notice>
      ) : null}

      {!hasHome ? (
        <Card className="grid grid-cols-1 gap-5">
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">An easy practice ride near home</h1>
            <p className="mt-2 text-[16px] text-(--ev-ink-85)">
              First, add your home address. We use it to find quiet paths near you and a guide who lives within 2 miles. Your match never sees it.
            </p>
          </div>
          <Field label="Your home" hint="Only used to find someone nearby." error={homeErr}>
            <AddressAutocomplete
              value={home.address}
              onChange={(a) => setHome({ address: a, lat: null, lng: null, placeId: null })}
              onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
              label={null}
              placeholder="Your street address"
            />
          </Field>
          <div>
            <Button variant="primary" busy={homeBusy} onClick={() => void saveHome()}>Save my home</Button>
          </div>
        </Card>
      ) : null}

      {hasHome && !showForm && existing ? (
        <Card>
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? 'You’re signed up' : 'Your practice ride'}
          </h1>
          {saved && saved.matches === 0 ? (
            <p className="mt-1 text-[16px] text-(--ev-ink-85)">We&rsquo;ll let you know when a guide near you is free then.</p>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ev-accent-fill) text-(--ev-on-accent-fill)" aria-hidden>
                {existing.practice_trail_id ? <Route className="h-5 w-5" /> : <Home className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{pickedLabel}</p>
                <p className="text-[15px] text-(--ev-ink-80)">
                  {[existing.practice_point ? `From the ${existing.practice_point} entrance` : null, slotsText((existing.practice_slots ?? []).filter(isSlot))].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Badge tone={existing.status === 'matched' ? 'good' : 'info'}>{existing.status === 'matched' ? 'Matched' : 'Looking'}</Badge>
            </div>
            {stopping ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--ev-panel) p-3">
                <span className="text-[15px] font-semibold">Stop looking? You can sign up again anytime.</span>
                <Button size="sm" onClick={() => void stop()}>Yes, stop</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(false)}>Keep it</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setSaved(null); setErr(null); setEditing(true) }}>Change</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(true)}>Stop looking</Button>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/together/matches" className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold hover:bg-(--ev-panel)">See your matches</Link>
            <Link href="/together" className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">Back to your sign-up</Link>
          </div>
        </Card>
      ) : null}

      {showForm ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">An easy practice ride near home</h1>
            <p className="mt-2 text-[16px] text-(--ev-ink-85)">
              Ride a quiet path or the streets near your home with a neighbor who bikes and lives within 2 miles. Go at your own pace.
            </p>
          </div>
          <Card className="grid grid-cols-1 gap-6">
            <Field
              label="Where would you like to ride?"
              hint={places.length ? undefined : 'There are no paths within 4 miles of your home that we know of, so you’d start on quiet streets.'}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Where would you like to ride?">
                {places.map((p) => (
                  <PlaceCard
                    key={`${p.trail_id}:${p.point}`}
                    on={pick.trailId === p.trail_id && pick.point === p.point}
                    onClick={() => setPick({ trailId: p.trail_id, point: p.point })}
                    title={p.trail}
                    sub={`From the ${p.point} entrance · ${p.miles} mi from home`}
                    path
                  />
                ))}
                <PlaceCard
                  on={pick.trailId == null}
                  onClick={() => setPick(STREETS)}
                  title="Quiet streets near my home"
                  sub="Start from your door."
                />
              </div>
            </Field>

            <Field label="When are you free?" hint="Pick any that fit. A guide near you who’s free then can say yes.">
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((s) => <Chip key={s.id} on={slots.includes(s.id)} onClick={() => setSlots((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>{s.label}</Chip>)}
              </div>
            </Field>

            <Field label="Which languages do you speak?" hint="Someone who speaks one of these comes first. Your match sees them.">
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <Chip key={l.id} on={languages.includes(l.id)} onClick={() => setLanguages((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]))}>
                    <span lang={l.id}>{l.label}</span>
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Anything else we should know?" optional htmlFor="practice-note">
              <Textarea
                id="practice-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: I haven’t ridden in years and would like to start slow."
              />
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
                <Button type="submit" variant="primary" busy={busy}>Find me a practice ride</Button>
                {existing ? <Button variant="ghost" onClick={() => { setEditing(false); setErr(null) }}>Cancel</Button> : null}
              </div>
              <p className="text-[15px] leading-snug text-(--ev-ink-80)">You each see the other&rsquo;s email only after you both say yes.</p>
            </div>
          </Card>
          <p className="text-[15px] leading-snug text-(--ev-ink-80)">
            Ready for a trip you make, like to work or school?{' '}
            <Link href="/together" className="font-semibold text-(--ev-accent) underline">Find someone to go with</Link>
          </p>
        </form>
      ) : null}
    </div>
  )
}

function PlaceCard({ on, onClick, title, sub, path = false }: { on: boolean; onClick: () => void; title: string; sub: string; path?: boolean }) {
  const Icon = path ? Route : Home
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        'flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition',
        on ? 'border-(--ev-accent) ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line-strong) hover:bg-(--ev-panel)',
      )}
    >
      <span
        className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', on ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-accent)')}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="grid grid-cols-1 gap-1">
        <span className="text-[17px] font-bold leading-snug">{title}</span>
        <span className="text-[15px] leading-snug text-(--ev-ink-80)">{sub}</span>
      </span>
    </button>
  )
}
