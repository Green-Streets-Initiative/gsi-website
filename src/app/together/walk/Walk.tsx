'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Briefcase, CalendarDays, CheckCircle2, Footprints, GraduationCap, House, MapPin, type LucideIcon } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Chip } from '@/components/together/bits'
import { PHOTOS, PhotoBand } from '@/components/together/photos'
import { Journey, useTogether } from '@/components/together/TogetherShell'
import { Badge, Button, Card, Field, Notice, Spinner, cx } from '@/components/organizers/ui'
import { siteDate, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { DAY_KEY, TIME_KEY, togetherStrings } from '@/lib/site-strings/together'
import { togetherMoreStrings } from '@/lib/site-strings/together-more'
import {
  DAYS, LANGUAGES, TIMES, acceptTerms, hasAcceptedTerms, myMatches, mySignUps, savePlace, stopSignUp, track,
  type PartnerDay, type PartnerLanguage, type PartnerTime,
} from '@/lib/together'
import { groupWalks, saveWalk, type GroupWalk, type WalkRequest } from '@/lib/together-more'
import { supabase } from '@/lib/supabase'

/**
 * gogreenstreets.org/together/walk: find someone to walk with (Shift
 * 01507/01508; the app's partner-walk screen, parity gap-together-web-walks).
 * Company, never teaching: nobody here is a guide. Where is around home or
 * on the way to their saved Work or School. Shift finds someone whose home
 * is within a mile, who walks the same kind of walk on overlapping days and
 * times; both say yes in Your matches, as for any match. Same sign-in,
 * agreement and double opt-in as /together, in the page's language.
 */

type Saved = { id: string; label: string; lat: number | null }
type AddressPick = { address: string; lat: number | null; lng: number | null; placeId: string | null }
const EMPTY: AddressPick = { address: '', lat: null, lng: null, placeId: null }
const ICON: Record<string, LucideIcon> = { Home: House, Work: Briefcase, School: GraduationCap }

export default function Walk({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherMoreStrings, locale)
  const tt = translator(togetherStrings, locale)
  const { userId } = useTogether()
  const [loading, setLoading] = useState(true)
  const [places, setPlaces] = useState<Saved[]>([])
  const [existing, setExisting] = useState<WalkRequest | null>(null)
  const [hasMatch, setHasMatch] = useState(false)
  const [termsDone, setTermsDone] = useState(false)
  const [editing, setEditing] = useState(false)

  /** null: around home; else a saved place's id. */
  const [dest, setDest] = useState<string | null>(null)
  const [days, setDays] = useState<PartnerDay[]>([])
  const [times, setTimes] = useState<PartnerTime[]>([])
  const [languages, setLanguages] = useState<PartnerLanguage[] | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ matches: number } | null>(null)
  const [stopping, setStopping] = useState(false)

  const [addr, setAddr] = useState<AddressPick>(EMPTY)
  const [addrBusy, setAddrBusy] = useState(false)
  const [addrErr, setAddrErr] = useState<string | null>(null)
  const [addWork, setAddWork] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const [signUps, saved, terms, matches] = await Promise.all([
      mySignUps().catch(() => ({ trips: [], practice: null, walk: null })),
      supabase.from('saved_locations').select('id, label, lat').eq('user_id', userId).in('label', ['Home', 'Work', 'School']).limit(10)
        .then(({ data }) => (data ?? []) as Saved[]),
      hasAcceptedTerms(userId),
      myMatches().catch(() => []),
    ])
    const usable = saved.filter((s) => s.lat != null)
    setPlaces(usable)
    const w = signUps.walk && (signUps.walk.status === 'open' || signUps.walk.status === 'matched') ? signUps.walk : null
    setExisting(w)
    setTermsDone(terms)
    setHasMatch(matches.some((m) => m.kind === 'walk'))
    if (w) {
      setDest(w.destination_location_id)
      setDays(w.days ?? [])
      setTimes(w.time_of_day ?? [])
      setLanguages(w.languages?.length ? w.languages : null)
    } else {
      // Start from the languages on another sign-up, if any.
      const langs = signUps.trips.find((r) => r.languages?.length)?.languages ?? signUps.practice?.languages
      setLanguages(langs?.length ? langs : ['en'])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const home = places.find((p) => p.label === 'Home') ?? null
  const goals = places.filter((p) => p.label === 'Work' || p.label === 'School')

  async function saveAddress(label: 'Home' | 'Work') {
    if (!userId) return
    if (addr.lat == null || addr.lng == null) return setAddrErr(tt('practice.pick_address'))
    setAddrBusy(true)
    setAddrErr(null)
    try {
      const id = await savePlace(userId, { label, address: addr.address, lat: addr.lat, lng: addr.lng, placeId: addr.placeId })
      track('together_walk_place_saved', { label: label.toLowerCase() })
      setAddr(EMPTY)
      setAddWork(false)
      if (label === 'Work') setDest(id)
      await load()
    } catch {
      setAddrErr(tt('err.network'))
    } finally {
      setAddrBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!times.length) return setErr(t('walk.need_time'))
    if (!termsDone && !agreed) return setErr(tt('err.terms'))
    setBusy(true)
    setErr(null)
    try {
      if (!termsDone) {
        await acceptTerms()
        setTermsDone(true)
        track('together_terms_accepted', { kind: 'walk' })
      }
      const r = await saveWalk({ destinationId: dest, days, times, languages })
      if (!r.ok) {
        setErr(r.reason === 'needs_terms' ? tt('err.terms') : r.reason === 'under_18' ? tt('practice.under_18') : r.reason === 'no_home' ? tt('practice.no_home') : r.reason === 'network' ? tt('err.network') : tt('err.failed'))
        track('together_walk_failed', { reason: r.reason })
        return
      }
      const label = dest ? places.find((p) => p.id === dest)?.label ?? 'place' : 'home'
      track('together_walk_saved', { place: label.toLowerCase(), days, times, updated: !!existing, matches: r.matches })
      setSaved({ matches: r.matches })
      setEditing(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await load()
    } catch {
      setErr(tt('err.network'))
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (await stopSignUp('walk')) {
      track('together_walk_stopped')
      setStopping(false)
      setSaved(null)
      await load()
    } else setErr(tt('err.failed'))
  }

  if (loading) return <Spinner label={t('walk.opening')} />

  const showForm = !!home && (editing || !existing)
  const photo = (
    <PhotoBand photo={PHOTOS.river} alt={tt('practice.photo_alt')} place={tt('practice.photo_place')} creditLabel={tt('photo.by', { who: PHOTOS.river.credit })}
      className="h-[160px] sm:h-[220px]" sizes="(min-width: 768px) 440px, 100vw" />
  )
  const whereLabel = (id: string | null) => {
    if (!id) return t('walk.near_home_item')
    return places.find((p) => p.id === id)?.label === 'School' ? t('walk.to_school_item') : t('walk.to_work_item')
  }
  const whenLabel = (w: WalkRequest) => [
    (w.days ?? []).length ? DAYS.filter((d) => w.days!.includes(d.id)).map((d) => tt(DAY_KEY[d.id])).join(tt('list.sep')) : t('walk.any_day'),
    TIMES.filter((x) => (w.time_of_day ?? []).includes(x.id)).map((x) => tt(TIME_KEY[x.id])).join(tt('list.sep')),
  ].filter(Boolean).join(' · ')
  const options: { id: string | null; title: string; sub: string; Icon: LucideIcon }[] = [
    { id: null, title: t('walk.near_home_title'), sub: t('walk.near_home_sub'), Icon: House },
    ...goals.map((p) => p.label === 'School'
      ? { id: p.id, title: t('walk.to_school_title'), sub: t('walk.to_school_sub'), Icon: ICON.School }
      : { id: p.id, title: t('walk.to_work_title'), sub: t('walk.to_work_sub'), Icon: ICON.Work }),
  ]

  return (
    <div className="grid grid-cols-1 gap-7">
      <Journey at={showForm || !home ? 1 : 2} locale={locale} />

      {saved && saved.matches > 0 ? (
        <Notice tone="good">
          <span className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <span className="grid grid-cols-1 gap-1">
              <strong className="text-[17px]">{t(saved.matches === 1 ? 'walk.found_one' : 'walk.found_other', { count: saved.matches })}</strong>
              <span>
                {t('walk.found_body')}{' '}
                <Link href={withLang('/together/matches', locale)} className="font-semibold underline">{tt('see_matches')}</Link>
              </span>
            </span>
          </span>
        </Notice>
      ) : null}

      {hasMatch && !saved ? (
        <Notice tone="good">
          <Link href={withLang('/together/matches', locale)} className="font-semibold underline">{t('walk.has_match')}</Link>
        </Notice>
      ) : null}

      {!home ? (
        <Card className="grid grid-cols-1 gap-5">
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('walk.title')}</h1>
            <p className="mt-2 text-[16px] text-(--ev-ink-85)">{t('walk.home_intro')}</p>
          </div>
          {photo}
          <Field label={tt('practice.your_home')} hint={tt('home.hint')} error={addrErr}>
            <AddressAutocomplete
              value={addr.address}
              onChange={(a) => setAddr({ ...EMPTY, address: a })}
              onPlaceSelected={(p) => setAddr({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
              label={null}
              placeholder={tt('home.placeholder')}
            />
          </Field>
          <div><Button variant="primary" busy={addrBusy} onClick={() => void saveAddress('Home')}>{tt('practice.save_home')}</Button></div>
        </Card>
      ) : null}

      {home && !showForm && existing ? (
        <Card>
          <h1 className="font-display text-[clamp(26px,3.6vw,32px)] font-extrabold">
            {saved && saved.matches === 0 ? t('walk.done_title') : t('walk.screen')}
          </h1>
          {saved && saved.matches === 0 ? <p className="mt-1 text-[16px] text-(--ev-ink-85)">{t('walk.done_body')}</p> : null}
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ev-accent-fill) text-(--ev-on-accent-fill)" aria-hidden>
                <Footprints className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{whereLabel(existing.destination_location_id)}</p>
                <p className="text-[15px] text-(--ev-ink-80)">{whenLabel(existing)}</p>
              </div>
              <Badge tone={existing.status === 'matched' ? 'good' : 'info'}>{existing.status === 'matched' ? tt('status.matched') : tt('status.looking')}</Badge>
            </div>
            {stopping ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-(--ev-panel) p-3">
                <span className="text-[15px] font-semibold">{tt('stop.confirm')}</span>
                <Button size="sm" onClick={() => void stop()}>{tt('stop.yes')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(false)}>{tt('stop.keep')}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setSaved(null); setErr(null); setEditing(true) }}>{tt('change')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setStopping(true)}>{t('walk.stop')}</Button>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={withLang('/together/matches', locale)} className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold hover:bg-(--ev-panel)">{tt('see_matches')}</Link>
            <Link href={withLang('/together', locale)} className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">{tt('practice.back')}</Link>
          </div>
        </Card>
      ) : null}

      {/* Nobody yet: group walks near home while Shift keeps looking, never a dead end. */}
      {home && !showForm && existing && existing.status !== 'matched' && !(saved && saved.matches > 0) ? (
        <GroupWalks locale={locale} />
      ) : null}

      {showForm ? (
        <form onSubmit={submit} className="grid grid-cols-1 gap-6" noValidate>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-8">
            <div>
              <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold leading-tight">{t('walk.title')}</h1>
              <p className="mt-2 text-[16px] text-(--ev-ink-85)">{t('walk.intro')}</p>
            </div>
            {photo}
          </div>
          <Card className="grid grid-cols-1 gap-6">
            <Field label={t('walk.where_q')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('walk.where_q')}>
                {options.map((o) => (
                  <button
                    key={o.id ?? 'home'}
                    type="button"
                    role="radio"
                    aria-checked={dest === o.id}
                    onClick={() => setDest(o.id)}
                    className={cx(
                      'flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition',
                      dest === o.id ? 'border-(--ev-accent) ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line-strong) hover:bg-(--ev-panel)',
                    )}
                  >
                    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', dest === o.id ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-accent)')} aria-hidden>
                      <o.Icon className="h-5 w-5" />
                    </span>
                    <span className="grid grid-cols-1 gap-1">
                      <span className="text-[17px] font-bold leading-snug">{o.title}</span>
                      <span className="text-[15px] leading-snug text-(--ev-ink-80)">{o.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              {/* No Work or School saved: the way to walk to one with someone. */}
              {!goals.length ? (
                addWork ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-(--ev-panel) p-4">
                    <Field label={t('walk.work_label')} hint={tt('home.hint')} error={addrErr}>
                      <AddressAutocomplete
                        value={addr.address}
                        onChange={(a) => setAddr({ ...EMPTY, address: a })}
                        onPlaceSelected={(p) => setAddr({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
                        label={null}
                        includeAreas
                        placeholder={tt('home.placeholder')}
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button busy={addrBusy} onClick={() => void saveAddress('Work')}>{t('walk.save_work')}</Button>
                      <Button variant="ghost" onClick={() => { setAddWork(false); setAddr(EMPTY); setAddrErr(null) }}>{tt('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddWork(true)} className="mt-3 min-h-[44px] text-left text-[15px] font-semibold text-(--ev-accent) underline">
                    {t('walk.add_work')}
                  </button>
                )
              ) : null}
            </Field>

            <Field label={t('walk.times_q')}>
              <div className="flex flex-wrap gap-2">
                {TIMES.map((x) => <Chip key={x.id} on={times.includes(x.id)} onClick={() => setTimes((v) => (v.includes(x.id) ? v.filter((y) => y !== x.id) : [...v, x.id]))}>{tt(TIME_KEY[x.id])}</Chip>)}
              </div>
            </Field>

            <Field label={t('walk.days_q')} hint={t('walk.days_hint')}>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => <Chip key={d.id} on={days.includes(d.id)} onClick={() => setDays((v) => (v.includes(d.id) ? v.filter((y) => y !== d.id) : [...v, d.id]))}>{tt(DAY_KEY[d.id])}</Chip>)}
              </div>
            </Field>

            <Field label={tt('lang_q')} hint={tt('lang_hint')}>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => {
                  const on = (languages ?? []).includes(l.id)
                  return (
                    <Chip key={l.id} on={on} onClick={() => setLanguages((v) => (on ? (v ?? []).filter((x) => x !== l.id) : [...(v ?? []), l.id]))}>
                      <span lang={l.id}>{l.label}</span>
                    </Chip>
                  )
                })}
              </div>
            </Field>

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
            <div className="grid grid-cols-1 gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" busy={busy} disabled={!times.length}>{existing ? t('walk.save_changes') : t('walk.submit')}</Button>
                {existing ? <Button variant="ghost" onClick={() => { setEditing(false); setErr(null) }}>{tt('cancel')}</Button> : null}
              </div>
              {!times.length ? <p className="text-[15px] text-(--ev-ink-80)">{t('walk.need_time')}</p> : null}
              <p className="text-[15px] leading-snug text-(--ev-ink-80)">{t('walk.privacy')}</p>
            </div>
          </Card>
        </form>
      ) : null}
    </div>
  )
}

/** Group walks near home (the app's PartnerFallback for a walk sign-up): the next three within 5 miles. */
function GroupWalks({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherMoreStrings, locale)
  const [walks, setWalks] = useState<GroupWalk[] | null>(null)
  useEffect(() => {
    let live = true
    void groupWalks().then((w) => { if (live) setWalks(w) })
    return () => { live = false }
  }, [])
  const today = new Date().toISOString().slice(0, 10)
  const shown = (walks ?? []).filter((w) => w.event_date >= today)
  return (
    <section aria-labelledby="walk-groups" className="grid grid-cols-1 gap-3">
      <h2 id="walk-groups" className="font-display text-[22px] font-extrabold">{t('walk.nobody')}</h2>
      {shown.length ? (
        <Card className="grid grid-cols-1 gap-3">
          <div>
            <h3 className="text-[18px] font-bold">{t('walk.walks_title')}</h3>
            <p className="text-[15px] text-(--ev-ink-80)">{t('walk.walks_sub')}</p>
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {shown.map((w) => (
              <li key={w.id}>
                <Link
                  href={withLang(`/events/${w.id}`, locale)}
                  onClick={() => track('together_group_walk_opened', { source: 'walk' })}
                  className="grid grid-cols-1 gap-1 rounded-xl border border-(--ev-line-strong) bg-white p-3 hover:bg-(--ev-panel)"
                >
                  <span className="text-[16px] font-bold">{w.title}</span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-(--ev-ink-80)">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" aria-hidden /> {siteDate(locale, `${w.event_date}T12:00:00`, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {w.location_name ? (
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> {w.location_name}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Link href={withLang('/events/walking-groups', locale)} className="min-h-[44px] text-[15px] font-semibold text-(--ev-accent) underline">
        {t('walk.more_walks')}
      </Link>
    </section>
  )
}
