'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Car, Eye, Handshake, LogOut, MailCheck, MapPinned, Plane, ShieldCheck, Sprout, TrainFront, UsersRound, type LucideIcon } from 'lucide-react'
import { toneClass } from '@/components/events/EventsTone'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import HowItWorks from '@/components/together/HowItWorks'
import { PHOTOS, PhotoBand } from '@/components/together/photos'
import { translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { togetherStrings, type TogetherKey } from '@/lib/site-strings/together'
import { loganStrings, type LoganKey } from '@/lib/site-strings/logan'
import { supabase } from '@/lib/supabase'
import { togetherOn, track } from '@/lib/together'
import '@/components/events/events-tone.css'

/**
 * Shift Together on the web: sign-in and the frame (Phase A, Keith
 * 2026-10-27). Sign-in is the Shift account's own email link, the same flow
 * as the organizer console (ConsoleContext): the link goes through
 * shift.gogreenstreets.org/auth/confirm and comes back here as ?token_hash=.
 * Signing in on the web creates the same Shift account the app would, so a
 * web-only person is matched with app users like anyone else.
 */
type Phase = 'checking' | 'signed_out' | 'off' | 'ready' | 'error'

/** 'logan': gogreenstreets.org/logan (Shift 01518), open to anyone signed in, with its own words. */
export type ShellVariant = 'together' | 'logan'
/** 'guide': /together?kind=guide, signed out, speaks to someone offering to go with a neighbor (Keith 2026-11-13). */
export type ShellAudience = 'guide'

/** `locale`: the page's language (/together and /logan pass it). */
type State = { phase: Phase; userId: string | null; email: string | null; notice: string | null; signOut: () => Promise<void>; variant: ShellVariant; audience?: ShellAudience; locale: SiteLocale; t: T<TogetherKey> }
const Ctx = createContext<State | null>(null)

/** What someone offering to go with a neighbor wants to know first: how far, who, and that it's safe (the MassBike post's points). */
const GUIDE_POINTS: { label: TogetherKey; Icon: LucideIcon }[] = [
  { label: 'guide.point_miles', Icon: MapPinned },
  { label: 'guide.point_preview', Icon: Eye },
  { label: 'guide.point_safe', Icon: ShieldCheck },
]
const WAYS_TO_GO: { label: TogetherKey; Icon: LucideIcon }[] = [
  { label: 'kind.newcomer', Icon: Sprout },
  { label: 'kind.guide', Icon: UsersRound },
  { label: 'kind.carpool', Icon: Car },
]

export function useTogether(): State {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTogether outside TogetherShell')
  return v
}

export default function TogetherShell({ children, variant = 'together', audience, locale = 'en' }: { children: ReactNode; variant?: ShellVariant; audience?: ShellAudience; locale?: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  const [phase, setPhase] = useState<Phase>('checking')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const tokenHash = params.get('token_hash')
        const type = params.get('type')
        if (tokenHash && (type === 'email' || type === 'magiclink')) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
          params.delete('token_hash')
          params.delete('type')
          const rest = params.toString()
          window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
          if (error) {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
              setNotice(t('signin.expired'))
              setPhase('signed_out')
              return
            }
          }
          track('together_signed_in')
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setPhase('signed_out')
          return
        }
        setUserId(session.user.id)
        setEmail(session.user.email ?? null)
        // Logan trips are open to everyone; the rest of Shift Together waits for its switch.
        setPhase(variant === 'logan' || (await togetherOn(session.user.id)) ? 'ready' : 'off')
      } catch {
        setPhase('error')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on arrival
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null)
        setPhase('signed_out')
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <Ctx.Provider value={{ phase, userId, email, notice, signOut, variant, audience, locale, t }}>
      <div className={cx('min-h-[70dvh] bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
        <SubBar />
        <div className="mx-auto w-full max-w-[920px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <Gate>{children}</Gate>
        </div>
      </div>
    </Ctx.Provider>
  )
}

/** Under the site header once signed in: the two pages and the account. */
function SubBar() {
  const { phase, email, signOut, variant, locale, t } = useTogether()
  const path = usePathname()
  if (phase !== 'ready' && phase !== 'off') return null
  const nav = [
    { href: '/together', label: t('shell.your_signup'), active: path === '/together' || path.startsWith('/together/practice') },
    { href: '/together/matches', label: t('shell.your_matches'), active: path.startsWith('/together/matches') },
  ]
  return (
    <div className="border-b border-(--ev-line) bg-(--ev-bar)">
      <div className="mx-auto flex min-h-[56px] max-w-[920px] items-center gap-x-4 px-4 sm:px-6">
        <span className={cx('font-display text-[17px] font-extrabold', variant === 'logan' ? 'inline' : 'hidden sm:inline')}>
          {variant === 'logan' ? translator(loganStrings, locale)('logan.bar_title') : 'Shift Together'}
        </span>
        {phase === 'ready' && variant === 'together' && (
          <nav aria-label="Shift Together" className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={withLang(n.href, locale)}
                aria-current={n.active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-[44px] items-center rounded-lg px-3 text-[15px] font-semibold',
                  n.active ? 'bg-(--ev-panel) text-(--ev-ink)' : 'text-(--ev-ink-80) hover:bg-(--ev-panel)',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {email ? <span className="hidden truncate text-[14px] text-(--ev-ink-75) md:inline">{email}</span> : null}
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label={t('shell.sign_out')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t('shell.sign_out')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const STEPS: { title: TogetherKey; hint: TogetherKey; Icon: LucideIcon }[] = [
  { title: 'step.trip', hint: 'step.trip_hint', Icon: MapPinned },
  { title: 'step.match', hint: 'step.match_hint', Icon: UsersRound },
  { title: 'step.yes', hint: 'step.yes_hint', Icon: Handshake },
]

/**
 * Where the person is in Shift Together: tell us your trip, we find a match,
 * you both say yes. Full (with a line each) on the sign-in page; compact on
 * the signed-in pages, with the current step marked.
 */
export function Journey({ at, full = false, locale = 'en' }: { at?: 1 | 2 | 3; full?: boolean; locale?: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  const step = at ? STEPS[at - 1] : null
  return (
    <>
      {!full && step && at ? (
        // Phones: one line, "Step 2 of 3", and three bars.
        <div className="flex items-center gap-3 sm:hidden">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => <span key={n} className={cx('h-2 w-6 rounded-full', n <= at ? 'bg-(--ev-accent)' : 'bg-(--ev-line-strong)')} />)}
          </span>
          <span className="text-[15px] font-semibold">{t('step.of', { n: at, title: t(step.title) })}</span>
        </div>
      ) : null}
      <JourneySteps at={at} full={full} t={t} />
    </>
  )
}

function JourneySteps({ at, full, t }: { at?: 1 | 2 | 3; full: boolean; t: T<TogetherKey> }) {
  return (
    <ol className={cx('gap-3', full ? 'grid grid-cols-1 sm:grid-cols-3' : 'hidden grid-cols-3 gap-2 sm:grid')} aria-label={t('step.aria')}>
      {STEPS.map(({ title, hint, Icon }, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const now = at === n
        const done = at != null && n < at
        return (
          <li
            key={title}
            aria-current={now ? 'step' : undefined}
            className={cx(
              'flex gap-3 rounded-2xl border',
              full ? 'items-start bg-white p-4' : 'flex-col items-start p-3 sm:flex-row sm:items-center',
              now ? 'border-(--ev-accent) bg-white ring-2 ring-(--ev-accent-tint-15)' : 'border-(--ev-line)',
              !full && !now && 'bg-transparent',
            )}
          >
            <span
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                now || done || full ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-ink-80)',
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={cx('block font-bold leading-snug', full ? 'text-[17px]' : 'text-[14px] sm:text-[15px]')}>
                {full ? `${n}. ${t(title)}` : t(title)}
              </span>
              {full ? <span className="mt-1 block text-[15px] leading-snug text-(--ev-ink-80)">{t(hint)}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const { phase, variant, locale, t } = useTogether()
  if (phase === 'checking') return <Spinner label={variant === 'logan' ? translator(loganStrings, locale)('logan.opening') : t('shell.opening')} />
  if (phase === 'signed_out') return <SignIn />
  if (phase === 'off') {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-[24px] font-extrabold">{t('shell.off_title')}</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">
          {t('shell.off_body')}
        </p>
      </Card>
    )
  }
  if (phase === 'error') {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-[16px] text-(--ev-ink-85)">{t('shell.error')}</p>
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>{t('shell.try_again')}</Button>
      </Card>
    )
  }
  return <>{children}</>
}

const LOGAN_POINTS: { label: LoganKey; Icon: LucideIcon }[] = [
  { label: 'logan.point_transit', Icon: TrainFront },
  { label: 'logan.point_split', Icon: Car },
  { label: 'logan.point_both', Icon: Plane },
]

/** Keith's three steps and drawings (approved 2026-11-08; public/images/logan, also in the launch email). */
const LOGAN_STEPS: { title: LoganKey; hint: LoganKey; img: string; alt: LoganKey; chips: LoganKey[] }[] = [
  { title: 'logan.step1_title', hint: 'logan.step1_hint', img: '/images/logan/step-1.svg', alt: 'logan.step1_alt', chips: [] },
  { title: 'logan.step2_title', hint: 'logan.step2_hint', img: '/images/logan/step-2.svg', alt: 'logan.step2_alt', chips: [] },
  { title: 'logan.step3_title', hint: 'logan.step3_hint', img: '/images/logan/step-3.svg', alt: 'logan.step3_alt', chips: ['logan.chip_split', 'logan.chip_silver', 'logan.chip_one_car'] },
]

const KIND_STORE = 'together_kind'
const KINDS = ['newcomer', 'guide', 'carpool'] as const
export type KindParam = (typeof KINDS)[number]

/** Before the sign-in link goes out: keep ?kind= in this browser too, in case the email link drops it. */
function rememberKind() {
  const k = new URLSearchParams(window.location.search).get('kind')
  try {
    if (k && (KINDS as readonly string[]).includes(k)) localStorage.setItem(KIND_STORE, k)
  } catch { /* private window: the link still carries it */ }
}

/** The choice the link asked for (?kind=guide | newcomer | carpool), else the one kept at sign-in. Read once. */
export function takeKindParam(): KindParam | null {
  let k = new URLSearchParams(window.location.search).get('kind')
  try {
    k = k ?? localStorage.getItem(KIND_STORE)
    localStorage.removeItem(KIND_STORE)
  } catch { /* storage blocked */ }
  return k && (KINDS as readonly string[]).includes(k) ? (k as KindParam) : null
}

function SignIn() {
  const { notice, variant, audience, locale, t } = useTogether()
  const logan = variant === 'logan'
  const guide = !logan && audience === 'guide'
  // Arrived from a match email: just the sign-in, in the email's words.
  const path = usePathname()
  const forMatch = !logan && path.startsWith('/together/matches')
  const tl = translator(loganStrings, locale)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // "We sent a sign-in link to {email}. …" with the address in bold, in any word order.
  const [sentBefore, sentAfter = ''] = t('signin.sent').split('{email}')

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErr(t('signin.need_email'))
      return
    }
    setBusy(true)
    setErr(null)
    // Back to this same page with its ?lang, ?kind and campaign tags (the Thursday email's buttons carry &kind=).
    rememberKind()
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}` },
    })
    setBusy(false)
    if (error) {
      // "only request this after N seconds" is this person; "email rate limit exceeded" is everyone at once.
      setErr(/seconds/i.test(error.message) ? t('signin.rate') : /rate limit/i.test(error.message) ? t('signin.busy') : t('signin.failed'))
      return
    }
    setSent(addr)
    track('together_signin_link_sent')
  }

  const card = (
    <Card className={cx('shadow-(--ev-shadow)', !forMatch && 'md:col-start-2 md:row-span-2 md:row-start-1')}>
      {sent ? (
        <div>
          <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
          <h2 className="mt-3 font-display text-[22px] font-extrabold">{t('signin.inbox')}</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">
            {sentBefore}<strong>{sent}</strong>{sentAfter}
          </p>
          <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">{t('signin.look_for')}</p>
          <button type="button" onClick={() => setSent(null)} className="mt-3 min-h-[44px] text-[15px] font-semibold text-(--ev-accent) underline">
            {t('signin.other_email')}
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="grid gap-4">
          {/* Shift Together says what's free and what happens next in place of a heading; Logan keeps its heading. */}
          {logan ? <h2 className="font-display text-[22px] font-extrabold">{t('signin.heading')}</h2> : null}
          {logan || forMatch ? null : <p className="text-[17px] font-semibold leading-snug">{t(guide ? 'guide.form_lead' : 'signin.form_lead')}</p>}
          {notice ? <Notice tone="warn">{notice}</Notice> : null}
          <Field label={t('signin.email')} htmlFor="together-email" error={err ?? undefined}>
            <Input id="together-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" variant="primary" busy={busy}>{t('signin.send')}</Button>
          {logan || forMatch ? null : (
            <p className="text-[15px] leading-snug text-(--ev-ink-80)">
              {t('signin.expo')}
            </p>
          )}
        </form>
      )}
    </Card>
  )

  if (forMatch) {
    return (
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-6 pt-2 md:pt-6">
        <div>
          <h1 className="font-display text-[clamp(28px,4vw,36px)] font-extrabold leading-tight text-balance">{t('signin.match_title')}</h1>
          <p className="mt-2 text-[17px] leading-snug text-(--ev-ink-85)">{t('signin.match_body')}</p>
        </div>
        {card}
      </div>
    )
  }

  return (
    <div className={cx('grid grid-cols-1 pt-2 md:pt-6', logan ? 'gap-8' : 'gap-12 md:gap-14')}>
      {/* Phone: a photo band, what this is, then the sign-in, then how it works. Wide: the band, then heading and ways left, sign-in right.
          The band stays short on phones so the email field is still on the first screen (390x844). */}
      <div className="grid grid-cols-1 gap-5 md:gap-8">
      {logan ? null : (
        guide ? (
          // The Charles River path by the Weeks Bridge: the calm kind of ride a guide offers (Gilman stays in step 3).
          <PhotoBand photo={PHOTOS.river} alt={t('practice.photo_alt')} place={t('practice.photo_place')} creditLabel={t('photo.by', { who: PHOTOS.river.credit })}
            className="h-[136px] sm:h-[220px] md:h-[280px]" priority />
        ) : (
        <PhotoBand photo={PHOTOS.concord} alt={t('hero.alt')} place={t('hero.place')} creditLabel={t('photo.by', { who: PHOTOS.concord.credit })}
          className="h-[136px] sm:h-[220px] md:h-[280px]" priority />
        )
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.15fr_1fr] md:items-start md:gap-x-10">
        <div className="md:col-start-1 md:row-start-1">
          {/* No line above the heading on Shift Together (no eyebrows, enrich pass 2026-11-09); Logan keeps its own. */}
          {logan ? <p className="mb-2 text-[15px] font-semibold text-(--ev-accent)">{tl('logan.eyebrow')}</p> : null}
          <h1 className="font-display text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.05] text-balance">
            {logan ? tl('logan.signin_title') : t(guide ? 'guide.title' : 'signin.title')}
          </h1>
          {logan ? null : <p className="mt-3 text-[clamp(18px,2vw,21px)] font-semibold leading-snug text-(--ev-ink-85)">{t(guide ? 'guide.lead' : 'signin.lead')}</p>}
        </div>
        {card}
        <div className="grid gap-3 md:col-start-1 md:row-start-2">
        <ul className="grid gap-2" aria-label={t(guide ? 'guide.points_aria' : 'signin.ways_aria')}>
          {(logan ? LOGAN_POINTS.map((p) => ({ label: tl(p.label), Icon: p.Icon })) : (guide ? GUIDE_POINTS : WAYS_TO_GO).map((w) => ({ label: t(w.label), Icon: w.Icon }))).map(({ label, Icon }) => (
            <li key={label} className="flex items-center gap-3 text-[17px] font-semibold">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
        {guide ? (
          // A reader passing it on to a friend who'd like to start: the newcomer version of this page.
          <a href={withLang('/together?kind=newcomer', locale)} className="text-[16px] font-semibold text-(--ev-accent) underline underline-offset-2">
            {t('guide.newcomer_link')}
          </a>
        ) : null}
        </div>
      </div>
      </div>
      <section aria-labelledby="together-how">
        <h2 id="together-how" className={cx('font-display font-extrabold', logan ? 'mb-3 text-[22px]' : 'mb-8 text-[28px]')}>{t('signin.how')}</h2>
        {logan ? (
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LOGAN_STEPS.map((st, i) => (
              <li key={st.title} className="grid content-start gap-3 rounded-2xl border border-(--ev-line) bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
                <img src={st.img} alt={tl(st.alt)} width={240} height={170} className="h-auto w-full max-w-[360px]" />
                <span className="min-w-0">
                  <span className="block font-display text-[13px] font-extrabold tracking-[0.08em] text-(--ev-accent)">{tl('logan.step_n', { n: i + 1 })}</span>
                  <span className="mt-1 block text-[17px] font-bold leading-snug">{tl(st.title)}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-(--ev-ink-80)">{tl(st.hint)}</span>
                </span>
                {st.chips.length ? (
                  <span className="flex flex-wrap gap-2">
                    {st.chips.map((c) => (
                      <span key={c} className="rounded-full bg-(--ev-panel) px-3 py-1 text-[13px] font-bold text-(--ev-accent)">{tl(c)}</span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : <HowItWorks locale={locale} side={guide ? 'guide' : 'newcomer'} />}
        {logan ? <p className="mt-4 text-[15px] leading-snug text-(--ev-ink-80)">{tl('logan.free')}</p> : null}
      </section>
    </div>
  )
}
