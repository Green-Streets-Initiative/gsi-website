'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Home, Route } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import NextSteps from '@/components/together/NextSteps'
import PinMap from '@/components/together/PinMap'
import { Chip } from '@/components/together/bits'
import { PHOTOS, PhotoBand } from '@/components/together/photos'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Notice, Spinner, Textarea, cx } from '@/components/organizers/ui'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { SLOT_KEY, slotWords, togetherStrings, type TogetherKey } from '@/lib/site-strings/together'
import {
  LANGUAGES, SLOTS, acceptTerms, hasAcceptedTerms, isSlot, myPlaces, mySignUps, practicePlaces, savePlace, savePractice,
  stopSignUp, track,
  type PartnerLanguage, type PartnerRequest, type PracticePlace, type PracticeRequest, type PracticeSlot,
} from '@/lib/together'

/**
 * gogreenstreets.org/together/practice: ask for a practice ride (Shift 01503,
 * Keith 2026-10-29). An easy bike ride near home, on a quiet path or the
 * streets around it, with a Shift Together guide who lives within 2 miles and
 * is free then. The app's partner-practice screen on the web, for people who
 * don't use the app (the Expo sign-ups). Same sign-in, agreement and double
 * opt-in as /together. In the page's language (translation plan, batch 5);
 * page.tsx resolves it.
 */

/** Both null: the quiet streets near home. */
type Pick = { trailId: string | null; point: string | null }
const STREETS: Pick = { trailId: null, point: null }

const REASONS: Record<string, TogetherKey> = {
  needs_terms: 'err.terms',
  under_18: 'practice.under_18',
  pick_a_time: 'practice.pick_a_time',
  bad_place: 'practice.bad_place',
  no_home: 'practice.no_home',
}

type PlacePick = { address: string; lat: number | null; lng: number | null; placeId: string | null }

export default function Practice({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  const { userId } = useTogether()
  const [loading, setLoading] = useState(true)
  const [hasHome, setHasHome] = useState(false)
  const [places, setPlaces] = useState<PracticePlace[]>([])
  // Where Home is, for the map of the paths near it.
  const [homeAt, setHomeAt] = useState<{ lat: number; lng: number } | null>(null)
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
    const [signUps, near, terms, saved] = await Promise.all([
      mySignUps().catch(() => ({ trips: [] as PartnerRequest[], practice: null })),
      practicePlaces().catch(() => ({ home: false, places: [] as PracticePlace[] })),
      hasAcceptedTerms(userId),
      myPlaces(userId).catch(() => []),
    ])
    const h = saved.find((x) => x.label === 'Home')
    setHomeAt(h && h.lat != null && h.lng != null ? { lat: Number(h.lat), lng: Number(h.lng) } : null)
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
    if (home.lat == null || home.lng == null) return setHomeErr(t('practice.pick_address'))
    setHomeBusy(true)
    setHomeErr(null)
    try {
      await savePlace(userId, { label: 'Home', address: home.address, lat: home.lat, lng: home.lng, placeId: home.placeId })
      track('together_practice_home_saved')
      await load()
    } catch {
      setHomeErr(t('err.network'))
    } finally {
      setHomeBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (slots.length === 0) return setErr(t(REASONS.pick_a_time))
    if (!termsDone && !agreed) return setErr(t(REASONS.needs_terms))
    setBusy(true)
    setErr(null)
    try {
      if (!termsDone) {
        await acceptTerms()
        setTermsDone(true)
      }
      const r = await savePractice({ trailId: pick.trailId, point: pick.point, slots, note: note.trim() || null, languages })
      if (!r.ok) {
        setErr(REASONS[r.reason] ? t(REASONS[r.reason]) : t('err.failed'))
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
      setErr(t('err.network'))
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

  if (loading) return <Spinner label={t('practice.opening')} />
  // A quiet path like the ones on offer: the Charles River path in Allston (credited).
  const riverPhoto = (
    <PhotoBand photo={PHOTOS.river} alt={t('practice.photo_alt')} place={t('practice.photo_place')} creditLabel={t('photo.by', { who: PHOTOS.river.credit })}
      className="h-[160px] sm:h-[220px]" sizes="(min-width: 768px) 440px, 100vw" />
  )
  const showForm = hasHome && (editing || !existing)
  const pickedLabel = existing?.practice_label ?? t('quiet_streets')

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm ? 1 : 2} locale={locale} />

      {saved && saved.matches > 0 ? (
        <Notice tone="good">
          <span className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <span className="grid grid-cols-1 gap-1">
              <strong className="text-[17px]">{t('practice.found')}</strong>
              <span>
                {t('practice.found_body')}{' '}
                <Link href={withLang('/together/matches', locale)} className="font-semibold underline">{t('see_matches')}</Link>
              </span>
            </span>
          </span>
        </Notice>
      ) : null}

      {!hasHome ? (
        <Card className="grid grid-cols-1 gap-5">
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('practice.title')}</h1>
            <p className="mt-2 text-[16px] text-(--ev-ink-85)">
              {t('practice.home_intro')}
            </p>
          </div>
          {riverPhoto}
          <Field label={t('practice.your_home')} hint={t('home.hint')} error={homeErr}>
            <AddressAutocomplete
              value={home.address}
              onChange={(a) => setHome({ address: a, lat: null, lng: null, placeId: null })}
              onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
              label={null}
              placeholder={t('home.placeholder')}
            />
          </Field>
          <div>
            <Button variant="primary" busy={homeBusy} onClick={() => void saveHome()}>{t('practice.save_home')}</Button>
          </div>
        </Card>
      ) : null}

      {hasHome && !showForm && existing ? (
        <Card>
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? t('signed_up') : t('practice.yours')}
          </h1>
          {saved && saved.matches === 0 ? (
            <p className="mt-1 text-[16px] text-(--ev-ink-85)">{t('practice.done_body')}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ev-accent-fill) text-(--ev-on-accent-fill)" aria-hidden>
                {existing.practice_trail_id ? <Route className="h-5 w-5" /> : <Home className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{pickedLabel}</p>
                <p className="text-[15px] text-(--ev-ink-80)">
                  {[existing.practice_point ? t('practice.from_entrance', { point: existing.practice_point }) : null, slotWords(locale, (existing.practice_slots ?? []).filter(isSlot), t)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Badge tone={existing.status === 'matched' ? 'good' : 'info'}>{existing.status === 'matched' ? t('status.matched') : t('status.looking')}</Badge>
            </div>
            {stopping ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--ev-panel) p-3">
                <span className="text-[15px] font-semibold">{t('stop.confirm')}</span>
                <Button size="sm" onClick={() => void stop()}>{t('stop.yes')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(false)}>{t('stop.keep')}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setSaved(null); setErr(null); setEditing(true) }}>{t('change')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(true)}>{t('stop.looking')}</Button>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={withLang('/together/matches', locale)} className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold hover:bg-(--ev-panel)">{t('see_matches')}</Link>
            <Link href={withLang('/together', locale)} className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">{t('practice.back')}</Link>
          </div>
        </Card>
      ) : null}

      {/* Waiting for a guide: the lesson, an easy group ride this week, the route, an invite. */}
      {hasHome && !showForm && existing && existing.status !== 'matched' && !(saved && saved.matches > 0) ? (
        <NextSteps kind="newcomer" ways={['bike']} source="practice" locale={locale} />
      ) : null}

      {showForm ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-8">
            <div>
              <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('practice.title')}</h1>
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">
                {t('practice.intro')}
              </p>
            </div>
            {riverPhoto}
          </div>
          <Card className="grid grid-cols-1 gap-6">
            <Field
              label={t('practice.where_q')}
              hint={places.length ? undefined : t('practice.no_paths')}
            >
              {/* Their own Home and the path entrances near it, labeled as on the choices below. */}
              {homeAt && places.length ? (
                <PinMap
                  className="mb-3"
                  boxClassName="aspect-[16/9] sm:aspect-[5/2]"
                  width={560}
                  height={260}
                  title={t('practice.map_alt')}
                  pins={[
                    { lat: homeAt.lat, lng: homeAt.lng, kind: 'home', label: t('practice.map_home') },
                    ...places.map((pl) => ({ lat: pl.lat, lng: pl.lng, kind: 'path' as const, label: pl.trail })),
                  ]}
                />
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('practice.where_q')}>
                {places.map((p) => (
                  <PlaceCard
                    key={`${p.trail_id}:${p.point}`}
                    on={pick.trailId === p.trail_id && pick.point === p.point}
                    onClick={() => setPick({ trailId: p.trail_id, point: p.point })}
                    title={p.trail}
                    sub={t('practice.place_sub', { point: p.point, miles: p.miles })}
                    path
                  />
                ))}
                <PlaceCard
                  on={pick.trailId == null}
                  onClick={() => setPick(STREETS)}
                  title={t('practice.streets')}
                  sub={t('practice.streets_sub')}
                />
              </div>
            </Field>

            <Field label={t('practice.when_q')} hint={t('practice.when_hint')}>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((s) => <Chip key={s.id} on={slots.includes(s.id)} onClick={() => setSlots((v) => (v.includes(s.id) ? v.filter((x) => x !== s.id) : [...v, s.id]))}>{t(SLOT_KEY[s.id])}</Chip>)}
              </div>
            </Field>

            <Field label={t('lang_q')} hint={t('lang_hint')}>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <Chip key={l.id} on={languages.includes(l.id)} onClick={() => setLanguages((v) => (v.includes(l.id) ? v.filter((x) => x !== l.id) : [...v, l.id]))}>
                    <span lang={l.id}>{l.label}</span>
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label={t('note_q')} optional optionalLabel={t('optional')} htmlFor="practice-note">
              <Textarea
                id="practice-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('practice.note')}
              />
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
                <Button type="submit" variant="primary" busy={busy}>{t('practice.submit')}</Button>
                {existing ? <Button variant="ghost" onClick={() => { setEditing(false); setErr(null) }}>{t('cancel')}</Button> : null}
              </div>
              <p className="text-[15px] leading-snug text-(--ev-ink-80)">{t('privacy.both')}</p>
            </div>
          </Card>
          <p className="text-[15px] leading-snug text-(--ev-ink-80)">
            {t('practice.trip_q')}{' '}
            <Link href={withLang('/together', locale)} className="font-semibold text-(--ev-accent) underline">{t('signup.newcomer_submit')}</Link>
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
