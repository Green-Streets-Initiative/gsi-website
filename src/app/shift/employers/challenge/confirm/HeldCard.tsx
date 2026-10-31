'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { TEAM_CHALLENGE } from '@/lib/employer/team-challenge'

// A sign-up we hold instead of making a team: the person already manages a
// portal, or their company is already on Shift. The confirm page renders
// these on the server too, so a refresh never offers "Create our team"
// again. Each tells info@ once (the confirm route dedupes), through the
// same POST the Create button makes; it changes nothing else.

export type Held = { kind: 'existing_admin'; company: string } | { kind: 'company_exists' }

const CARD = 'rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8'
const H1 = 'font-headline text-[clamp(1.6rem,4vw,2.1rem)] font-extrabold leading-tight text-navy'
const BODY = 'mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft'
const BUTTON = 'inline-flex min-h-[52px] items-center justify-center rounded-full bg-navy px-7 text-[17px] font-bold text-white transition-opacity hover:opacity-90'
const LINK = 'font-bold text-forest underline-offset-4 hover:underline'

export default function HeldCard({ held, company, email, token }: { held: Held; company: string; email: string; token?: string }) {
  // Rendered by the page (not after a POST): tell the route once, so info@
  // hears about the hold. Without a token nothing is sent.
  const told = useRef(false)
  useEffect(() => {
    if (!token || told.current) return
    told.current = true
    void fetch('/api/employer/team-challenge/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token }),
    }).catch(() => {})
  }, [token])

  if (held.kind === 'existing_admin') {
    return (
      <div className={CARD}>
        <h1 className={H1}>You already have a portal for {held.company}</h1>
        <p className={BODY}>
          Sign in and open Challenges. GSI&rsquo;s statewide challenges are at the top: pick {TEAM_CHALLENGE.label.monthName}&rsquo;s and it&rsquo;s filled in for you.
        </p>
        <Link href="/shift/employers/login" className={`${BUTTON} mt-6`}>Sign in to your portal &rarr;</Link>
        <p className="mt-5 text-[15px] leading-[1.6] text-ink-soft">
          Not you? Write to <a href="mailto:info@gogreenstreets.org" className={LINK}>info@gogreenstreets.org</a>.
        </p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <h1 className={H1}>Someone at {company} already runs a team on Shift</h1>
      <p className={BODY}>
        We&rsquo;ll connect you with them, or set you up separately, within one business day. We&rsquo;ll write to {email}.
      </p>
      <p className="mt-4 text-[15px] leading-[1.6] text-ink-soft">
        Sooner? Write to <a href="mailto:info@gogreenstreets.org" className={LINK}>info@gogreenstreets.org</a>. Meanwhile,{' '}
        <Link href="/programs/walk-ride-days" className={LINK}>see how Walk/Ride Days work</Link>.
      </p>
    </div>
  )
}
