'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bike, CheckCircle2, MailCheck, MapPin, UsersRound, type LucideIcon } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { toneClass } from '@/components/events/EventsTone'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import NextSteps from '@/components/together/NextSteps'
import PinMap, { type Pin } from '@/components/together/PinMap'
import { Chip } from '@/components/together/bits'
import { PHOTOS, PhotoBand } from '@/components/together/photos'
import { trackAdConversion } from '@/lib/ad-pixels'
import { gaEvent } from '@/lib/ga'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { DAY_KEY, togetherStrings } from '@/lib/site-strings/together'
import { togetherStartStrings } from '@/lib/site-strings/together-start'
import { supabase } from '@/lib/supabase'
import {
  acceptTerms, hasAcceptedTerms, myMatches, mySignUps, savePlace, saveSignUp, track,
  type PartnerDay, type PartnerTime,
} from '@/lib/together'
import { finishAsk, startAsk, takeAsk, utmFromUrl, type AskPlace } from '@/lib/together-start'
import '@/components/events/events-tone.css'

/**
 * gogreenstreets.org/together/start (Keith 2026-11-19, the beginners bet,
 * docs/programs/marketing/bets/together-learners.md). Four questions before
 * any sign-in: home, work, which mornings, email. The answers are saved
 * (start_together_ask, Shift 01854), then the sign-in link goes out; it
 * comes back here with ?ask=, and the sign-up is saved through the same
 * calls as /together, so matching works exactly as in the app.
 */
type Phase = 'checking' | 'form' | 'sent' | 'finishing' | 'done'
type Place = { address: string; lat: number | null; lng: number | null; placeId: string | null }
const EMPTY: Place = { address: '', lat: null, lng: null, placeId: null }
const WEEKDAYS: PartnerDay[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const STEPS: { key: 'how_1' | 'how_2' | 'how_3'; Icon: LucideIcon }[] = [
  { key: 'how_1', Icon: MapPin },
  { key: 'how_2', Icon: UsersRound },
  { key: 'how_3', Icon: Bike },
]

/**
 * Where the bike volunteers live, as neighborhood centers (never anyone's
 * home): the two areas the ads run in (beginners bet, 2026-11-19).
 */
const AREAS: Pin[] = [
  { lat: 42.3796, lng: -71.0935, kind: 'match', label: 'Union Sq' },
  { lat: 42.3967, lng: -71.1224, kind: 'match', label: 'Davis' },
  { lat: 42.4084, lng: -71.0537, kind: 'match', label: 'Everett' },
  { lat: 42.4251, lng: -71.0662, kind: 'match', label: 'Malden' },
  { lat: 42.3487, lng: -71.1527, kind: 'match', label: 'Brighton' },
  { lat: 42.3097, lng: -71.1151, kind: 'match', label: 'JP' },
  { lat: 42.3001, lng: -71.0617, kind: 'match', label: 'Dorchester' },
]

function asPlace(p: Place): AskPlace {
  return { address: p.address, lat: p.lat!, lng: p.lng!, placeId: p.placeId }
}

export default function Start({ locale }: { locale: SiteLocale }) {
  const t = translator(togetherStartStrings, locale)
  const tt = translator(togetherStrings, locale)
  const [phase, setPhase] = useState<Phase>('checking')
  const [userId, setUserId] = useState<string | null>(null)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [termsDone, setTermsDone] = useState(false)
  const [home, setHome] = useState<Place>(EMPTY)
  const [work, setWork] = useState<Place>(EMPTY)
  const [days, setDays] = useState<PartnerDay[]>(WEEKDAYS)
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** Which field an error belongs to: it shows under that field (1Password does this; polish 2026-11-19). */
  const [errAt, setErrAt] = useState<'home' | 'work' | 'days' | 'email' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [matches, setMatches] = useState(0)
  const ran = useRef(false)
  const begun = useRef(false)

  function begin() {
    if (begun.current) return
    begun.current = true
    gaEvent('together_start_begin', utmFromUrl())
    track('together_start_begin', utmFromUrl())
  }

  /** Signed in with the ask's email: save it as the person's sign-up and show what we found. */
  async function finish(id: string, uid: string) {
    setPhase('finishing')
    const got = await takeAsk(id)
    if (!got.ok) {
      setNotice(t(got.reason === 'not_found' ? 'not_found' : 'failed'))
      setPhase('form')
      return
    }
    try {
      if (got.ask.claimed) {
        // Opened the link again: the sign-up is already saved.
        setMatches((await myMatches()).length)
        setPhase('done')
        return
      }
      if (!(await hasAcceptedTerms(uid))) await acceptTerms()
      const [homeId, workId, mine] = await Promise.all([
        savePlace(uid, { label: 'Home', ...got.ask.home }),
        savePlace(uid, { label: 'Work', ...got.ask.work }),
        mySignUps().catch(() => null),
      ])
      // Someone who already asked in the app keeps what they said there; this adds bike, these mornings.
      const before = mine?.trips.find((r) => r.kind === 'newcomer')
      const r = await saveSignUp({
        kind: 'newcomer',
        modes: Array.from(new Set(['bike', ...(before?.modes ?? [])])) as ('bike' | 'transit' | 'micro' | 'walk')[],
        homeId,
        workId,
        days: Array.from(new Set([...(before?.days ?? []), ...got.ask.days])),
        times: Array.from(new Set<PartnerTime>([...(before?.time_of_day ?? []), 'morning'])),
        carpoolRole: null,
        arriveBy: null,
        leaveAt: null,
        note: before?.note ?? null,
        languages: before?.languages ?? [],
      })
      if (!r.ok) {
        track('together_start_failed', { reason: r.reason })
        setNotice(t('failed'))
        setPhase('form')
        return
      }
      await finishAsk(id)
      setMatches(r.matches)
      track('together_signup_saved', { kind: 'newcomer', from: 'start', matches: r.matches })
      // The Ad Grant's Shift Together result (Keith 2026-11-13), the same event /together sends.
      gaEvent('together_signup_saved', { kind: 'newcomer', from: 'start' })
      setPhase('done')
    } catch {
      setNotice(t('failed'))
      setPhase('form')
    }
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      const ask = params.get('ask')
      let linkFailed = false
      if (tokenHash && (type === 'email' || type === 'magiclink')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        linkFailed = !!error
      }
      for (const k of ['token_hash', 'type', 'ask']) params.delete(k)
      const rest = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        setSignedInAs(session.user.email ?? null)
        hasAcceptedTerms(session.user.id).then(setTermsDone).catch(() => {})
        if (ask) return finish(ask, session.user.id)
      } else if (ask || linkFailed) {
        setNotice(t('expired'))
      }
      setPhase('form')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    begin()
    const addr = (signedInAs ?? email).trim().toLowerCase()
    const fail = (at: typeof errAt, key: Parameters<typeof t>[0]) => { setErrAt(at); setErr(t(key)) }
    if (home.lat == null) return fail('home', 'need_home')
    if (work.lat == null) return fail('work', 'need_work')
    if (!days.length) return fail('days', 'need_days')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return fail('email', 'need_email')
    if (!termsDone && !agreed) return fail(null, 'need_terms')
    setBusy(true)
    setErr(null)
    setErrAt(null)
    setNotice(null)
    const utm = utmFromUrl()
    const saved = await startAsk({ email: addr, home: asPlace(home), work: asPlace(work), days, utm, locale })
    if (!saved.ok) {
      setBusy(false)
      track('together_start_failed', { reason: saved.reason })
      const at = saved.reason === 'home' || saved.reason === 'work' || saved.reason === 'email' ? saved.reason : null
      return fail(at, at ? (`need_${at}` as const) : 'failed')
    }
    // The ask the ads pay for: answers saved, before the email link (Meta custom conversion "TogetherAsk").
    trackAdConversion('TogetherAsk', { utm_source: utm.utm_source, utm_content: utm.utm_content })
    gaEvent('together_start_sent', utm)
    track('together_start_sent', { ...utm, signed_in: !!userId })
    if (userId) {
      setBusy(false)
      return finish(saved.id, userId)
    }
    const back = new URL(withLang(`/together/start?ask=${saved.id}`, locale), window.location.origin)
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: back.toString() } })
    setBusy(false)
    if (error) {
      return setErr(/seconds/i.test(error.message) ? t('rate') : t('failed'))
    }
    setSentTo(addr)
    setPhase('sent')
    // The "Check your email" card, not the top of the page: on a phone the card sits under the photo.
    requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const [sentBefore, sentAfter = ''] = t('sent_body').split('{email}')

  let card
  if (phase === 'checking' || phase === 'finishing') {
    card = <Spinner label={phase === 'finishing' ? t('finishing') : tt('shell.opening')} />
  } else if (phase === 'sent') {
    card = (
      <div>
        <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
        <h2 className="mt-3 font-display text-[24px] font-extrabold">{t('sent_title')}</h2>
        <p className="mt-2 text-[17px] leading-relaxed text-(--ev-ink-85)">{sentBefore}<strong>{sentTo}</strong>{sentAfter}</p>
        <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">{tt('signin.look_for')}</p>
        <button type="button" onClick={() => { setPhase('form'); setSentTo(null) }} className="mt-3 min-h-[44px] text-[16px] font-semibold text-(--ev-accent) underline">
          {t('other_email')}
        </button>
      </div>
    )
  } else if (phase === 'done') {
    card = matches > 0 ? (
      <div>
        <CheckCircle2 className="h-8 w-8 text-(--ev-accent)" aria-hidden />
        <h2 className="mt-3 font-display text-[24px] font-extrabold">{matches === 1 ? t('found_one') : t('found_many', { count: matches })}</h2>
        <p className="mt-2 text-[17px] leading-relaxed text-(--ev-ink-85)">{t('found_body')}</p>
        <Link href={withLang('/together/matches', locale)} className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-(--ev-accent) px-6 text-[17px] font-bold text-white">
          {t('see_matches')}
        </Link>
      </div>
    ) : (
      <div>
        <CheckCircle2 className="h-8 w-8 text-(--ev-accent)" aria-hidden />
        <h2 className="mt-3 font-display text-[24px] font-extrabold">{t('waiting_title')}</h2>
        <p className="mt-2 text-[17px] leading-relaxed text-(--ev-ink-85)">{t('waiting_body')}</p>
        <Link href={withLang('/together', locale)} className="mt-4 inline-flex min-h-[44px] items-center text-[16px] font-semibold text-(--ev-accent) underline">
          {t('see_signup')}
        </Link>
      </div>
    )
  } else {
    card = (
      <form onSubmit={submit} onChange={begin} className="grid gap-5" noValidate>
        <h2 className="font-display text-[22px] font-extrabold">{t('form_title')}</h2>
        {notice ? <Notice tone="warn">{notice}</Notice> : null}
        <Field label={t('home')} hint={t('home_hint')} error={errAt === 'home' ? err : null}>
          <AddressAutocomplete
            value={home.address}
            onChange={(a) => setHome({ ...EMPTY, address: a })}
            onPlaceSelected={(p) => setHome({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
            label={null}
            placeholder={t('home_placeholder')}
          />
        </Field>
        <Field label={t('work')} error={errAt === 'work' ? err : null}>
          <AddressAutocomplete
            value={work.address}
            onChange={(a) => setWork({ ...EMPTY, address: a })}
            onPlaceSelected={(p) => setWork({ address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId })}
            label={null}
            placeholder={t('work_placeholder')}
          />
        </Field>
        <Field label={t('days')} error={errAt === 'days' ? err : null}>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <Chip key={d} on={days.includes(d)} onClick={() => { begin(); setDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d])) }}>
                {tt(DAY_KEY[d])}
              </Chip>
            ))}
          </div>
        </Field>
        {signedInAs ? (
          <p className="text-[16px] text-(--ev-ink-85)">{t('signed_in_as', { email: signedInAs })}</p>
        ) : (
          <Field label={t('email')} hint={t('email_hint')} htmlFor="start-email" error={errAt === 'email' ? err : null}>
            <Input id="start-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
        )}
        {termsDone ? null : (
          <label className="flex items-start gap-3 rounded-xl bg-(--ev-panel) p-4 text-[15px] leading-snug">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {tt('terms')}{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">{tt('terms_link')}</a>
            </span>
          </label>
        )}
        {err && !errAt ? <Notice tone="off">{err}</Notice> : null}
        <div className="grid gap-2">
          <Button type="submit" variant="primary" busy={busy}>{t('submit')}</Button>
          <p className="text-[15px] leading-snug text-(--ev-ink-80)">{signedInAs ? t('after_signed_in') : t('after')}</p>
        </div>
      </form>
    )
  }

  return (
    <div className={cx('min-h-[70dvh] bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
      <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 gap-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:grid-cols-[1.1fr_1fr] md:items-start md:gap-x-12">
        {/* Phone: the photo, the promise, the form, then what happens next. Wide: promise and steps left, form right. */}
        <div className="grid gap-4 md:col-start-1 md:row-start-1">
          <PhotoBand photo={PHOTOS.gilman} alt={t('photo_alt')} place={t('photo_place')} creditLabel={t('photo_by', { who: PHOTOS.gilman.credit })}
            className="h-[120px] sm:h-[220px] md:h-[260px]" priority sizes="(min-width: 1040px) 560px, 100vw" />
          <h1 className="font-display text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.05] text-balance">{t('title')}</h1>
          <p className="text-[clamp(18px,2vw,21px)] font-semibold leading-snug text-(--ev-ink-85)">{t('lead')}</p>
        </div>
        <div ref={cardRef} className="grid scroll-mt-20 content-start gap-6 md:col-start-2 md:row-span-2 md:row-start-1">
          <Card className="shadow-(--ev-shadow)">{card}</Card>
          {/* Nobody within 2 miles yet: what to do meanwhile, the same block as /together (never just "we'll email you"). */}
          {phase === 'done' && matches === 0 ? <NextSteps kind="newcomer" ways={['bike']} source="saved" locale={locale} /> : null}
        </div>
        <section aria-labelledby="start-how" className="md:col-start-1 md:row-start-2">
          <h2 id="start-how" className="mb-4 font-display text-[22px] font-extrabold">{t('how')}</h2>
          <ol className="grid gap-3">
            {STEPS.map(({ key, Icon }, i) => (
              <li key={key} className="flex items-center gap-3 text-[17px] font-semibold">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
                  <Icon className="h-5 w-5" />
                </span>
                <span><span className="sr-only">{i + 1}. </span>{t(key)}</span>
              </li>
            ))}
          </ol>
          <PinMap pins={AREAS} title={t('map_title')} caption={t('where')} className="mt-6" width={400} height={400} boxClassName="aspect-square" minZoom={10} />
        </section>
      </div>
    </div>
  )
}
