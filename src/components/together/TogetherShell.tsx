'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Car, Handshake, LogOut, MailCheck, MapPinned, Plane, Sprout, TrainFront, UsersRound, type LucideIcon } from 'lucide-react'
import { toneClass } from '@/components/events/EventsTone'
import { Button, Card, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
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

type State = { phase: Phase; userId: string | null; email: string | null; notice: string | null; signOut: () => Promise<void>; variant: ShellVariant }
const Ctx = createContext<State | null>(null)

const WAYS_TO_GO: { label: string; Icon: LucideIcon }[] = [
  { label: 'Have someone show you how to bike, walk or take transit', Icon: Sprout },
  { label: 'Show someone how you bike, walk or take transit', Icon: UsersRound },
  { label: 'Find a carpool partner', Icon: Car },
]

export function useTogether(): State {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTogether outside TogetherShell')
  return v
}

export default function TogetherShell({ children, variant = 'together' }: { children: ReactNode; variant?: ShellVariant }) {
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
              setNotice('That sign-in link has expired or was already used. Send yourself a new one.')
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
    <Ctx.Provider value={{ phase, userId, email, notice, signOut, variant }}>
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
  const { phase, email, signOut, variant } = useTogether()
  const path = usePathname()
  if (phase !== 'ready' && phase !== 'off') return null
  const nav = [
    { href: '/together', label: 'Your sign-up', active: path === '/together' || path.startsWith('/together/practice') },
    { href: '/together/matches', label: 'Your matches', active: path.startsWith('/together/matches') },
  ]
  return (
    <div className="border-b border-(--ev-line) bg-(--ev-bar)">
      <div className="mx-auto flex min-h-[56px] max-w-[920px] items-center gap-x-4 px-4 sm:px-6">
        <span className={cx('font-display text-[17px] font-extrabold', variant === 'logan' ? 'inline' : 'hidden sm:inline')}>
          {variant === 'logan' ? 'Going to Logan together' : 'Shift Together'}
        </span>
        {phase === 'ready' && variant === 'together' && (
          <nav aria-label="Shift Together" className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
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
            aria-label="Sign out"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const STEPS: { title: string; hint: string; Icon: LucideIcon }[] = [
  { title: 'Tell us your trip', hint: 'What you\u2019d like to do, and where and when you go.', Icon: MapPinned },
  { title: 'We find a match', hint: 'Someone who lives near you and can go when you can.', Icon: UsersRound },
  { title: 'You both say yes', hint: 'Then you see each other\u2019s email and plan the first trip.', Icon: Handshake },
]

/**
 * Where the person is in Shift Together: tell us your trip, we find a match,
 * you both say yes. Full (with a line each) on the sign-in page; compact on
 * the signed-in pages, with the current step marked.
 */
export function Journey({ at, full = false }: { at?: 1 | 2 | 3; full?: boolean }) {
  const step = at ? STEPS[at - 1] : null
  return (
    <>
      {!full && step && at ? (
        // Phones: one line, "Step 2 of 3", and three bars.
        <div className="flex items-center gap-3 sm:hidden">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => <span key={n} className={cx('h-2 w-6 rounded-full', n <= at ? 'bg-(--ev-accent)' : 'bg-(--ev-line-strong)')} />)}
          </span>
          <span className="text-[15px] font-semibold">Step {at} of 3: {step.title}</span>
        </div>
      ) : null}
      <JourneySteps at={at} full={full} />
    </>
  )
}

function JourneySteps({ at, full }: { at?: 1 | 2 | 3; full: boolean }) {
  return (
    <ol className={cx('gap-3', full ? 'grid grid-cols-1 sm:grid-cols-3' : 'hidden grid-cols-3 gap-2 sm:grid')} aria-label="How Shift Together works">
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
                {full ? `${n}. ${title}` : title}
              </span>
              {full ? <span className="mt-1 block text-[15px] leading-snug text-(--ev-ink-80)">{hint}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const { phase, variant } = useTogether()
  if (phase === 'checking') return <Spinner label={variant === 'logan' ? 'Opening your trips' : 'Opening Shift Together'} />
  if (phase === 'signed_out') return <SignIn />
  if (phase === 'off') {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-[24px] font-extrabold">Shift Together opens soon</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">
          You&rsquo;re signed in. We&rsquo;ll email you when you can sign up here.
        </p>
      </Card>
    )
  }
  if (phase === 'error') {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-[16px] text-(--ev-ink-85)">Something went wrong opening Shift Together.</p>
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
      </Card>
    )
  }
  return <>{children}</>
}

const LOGAN_POINTS: { label: string; Icon: LucideIcon }[] = [
  { label: 'Take the T to the airport with someone from near you', Icon: TrainFront },
  { label: 'Or share a taxi or ride app and split the fare', Icon: Car },
  { label: 'Going there, coming home, or both', Icon: Plane },
]

const LOGAN_STEPS: { title: string; hint: string }[] = [
  { title: 'Tell us your flight', hint: 'When it leaves or lands, and where you live.' },
  { title: 'We find someone', hint: 'Near you, at the airport when you are.' },
  { title: 'You both say yes', hint: 'Then you get the plan and each other’s email.' },
]

function SignIn() {
  const { notice, variant } = useTogether()
  const logan = variant === 'logan'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErr('Enter your email address.')
      return
    }
    setBusy(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    setBusy(false)
    if (error) {
      setErr(/rate|seconds/i.test(error.message) ? 'A link was just sent. Give it a minute, then try again.' : "We couldn't send the link. Try again in a minute.")
      return
    }
    setSent(addr)
    track('together_signin_link_sent')
  }

  return (
    <div className="grid grid-cols-1 gap-8 pt-2 md:pt-6">
      {/* Phone: heading, then the sign-in, then how it works. Wide: heading and ways left, sign-in right. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.15fr_1fr] md:items-start md:gap-x-10">
        <div className="md:col-start-1 md:row-start-1">
          <p className="text-[15px] font-semibold text-(--ev-accent)">{logan ? 'Shift, from Green Streets Initiative' : 'Shift Together, from Green Streets Initiative'}</p>
          <h1 className="mt-2 font-display text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.05] text-balance">
            {logan ? 'Going to Logan? Find someone to go with' : 'Try a new way to get there, with someone who knows it'}
          </h1>
        </div>
        <Card className="shadow-(--ev-shadow) md:col-start-2 md:row-span-2 md:row-start-1">
          {sent ? (
            <div>
              <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
              <h2 className="mt-3 font-display text-[22px] font-extrabold">Check your inbox</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">
                We sent a sign-in link to <strong>{sent}</strong>. Open it on this phone or computer to continue.
              </p>
              <button type="button" onClick={() => setSent(null)} className="mt-3 min-h-[44px] text-[15px] font-semibold text-(--ev-accent) underline">
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="grid gap-4">
              <h2 className="font-display text-[22px] font-extrabold">Sign in with your email</h2>
              {notice ? <Notice tone="warn">{notice}</Notice> : null}
              <Field label="Email" htmlFor="together-email" error={err ?? undefined}>
                <Input id="together-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Button type="submit" variant="primary" busy={busy}>Email me a sign-in link</Button>
              {logan ? null : (
                <p className="text-[15px] leading-snug text-(--ev-ink-80)">
                  Met us at the Somerville Connection Expo? Use the email you gave us.
                </p>
              )}
            </form>
          )}
        </Card>
        <ul className="grid gap-2 md:col-start-1 md:row-start-2" aria-label="Ways to take part">
          {(logan ? LOGAN_POINTS : WAYS_TO_GO).map(({ label, Icon }) => (
            <li key={label} className="flex items-center gap-3 text-[17px] font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <section aria-labelledby="together-how">
        <h2 id="together-how" className="mb-3 font-display text-[22px] font-extrabold">How it works</h2>
        {logan ? (
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LOGAN_STEPS.map((st, i) => (
              <li key={st.title} className="flex items-start gap-3 rounded-2xl border border-(--ev-line) bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-fill) font-display text-[17px] font-extrabold text-(--ev-on-accent-fill)" aria-hidden>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold leading-snug">{st.title}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-(--ev-ink-80)">{st.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : <Journey full />}
        <p className="mt-4 text-[15px] leading-snug text-(--ev-ink-80)">
          {logan
            ? 'Free, and no app needed. Your match sees only your first name and town until you both say yes.'
            : 'Free, and no app needed. Your match sees only your first name until you both say yes.'}
        </p>
      </section>
    </div>
  )
}
