'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import { LogOut, MailCheck } from 'lucide-react'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
import { toneClass } from '@/components/events/EventsTone'
import { supabase } from '@/lib/supabase'
import { ConsoleProvider, useConsole } from './ConsoleContext'
import { Button, Card, Field, Input, Notice, Spinner, cx } from './ui'
import '@/components/events/events-tone.css'

export default function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <ConsoleProvider>
      <div className={cx('min-h-dvh bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
        <TopBar />
        <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
          <Gate>{children}</Gate>
        </main>
      </div>
    </ConsoleProvider>
  )
}

function TopBar() {
  const { phase, me, signOut } = useConsole()
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
  const { notice, clearNotice } = useConsole()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErr('Enter the email address you use for Shift.')
      return
    }
    setBusy(true)
    setErr(null)
    clearNotice()
    // The link comes back to this page (www.gogreenstreets.org/** is on the
    // Shift sign-in allowlist); the app's own email carries it.
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/organizers` },
    })
    setBusy(false)
    if (error) {
      setErr(/rate|seconds/i.test(error.message)
        ? 'A link was just sent. Give it a minute, then try again.'
        : "We couldn't send the link. Try again in a minute.")
      return
    }
    setSent(addr)
  }

  return (
    <div className="mx-auto grid max-w-[980px] gap-8 pt-2 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-10">
      <div>
        <p className="text-[15px] font-semibold text-(--ev-accent)">Shift for ride organizers</p>
        <h1 className="mt-2 font-display text-[clamp(30px,4.2vw,44px)] font-extrabold leading-[1.05] text-(--ev-ink)">
          Plan and run your group&rsquo;s rides from your laptop
        </h1>
        <ul className="mt-5 space-y-2.5 text-[16px] leading-snug text-(--ev-ink-85)">
          <li>Set up a one-off ride or a whole season, with a route drawn on the map or brought in from Ride with GPS.</li>
          <li>See who&rsquo;s coming to each date, from the app and from your ride page.</li>
          <li>Post &ldquo;It&rsquo;s on&rdquo; or &ldquo;Running late&rdquo; once, and everyone hears it.</li>
          <li>Pull monthly turnout for your funders.</li>
        </ul>
        <p className="mt-5 text-[14px] leading-snug text-(--ev-ink-75)">
          Same account and same rides as the Shift app: a ride you set up here shows up on your phone.
        </p>
      </div>

      <Card className="shadow-(--ev-shadow)">
        {sent ? (
          <div>
            <MailCheck className="h-8 w-8 text-(--ev-accent)" aria-hidden />
            <h2 className="mt-3 font-display text-[22px] font-extrabold">Check your inbox</h2>
            <p className="mt-2 text-[15px] leading-snug text-(--ev-ink-85)">
              We sent a sign-in link to <b>{sent}</b>. Open it on this computer and you&rsquo;ll land back here, signed in.
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
            <h2 className="font-display text-[22px] font-extrabold">Sign in</h2>
            <p className="mt-1 text-[15px] leading-snug text-(--ev-ink-80)">Use the email address you use for Shift. We&rsquo;ll email you a sign-in link.</p>
            {notice && <div className="mt-4"><Notice tone="warn">{notice}</Notice></div>}
            <div className="mt-5">
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
              Ride tools are invite-only while we try them with a few groups.
            </p>
          </form>
        )}
      </Card>
    </div>
  )
}

function NoAccess() {
  const { me, signOut } = useConsole()
  return (
    <Card className="mx-auto mt-4 max-w-xl">
      <h1 className="font-display text-[26px] font-extrabold leading-tight">Ride tools are invite-only for now</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-(--ev-ink-85)">
        You&rsquo;re signed in as <b>{me?.email}</b>. We&rsquo;re building ride tools with a few groups first, so each
        organizer gets set up with us directly.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-(--ev-ink-85)">
        If you run group rides or walks and want in, tell us about your group: who you are, where you meet and how often.
        If another organizer invited you, sign in with the address their invite went to.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="mailto:info@gogreenstreets.org?subject=Ride%20organizer%20tools"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90"
        >
          Ask for access
        </a>
        <Button variant="ghost" onClick={() => void signOut()}>Use a different email</Button>
      </div>
    </Card>
  )
}
