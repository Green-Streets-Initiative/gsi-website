'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Bike, Car, CheckCircle2, Sprout, UsersRound, type LucideIcon } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import NextSteps from '@/components/together/NextSteps'
import { Chip, WAY_ICON } from '@/components/together/bits'
import { PHOTOS, type TogetherPhoto } from '@/components/together/photos'
import { Journey, takeKindParam, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Input, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import { gaEvent } from '@/lib/ga'
import { translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { DAY_KEY, ROLE_KEY, SLOT_KEY, TIME_KEY, WAY_KEY, slotWords, togetherStrings, waysWords, type TogetherKey } from '@/lib/site-strings/together'
import {
  DAYS, LANGUAGES, SLOTS, TIMES, WAYS, acceptTerms, clock, hasAcceptedTerms, isSlot, isWay, myMatches, myPlaces, mySignUps,
  saveExtras, savePlace, saveSignUp, stopSignUp, track,
  type CarpoolRole, type Match, type PartnerDay, type PartnerKind, type PartnerLanguage, type PartnerRequest, type PartnerTime, type PartnerWay,
  type PracticeRequest, type PracticeSlot,
} from '@/lib/together'

/**
 * gogreenstreets.org/together: sign up for Shift Together on the web (Phase A,
 * Keith 2026-10-27). The app's sign-up (partner-request.tsx) on one screen, in
 * the app's words: what you'd like to do, your ways, your trip, when, and the
 * basics. Expo sign-ups who sign in with the same email see their sheet's
 * choices filled in and add their trip. Once saved, the page says what
 * happens next and what to do while Shift looks. In the page's language
 * (translation plan, batch 5); page.tsx resolves it.
 */

/** Each choice shows a real place (enrich pass 2026-11-09): bikes onto the train at Concord, the Gilman Square stop, a Park and Ride lot. */
const KINDS: { id: PartnerKind; title: TogetherKey; hint: TogetherKey; photo: TogetherPhoto; alt: TogetherKey }[] = [
  { id: 'newcomer', title: 'kind.newcomer', hint: 'kind.newcomer_hint', photo: PHOTOS.concord, alt: 'hero.alt' },
  { id: 'guide', title: 'kind.guide', hint: 'kind.guide_hint', photo: PHOTOS.gilman, alt: 'how.gilman_alt' },
  { id: 'carpool', title: 'kind.carpool', hint: 'kind.carpool_hint', photo: PHOTOS.parkRide, alt: 'kind.carpool_alt' },
]
const PHOTO_CREDITS: { place: string; photo: TogetherPhoto }[] = [
  { place: 'Concord', photo: PHOTOS.concord },
  { place: 'Gilman Square', photo: PHOTOS.gilman },
  { place: 'Framingham', photo: PHOTOS.parkRide },
]
const KIND_ICON: Record<PartnerKind, LucideIcon> = { newcomer: Sprout, guide: UsersRound, carpool: Car }
const KIND_LABEL: Record<PartnerKind, TogetherKey> = { newcomer: 'kind.newcomer_short', guide: 'kind.guide_short', carpool: 'kind.carpool_short' }
const ROLES: CarpoolRole[] = ['driver', 'rider', 'either']
type Copy = { ways: string; trip: string; note: string; submit: string; privacy: string; doneTitle: string; doneBody: (ways: PartnerWay[]) => string }
function copyFor(kind: PartnerKind, locale: SiteLocale, t: T<TogetherKey>): Copy {
  if (kind === 'newcomer') {
    return {
      ways: t('signup.newcomer_ways'),
      trip: t('signup.newcomer_trip'),
      note: t('signup.newcomer_note'),
      submit: t('signup.newcomer_submit'),
      privacy: t('privacy.both'),
      doneTitle: t('signup.newcomer_done'),
      doneBody: (w) => t('signup.newcomer_done_body', { ways: waysWords(locale, w, 'does', t) }),
    }
  }
  if (kind === 'guide') {
    return {
      ways: t('signup.guide_ways'),
      trip: t('signup.guide_trip'),
      note: t('signup.guide_note'),
      submit: t('signup.guide_submit'),
      privacy: t('privacy.both'),
      doneTitle: t('signup.guide_done'),
      doneBody: (w) => t('signup.guide_done_body', { ways: waysWords(locale, w, 'ing', t) }),
    }
  }
  return {
    ways: '',
    trip: t('signup.carpool_trip'),
    note: t('signup.carpool_note'),
    submit: t('signup.carpool_submit'),
    privacy: t('signup.carpool_privacy'),
    doneTitle: t('signup.carpool_done'),
    doneBody: () => t('signup.carpool_done_body'),
  }
}

/** "Weekdays · Morning", "Mon, Wed · Evening". */
function whenLabel(days: PartnerDay[], times: PartnerTime[], t: T<TogetherKey>): string {
  const sep = t('list.sep')
  const d = days.length === 7 ? t('days.every')
    : days.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((x) => days.includes(x as PartnerDay)) ? t('days.weekdays')
      : DAYS.filter((x) => days.includes(x.id)).map((x) => t(DAY_KEY[x.id])).join(sep)
  const tm = TIMES.filter((x) => times.includes(x.id)).map((x) => t(TIME_KEY[x.id])).join(sep)
  return [d, tm].filter(Boolean).join(' · ')
}

type PlacePick = { address: string; lat: number | null; lng: number | null; placeId: string | null }
const emptyPlace: PlacePick = { address: '', lat: null, lng: null, placeId: null }

/** How far a guide would go with someone (Shift 01504: 5 unless they say, 1 to 20 allowed). */
const GUIDE_MILES = [2, 3, 5, 8]
const GUIDE_MILES_DEFAULT = 5
/** A new newcomer sign-up offers a calm weekend first trip unless they untick it (Keith 2026-10-29). */
const NEWCOMER_SLOTS: PracticeSlot[] = ['weekend_morning', 'weekend_afternoon']

export default function SignUp({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherStrings, locale)
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
  // A match to answer, or one already made: then the page points to Your matches, not "While you wait".
  const [matchState, setMatchState] = useState<'waiting' | 'connected' | null>(null)
  const kindAsked = useRef(false)

  const load = useCallback(async () => {
    if (!userId) return
    const [signUps, places, terms, matches] = await Promise.all([
      mySignUps().catch(() => ({ trips: [] as PartnerRequest[], practice: null })), myPlaces(userId), hasAcceptedTerms(userId),
      myMatches().catch(() => [] as Match[]),
    ])
    const reqs = signUps.trips
    const active = reqs.filter((r) => r.status !== 'closed')
    const prac = signUps.practice && signUps.practice.status !== 'closed' ? signUps.practice : null
    setRequests(active)
    setPractice(prac)
    setMatchState(
      matches.some((m) => m.status === 'proposed' && m.my_answer == null) ? 'waiting'
        : matches.some((m) => m.status === 'connected' || m.status === 'went_together') || active.some((r) => r.status === 'matched') || prac?.status === 'matched' ? 'connected'
          : null,
    )
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
    // A link that names the choice (?kind=guide from the Shift email): open the sign-up on it, unless they have one already.
    if (!kindAsked.current) {
      kindAsked.current = true
      const k = takeKindParam()
      if (k && !paper && !active.some((r) => r.kind === k)) {
        setEditing(true)
        setKind(k)
        setSlots(k === 'newcomer' ? NEWCOMER_SLOTS : [])
        track('together_kind_from_link', { kind: k })
      }
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
    if (kind !== 'carpool' && ways.length === 0) return setErr(kind === 'guide' ? t('signup.need_way_guide') : t('signup.need_way'))
    // A guide needs only Home (Shift 01504); a Work they typed must still be picked from the list.
    const workOptional = kind === 'guide' && !work.address.trim()
    if (home.lat == null || (work.lat == null && !workOptional)) {
      return setErr(kind === 'guide' ? t('signup.need_places_guide') : t('signup.need_places'))
    }
    if (days.length === 0 || times.length === 0) return setErr(t('signup.need_days'))
    if (kind === 'carpool' && !arriveBy) return setErr(t('signup.need_arrive'))
    if (!termsDone && !agreed) return setErr(t('err.terms'))
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
        setErr(t('err.failed'))
        track('together_signup_failed', { kind, reason: r.reason })
        return
      }
      // Other times, and how far a guide would go: saved on the sign-up just made, then matching runs again.
      let matches = r.matches
      if (kind !== 'carpool') {
        const x = await saveExtras(kind, slots, kind === 'guide' ? maxMiles : null)
        if (!x.ok) {
          setErr(t('signup.extras_failed'))
          track('together_extras_failed', { kind, reason: x.reason })
          await load()
          return
        }
        matches += x.matches
      }
      track('together_signup_saved', { kind, ways, languages, slots, max_miles: kind === 'guide' ? maxMiles : null, no_work: workOptional, matches, from_expo: fromExpo })
      // The Ad Grant's result for the Shift Together campaign (Keith 2026-11-13): import it in Google Ads once GA4 lists it.
      gaEvent('together_signup_saved', { kind })
      setSaved({ kind, ways: kind === 'carpool' ? [] : ways, matches })
      setEditing(false)
      setFromExpo(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await load()
    } catch {
      setErr(t('err.network'))
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

  if (loading) return <Spinner label={t('signup.opening')} />
  const showForm = editing || (requests.length === 0 && !practice)
  const copy = kind ? copyFor(kind, locale, t) : null
  const milesChoices = GUIDE_MILES.includes(maxMiles) ? GUIDE_MILES : [...GUIDE_MILES, maxMiles].sort((a, b) => a - b)
  // What to suggest while waiting: the newest sign-up's kind and ways.
  const latest = saved ?? (requests[0] ? { kind: requests[0].kind, ways: requests[0].modes.filter(isWay), matches: 0 } : null)

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm ? 1 : 2} locale={locale} />

      {saved && saved.matches > 0 ? <Saved kind={saved.kind} matches={saved.matches} locale={locale} t={t} /> : null}

      {!showForm && (
        <Card>
          {/* Just saved with no match yet: the thank-you is the heading, so nothing says it twice. */}
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? copyFor(saved.kind, locale, t).doneTitle : t('signed_up')}
          </h1>
          {saved && saved.matches === 0 ? <p className="mt-1 text-[16px] text-(--ev-ink-85)">{copyFor(saved.kind, locale, t).doneBody(saved.ways)}</p> : null}
          {matchState === 'waiting' && !(saved && saved.matches > 0) ? <p className="mt-1 text-[17px] font-semibold">{t('signup.matched_waiting')}</p> : null}
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
                      <p className="text-[17px] font-bold">{t(KIND_LABEL[r.kind])}</p>
                      <p className="text-[15px] text-(--ev-ink-80)">{whenLabel(r.days ?? [], r.time_of_day ?? [], t)}{r.arrive_by ? ` · ${t('signup.by', { time: clock(r.arrive_by, locale) })}` : ''}</p>
                    </div>
                    <Badge tone={r.status === 'matched' ? 'good' : 'info'}>{r.status === 'matched' ? t('status.matched') : t('status.looking')}</Badge>
                  </div>
                  {rWays.length ? (
                    <div className="flex flex-wrap gap-2">
                      {rWays.map((w) => {
                        const WI = WAY_ICON[w]
                        return (
                          <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-semibold">
                            <WI className="h-4 w-4" aria-hidden /> {t(WAY_KEY[w])}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                  {stopping === r.kind ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--ev-panel) p-3">
                      <span className="text-[15px] font-semibold">{t('stop.confirm')}</span>
                      <Button size="sm" onClick={() => void stop(r.kind)}>{t('stop.yes')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStopping(null)}>{t('stop.keep')}</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => startEdit(r)}>{t('change')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setStopping(r.kind)}>{r.kind === 'guide' ? t('stop.offering') : t('stop.looking')}</Button>
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
                    <p className="text-[17px] font-bold">{t('signup.practice_item')}</p>
                    <p className="text-[15px] text-(--ev-ink-80)">
                      {[practice.practice_label ?? t('quiet_streets'), slotWords(locale, (practice.practice_slots ?? []).filter(isSlot), t)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge tone={practice.status === 'matched' ? 'good' : 'info'}>{practice.status === 'matched' ? t('status.matched') : t('status.looking')}</Badge>
                </div>
                <div>
                  <Link href={withLang('/together/practice', locale)} className="inline-flex min-h-[36px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-3 text-[14px] font-semibold hover:bg-(--ev-panel)">{t('change')}</Link>
                </div>
              </li>
            ) : null}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={withLang('/together/matches', locale)}
              className={cx(
                'inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold',
                matchState ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill) hover:opacity-90' : 'border border-(--ev-line-strong) bg-white',
              )}
            >
              {t('see_matches')}
            </Link>
            {requests.length < 3 ? <Button onClick={() => startEdit()}>{t('signup.else')}</Button> : null}
          </div>
        </Card>
      )}

      {!showForm && latest && latest.matches === 0 && !matchState ? <NextSteps kind={latest.kind} ways={latest.ways} source="saved" locale={locale} /> : null}

      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('signup.title')}</h1>
            {fromExpo ? (
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">
                {t('signup.expo')}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('signup.title')}>
              {KINDS.map(({ id, title, hint, photo, alt }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  onClick={() => pickKind(id)}
                  aria-checked={kind === id}
                  className={cx(
                    'flex items-start gap-3 overflow-hidden rounded-2xl border bg-white p-3 text-left transition sm:flex-col sm:gap-3 sm:p-0 sm:pb-4',
                    kind === id ? 'border-(--ev-accent) ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line-strong) hover:bg-(--ev-panel)',
                  )}
                >
                  {/* Phones: a thumbnail beside the words; wider: a photo across the top. */}
                  <span className="relative h-[76px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-(--ev-panel) sm:h-[128px] sm:w-full sm:rounded-none">
                    <Image src={photo.src} alt={t(alt)} fill sizes="(min-width: 640px) 300px, 92px" className="object-cover" />
                  </span>
                  <span className="grid grid-cols-1 gap-1 sm:px-4">
                    <span className="text-[17px] font-bold leading-snug">{t(title)}</span>
                    <span className="text-[15px] leading-snug text-(--ev-ink-80)">{t(hint)}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-snug text-(--ev-ink-75)">
              {t('photos.by', { who: '' }).trim()}{' '}
              {PHOTO_CREDITS.map((c, i) => (
                <span key={c.place}>
                  {i ? ' · ' : ''}
                  <a href={c.photo.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{c.place}: {c.photo.credit.replace(' / Wikimedia Commons', '')}</a>
                </span>
              ))}
              {' / Wikimedia Commons'}
            </p>
          </div>

          {kind && copy && (
            <Card id="together-details" className="scroll-mt-[76px] grid grid-cols-1 gap-6">
              {kind === 'newcomer' && !practice ? (
                <p className="rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
                  {t('signup.practice_offer')}{' '}
                  <Link href={withLang('/together/practice', locale)} onClick={() => track('together_practice_link', { from: 'newcomer_form' })} className="font-semibold text-(--ev-accent) underline">
                    {t('signup.practice_link')}
                  </Link>
                </p>
              ) : null}
              {kind === 'carpool' ? (
                <Field label={t('signup.role_q')}>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => <Chip key={r} on={role === r} onClick={() => setRole(r)}>{t(ROLE_KEY[r])}</Chip>)}
                  </div>
                </Field>
              ) : (
                <Field label={copy.ways} hint={t('signup.pick_any')}>
                  <div className="flex flex-wrap gap-2">
                    {WAYS.map((w) => {
                      const Icon = WAY_ICON[w.id]
                      return (
                        <Chip key={w.id} on={ways.includes(w.id)} onClick={() => setWays((v) => (v.includes(w.id) ? v.filter((x) => x !== w.id) : [...v, w.id]))}>
                          <Icon className="h-4 w-4" aria-hidden /> {t(WAY_KEY[w.id])}
                        </Chip>
                      )
                    })}
                  </div>
                </Field>
              )}

              <fieldset className="grid grid-cols-1 gap-3">
                <legend className="mb-1 text-[16px] font-bold">{copy.trip}</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('signup.from_home')} hint={t('home.hint')}>
                    <AddressAutocomplete
                      value={home.address}
                      onChange={(a) => setHome({ address: a, lat: null, lng: null, placeId: null })}
                      onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                      label={null}
                      placeholder={t('home.placeholder')}
                    />
                  </Field>
                  <Field
                    label={kind === 'guide' ? t('signup.where_you_go') : t('signup.to_work')}
                    optional={kind === 'guide'}
                    optionalLabel={t('optional')}
                    hint={kind === 'guide' ? t('signup.where_you_go_hint') : t('signup.to_work_hint')}
                  >
                    <AddressAutocomplete
                      value={work.address}
                      onChange={(a) => setWork({ address: a, lat: null, lng: null, placeId: null })}
                      onPlaceSelected={(p) => setWork({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                      label={null}
                      placeholder={t('signup.work_placeholder')}
                    />
                  </Field>
                </div>
              </fieldset>

              {kind === 'guide' ? (
                <Field label={t('signup.max_q')} hint={t('signup.max_hint')}>
                  <div className="flex flex-wrap gap-2">
                    {milesChoices.map((m) => <Chip key={m} on={maxMiles === m} onClick={() => setMaxMiles(m)}>{t('miles', { n: m })}</Chip>)}
                  </div>
                </Field>
              ) : null}

              <div className="grid grid-cols-1 gap-5">
                <Field label={kind === 'carpool' ? t('signup.days_carpool') : kind === 'guide' ? t('signup.days_guide') : t('signup.days')}>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => <Chip key={d.id} on={days.includes(d.id)} onClick={() => setDays((v) => (v.includes(d.id) ? v.filter((x) => x !== d.id) : [...v, d.id]))}>{t(DAY_KEY[d.id])}</Chip>)}
                  </div>
                </Field>
                <Field label={t('signup.time_q')}>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((tm) => <Chip key={tm.id} on={times.includes(tm.id)} onClick={() => setTimes((v) => (v.includes(tm.id) ? v.filter((x) => x !== tm.id) : [...v, tm.id]))}>{t(TIME_KEY[tm.id])}</Chip>)}
                  </div>
                </Field>
                {kind !== 'carpool' ? (
                  <Field
                    label={kind === 'guide' ? t('signup.other_guide') : t('signup.other_newcomer')}
                    optional
                    optionalLabel={t('optional')}
                    hint={kind === 'guide'
                      ? t('signup.other_guide_hint')
                      : t('signup.other_newcomer_hint')}
                  >
                    <div className="flex flex-wrap gap-2">
                      {SLOTS.map((s) => <Chip key={s.id} on={slots.includes(s.id)} onClick={() => setSlots((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>{t(SLOT_KEY[s.id])}</Chip>)}
                    </div>
                  </Field>
                ) : null}
              </div>

              {kind === 'carpool' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('signup.arrive')} htmlFor="together-arrive">
                    <Input id="together-arrive" type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} />
                  </Field>
                  <Field label={t('signup.leave')} optional optionalLabel={t('optional')} htmlFor="together-leave">
                    <Input id="together-leave" type="time" value={leaveAt} onChange={(e) => setLeaveAt(e.target.value)} />
                  </Field>
                </div>
              ) : null}

              <Field label={t('lang_q')} hint={t('lang_hint')}>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Chip key={l.id} on={languages.includes(l.id)} onClick={() => setLanguages((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]))}>
                      <span lang={l.id}>{l.label}</span>
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label={t('note_q')} optional optionalLabel={t('optional')} htmlFor="together-note">
                <Textarea id="together-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.note} />
              </Field>

              {!termsDone && (
                <label className="flex items-start gap-3 rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    {t('terms')}{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">{t('terms_link')}</a>
                  </span>
                </label>
              )}
              {err ? <Notice tone="off">{err}</Notice> : null}
              <div className="grid grid-cols-1 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="primary" busy={busy}>{copy.submit}</Button>
                  {requests.length > 0 && <Button variant="ghost" onClick={() => { setEditing(false); setErr(null) }}>{t('cancel')}</Button>}
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

function Saved({ kind, matches, locale, t }: { kind: PartnerKind; matches: number; locale: SiteLocale; t: T<TogetherKey> }) {
  // Carpools line up both ends of the trip; a guide only needs to live nearby (Shift 01504).
  const one = kind === 'carpool' ? t('signup.found_carpool_one')
    : kind === 'guide' ? t('signup.found_guide_one') : t('signup.found_newcomer_one')
  const many = kind === 'carpool' ? t('signup.found_carpool_many', { count: matches })
    : kind === 'guide' ? t('signup.found_guide_many', { count: matches }) : t('signup.found_newcomer_many', { count: matches })
  return (
    <Notice tone="good">
      <span className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <span className="grid grid-cols-1 gap-1">
          <strong className="text-[17px]">{matches === 1 ? one : many}</strong>
          <span>
            {t('signup.found_body')}{' '}
            <Link href={withLang('/together/matches', locale)} className="font-semibold underline">{t('see_matches')}</Link>
          </span>
        </span>
      </span>
    </Notice>
  )
}
