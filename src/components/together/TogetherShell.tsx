'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { LogOut, MailCheck } from 'lucide-react'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
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

type State = { phase: Phase; userId: string | null; email: string | null; notice: string | null; signOut: () => Promise<void> }
const Ctx = createContext<State | null>(null)

export function useTogether(): State {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTogether outside TogetherShell')
  return v
}

export default function TogetherShell({ children }: { children: ReactNode }) {
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
        setPhase((await togetherOn(session.user.id)) ? 'ready' : 'off')
      } catch {
        setPhase('error')
      }
    })()
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
    <Ctx.Provider value={{ phase, userId, email, notice, signOut }}>
      <div className={cx('min-h-dvh bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
        <TopBar />
        <main className="mx-auto w-full max-w-[860px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
          <Gate>{children}</Gate>
        </main>
      </div>
    </Ctx.Provider>
  )
}

function TopBar() {
  const { phase, email, signOut } = useTogether()
  const path = usePathname()
  const nav = [
    { href: '/together', label: 'Sign up', active: path === '/together' },
    { href: '/together/matches', label: 'Your matches', active: path.startsWith('/together/matches') },
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-(--ev-line) bg-(--ev-bar) backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-[860px] items-center gap-3 px-4 sm:px-6">
        <Link href="/together" className="flex shrink-0 items-center gap-2.5" aria-label="Shift Together home">
          <ShiftWordmark tone="dark" height={22} />
          <span className="hidden border-l border-(--ev-line-strong) pl-2.5 text-[14px] font-semibold text-(--ev-ink-80) sm:inline">Together</span>
        </Link>
        {phase === 'ready' && (
          <nav aria-label="Shift Together" className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.active ? 'page' : undefined}
                className={cx('rounded-lg px-3 py-2 text-[14px] font-semibold', n.active ? 'bg-(--ev-panel) text-(--ev-ink)' : 'text-(--ev-ink-80) hover:bg-(--ev-panel)')}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        {(phase === 'ready' || phase === 'off') && email && (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-[14px] text-(--ev-ink-75) md:inline">{email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const { phase } = useTogether()
  if (phase === 'checking') return <Spinner label="Opening Shift Together" />
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

function SignIn() {
  const { notice } = useTogether()
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
    // Phone: heading, then the sign-in, then the details. Wide: text left, sign-in right.
    <div className="grid gap-6 pt-2 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-x-8 md:pt-8">
      <div className="md:col-start-1 md:row-start-1 md:self-end">
        <p className="text-[15px] font-semibold text-(--ev-accent)">Shift Together</p>
        <h1 className="mt-2 font-display text-[clamp(30px,4.2vw,42px)] font-extrabold leading-[1.05]">
          Try a new way to get there, with someone who knows it
        </h1>
      </div>
      <Card className="shadow-(--ev-shadow) md:col-start-2 md:row-span-2 md:row-start-1">
        {sent ? (
          <div>
            <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
            <h2 className="mt-3 font-display text-[22px] font-extrabold">Check your inbox</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-85)">
              We sent a sign-in link to <strong>{sent}</strong>. Open it on this device to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-4">
            <h2 className="font-display text-[22px] font-extrabold">Sign in with your email</h2>
            {notice ? <Notice tone="warn">{notice}</Notice> : null}
            <Field label="Email" htmlFor="together-email" error={err ?? undefined}>
              <Input id="together-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Button type="submit" variant="primary" busy={busy}>Email me a sign-in link</Button>
            <p className="text-[14px] leading-snug text-(--ev-ink-75)">
              Signed up at the Somerville Connection Expo? Use the same email, and we&rsquo;ll pick up where you left off.
            </p>
          </form>
        )}
      </Card>
      <div className="md:col-start-1 md:row-start-2 md:self-start">
        <ul className="space-y-2.5 text-[16px] leading-snug text-(--ev-ink-85)">
          <li>Go with a neighbor who already bikes, walks or takes the bus or train on your trip.</li>
          <li>Or show the way to someone trying it for the first time.</li>
          <li>Or share the drive with someone whose trip fits yours.</li>
        </ul>
        <p className="mt-5 text-[15px] leading-snug text-(--ev-ink-75)">
          Free, from Green Streets Initiative. Your match sees only your first name until you both say yes. No app needed.
        </p>
      </div>
    </div>
  )
}
