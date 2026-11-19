'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { LogOut, MailCheck, MessageSquareText } from 'lucide-react'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
import { toneClass } from '@/components/events/EventsTone'
import { supabase } from '@/lib/supabase'
import { AssistantDock, openAssistant } from './AssistantPanel'
import { ConsoleProvider, useConsole } from './ConsoleContext'
import ConsoleTracking from './ConsoleTracking'
import { track } from '@/lib/organizers/track'
import type { LinkProblem } from '@/lib/organizers/first-ride'
import { Button, Card, Field, Input, Notice, Spinner, cx } from './ui'
import '@/components/events/events-tone.css'

export default function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <ConsoleProvider>
      <ConsoleTracking />
      <Frame>{children}</Frame>
    </ConsoleProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const { phase, assistant } = useConsole()
  const [docked, setDocked] = useState(false)
  const onOpenChange = useCallback((o: boolean) => setDocked(o), [])
  return (
    <div className={cx('min-h-dvh bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
      <TopBar />
      {/* On wide screens the assistant docks at the right and the page makes room. */}
      <div className={cx(docked && 'xl:pr-[440px]')}>
        <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
          <Gate>{children}</Gate>
        </main>
      </div>
      <AssistantDock available={phase === 'ready' && assistant} onOpenChange={onOpenChange} />
    </div>
  )
}

function TopBar() {
  const { phase, me, assistant, signOut } = useConsole()
  const path = usePathname()
  const hostPage = !!me?.orgs?.some((o) => o.claim === 'verified' || o.claim === 'pending')
  const nav = [
    { href: '/organizers', label: 'Rides', active: path === '/organizers' || path.startsWith('/organizers/rides') },
    ...(hostPage ? [{ href: '/organizers/host', label: 'Host page', active: path.startsWith('/organizers/host') }] : []),
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-(--ev-line) bg-(--ev-bar) backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center gap-4 px-4 sm:px-6">
        <Link href="/organizers" className="flex shrink-0 items-center gap-2.5" aria-label="Organizer tools home">
          <ShiftWordmark tone="dark" height={22} />
          <span className="hidden border-l border-(--ev-line-strong) pl-2.5 text-[14px] font-semibold text-(--ev-ink-80) sm:inline">Organizer tools</span>
        </Link>
        {phase === 'ready' && (
          <nav aria-label="Console" className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.active ? 'page' : undefined}
                className={cx(
                  'rounded-lg px-3 py-2 text-[14px] font-semibold',
                  n.active ? 'bg-(--ev-panel) text-(--ev-ink)' : 'text-(--ev-ink-80) hover:bg-(--ev-panel)',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        {(phase === 'ready' || phase === 'no_access') && me?.email && (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {phase === 'ready' && assistant && (
              <button type="button" onClick={() => openAssistant()} title="Ask the assistant (Cmd or Ctrl + J)"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-(--ev-line-strong) bg-white px-3 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                <MessageSquareText className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Ask the assistant</span>
              </button>
            )}
            <span className="hidden truncate text-[14px] text-(--ev-ink-75) md:inline">{me.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[14px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)"
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
  const { phase, error, retry } = useConsole()
  // The assistant's data note is for anyone, signed in or not.
  if (usePathname() === '/organizers/assistant-data') return <>{children}</>
  if (phase === 'checking') return <Spinner label="Opening your rides" />
  if (phase === 'signed_out') return <SignIn />
  if (phase === 'no_access') return <NoAccess />
  if (phase === 'error') {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <p className="text-[15px] text-(--ev-ink-85)">{error}</p>
        <Button variant="primary" className="mt-4" onClick={retry}>Try again</Button>
      </Card>
    )
  }
  return <>{children}</>
}

function SignIn() {
  const { notice, clearNotice, linkToken } = useConsole()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  // Google, as in the app: a Gmail account signs in to the same Shift account
  // (an emailed link to that address does too). Comes back to this page; a
  // personal link stays in this browser and rides in the return address.
  async function google() {
    setGoogleBusy(true)
    setErr(null)
    clearNotice()
    track('organizer_signin_google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/organizers${linkToken ? `?link=${linkToken}` : ''}` },
    })
    if (error) {
      setGoogleBusy(false)
      setErr("We couldn't open Google. Try again, or use your email below.")
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErr('Enter your email address.')
      return
    }
    setBusy(true)
    setErr(null)
    clearNotice()
    // The link comes back to this page (www.gogreenstreets.org/** is on the
    // Shift sign-in allowlist); the app's own email carries it.
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      // A personal link rides along, so opening the email on another device still lets them in.
      options: { emailRedirectTo: `${window.location.origin}/organizers${linkToken ? `?link=${linkToken}` : ''}` },
    })
    setBusy(false)
    if (error) {
      setErr(/rate|seconds/i.test(error.message)
        ? 'A link was just sent. Give it a minute, then try again.'
        : "We couldn't send the link. Try again in a minute.")
      return
    }
    setSent(addr)
    track('organizer_signin_link_sent')
  }

  return (
    <div className="mx-auto grid max-w-[980px] gap-6 pt-2 md:grid-cols-[1.1fr_1fr] md:gap-x-8 md:gap-y-5 md:pt-10">
      {/* On a phone: the headline, then the form (the job here is signing in),
          then the picture. With a personal link the form leads. On wide
          screens the headline and picture sit left and the form right. */}
      <div className={cx('md:col-start-1 md:row-start-1 md:self-end', linkToken && 'order-2 md:order-none')}>
        <p className="text-[15px] font-semibold text-(--ev-accent)">{linkToken ? 'You\u2019re invited' : 'Shift for ride organizers'}</p>
        <h1 className="mt-2 font-display text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.05] text-(--ev-ink)">
          Plan and run your group&rsquo;s rides and walks
        </h1>
        {/* One benefit line, the short form of the kit's three (Keith
            2026-11-19), then the page they'll make. */}
        <p className="mt-4 text-[17px] leading-snug text-(--ev-ink-85)">
          Get more people to your rides and spend less time setting them up.
        </p>
      </div>

      <div className="order-3 md:order-none md:col-start-1 md:row-start-2 md:self-start">
        <figure className="overflow-hidden rounded-2xl border border-(--ev-line-mid) bg-white">
          <img
            src="/organizer-kit/signin-route-planner.jpg"
            alt="A ride page on a phone beside the route planner: the route over a map of bike lanes and paths, its distance, climbing and miles in protected and painted bike lanes, and a street-by-street list"
            width={1000} height={460}
            className="block h-auto w-full"
          />
          <figcaption className="border-t border-(--ev-line) px-4 py-2.5 text-[15px] leading-snug text-(--ev-ink-80)">
            Plan the route on a map of bike lanes, street by street. People see it on your ride&rsquo;s page and say they&rsquo;re coming, in any browser.
          </figcaption>
        </figure>
      </div>

      <Card className={cx('shadow-(--ev-shadow) md:col-start-2 md:row-span-2 md:row-start-1 md:self-center', linkToken && 'order-1 md:order-none')}>
        {sent ? (
          <div>
            <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
            <h2 className="mt-3 font-display text-[22px] font-extrabold">Check your inbox</h2>
            <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
              We sent a sign-in link to <b>{sent}</b>. Open it on the phone or computer you want to use and you&rsquo;ll land here, signed in.
            </p>
            <p className="mt-3 text-[14px] leading-snug text-(--ev-ink-75)">
              It comes from Shift by Green Streets Initiative and works for an hour.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void send()} busy={busy}>Send it again</Button>
              <Button variant="ghost" onClick={() => { setSent(null); setErr(null) }}>Use a different email</Button>
            </div>
            {err && <p role="alert" className="mt-3 text-[14px] font-semibold text-(--ev-danger)">{err}</p>}
          </div>
        ) : (
          <form onSubmit={send} noValidate>
            <h2 className="font-display text-[22px] font-extrabold">{linkToken ? 'Sign in to get started' : 'Sign in'}</h2>
            <p className="mt-1 text-[15px] leading-snug text-(--ev-ink-80)">
              {linkToken ? 'Your personal link is ready. Sign in and you\u2019re in. ' : ''}
              New to Shift? Signing in sets up your account.
            </p>
            {notice && <div className="mt-4"><Notice tone="warn">{notice}</Notice></div>}
            <Button className="mt-5 w-full" busy={googleBusy} onClick={() => void google()}>
              {!googleBusy && <GoogleG />}
              Continue with Google
            </Button>
            <div className="mt-4 flex items-center gap-3 text-[14px] text-(--ev-ink-75)" aria-hidden>
              <span className="h-px flex-1 bg-(--ev-line)" />or<span className="h-px flex-1 bg-(--ev-line)" />
            </div>
            <div className="mt-4">
              <Field label="Email" htmlFor="org-email" error={err}>
                <Input
                  id="org-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.org"
                  autoFocus
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" className="mt-4 w-full" busy={busy}>Email me a sign-in link</Button>
            <p className="mt-4 text-[14px] leading-snug text-(--ev-ink-75)">
              Have the Shift app? Sign in the same way you do there, and the rides you set up here show up in the app too.
              {!linkToken && ' Ride tools are invite-only while we try them with a few groups.'}
            </p>
          </form>
        )}
      </Card>
    </div>
  )
}

/** Google's four-color G, as its sign-in button guidelines ask. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

const LINK_PROBLEM: Record<LinkProblem, { title: string; body: string }> = {
  used: {
    title: 'This link has already been used',
    body: 'Each personal link opens for one account, and a different account opened this one. If that was you, sign in with that account instead. If not, ask the person who sent it for a new link.',
  },
  revoked: {
    title: 'This link has been turned off',
    body: 'Ask the person who sent it for a new one.',
  },
  not_found: {
    title: 'We don\u2019t recognize that link',
    body: 'Check that you opened the whole link from the email. If it still doesn\u2019t work, ask the person who sent it for a new one.',
  },
  too_many: {
    title: 'Too many tries',
    body: 'Wait an hour, then open your link again.',
  },
}

function NoAccess() {
  const { me, linkProblem, signOut } = useConsole()
  const problem = linkProblem ? LINK_PROBLEM[linkProblem] : null
  return (
    <Card className="mx-auto mt-4 max-w-xl">
      <h1 className="font-display text-[26px] font-extrabold leading-tight">{problem?.title ?? 'Ride tools are invite-only for now'}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-(--ev-ink-85)">
        You&rsquo;re signed in as <b>{me?.email}</b>.{' '}
        {problem?.body ?? 'We\u2019re trying ride tools with a small group of organizers first, and each one gets a personal link from us.'}
      </p>
      {!problem && (
        <p className="mt-3 text-[15px] leading-relaxed text-(--ev-ink-85)">
          Run group rides or walks? Tell us about your group: who you are, where you meet and how often. If an organizer added you to
          their ride, sign in with the email their invite went to.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {/* A used link most likely means they signed in with their other address. */}
        {linkProblem === 'used' && <Button variant="primary" onClick={() => void signOut()}>Sign in with another account</Button>}
        <a
          href="mailto:info@gogreenstreets.org?subject=Ride%20organizer%20tools"
          className={cx('inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-4 text-[15px] font-semibold',
            linkProblem === 'used'
              ? 'text-(--ev-ink) hover:bg-(--ev-panel)'
              : 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill) hover:opacity-90')}
        >
          {problem ? 'Email us' : 'Ask for access'}
        </a>
        {linkProblem !== 'used' && <Button variant="ghost" onClick={() => void signOut()}>Use a different account</Button>}
      </div>
    </Card>
  )
}
