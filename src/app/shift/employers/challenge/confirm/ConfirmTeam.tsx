'use client'

import { useState } from 'react'
import Link from 'next/link'
import { gaEvent } from '@/lib/ga'
import { TEAM_CHALLENGE, type TeamResult } from '@/lib/employer/team-challenge'
import HeldCard from './HeldCard'
import TeamReady from './TeamReady'

type Result =
  | { status: 'created' | 'ready'; team: TeamResult; signinSent: boolean }
  | { status: 'existing_admin'; company: string }
  | { status: 'company_exists' | 'closed' | 'expired' | 'invalid' | 'error' }

const CARD = 'rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8'
const H1 = 'font-headline text-[clamp(1.6rem,4vw,2.1rem)] font-extrabold leading-tight text-navy'
const BODY = 'mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft'
const BUTTON = 'inline-flex min-h-[52px] items-center justify-center rounded-full bg-navy px-7 text-[17px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60'

export default function ConfirmTeam({ token, company, email }: { token: string; company: string; email: string }) {
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function create() {
    setWorking(true)
    try {
      const res = await fetch('/api/employer/team-challenge/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      })
      const data = (await res.json().catch(() => ({ status: 'error' }))) as Result
      if (data.status === 'created') gaEvent('employer_team_created', { source: 'team_challenge' })
      setResult(data)
    } catch {
      setResult({ status: 'error' })
    } finally {
      setWorking(false)
    }
  }

  if (result && (result.status === 'created' || result.status === 'ready')) {
    return <TeamReady team={result.team} signinSent={result.signinSent} />
  }

  // The route that answered has already told info@; no token, so the card sends nothing.
  if (result?.status === 'existing_admin') {
    return <HeldCard held={{ kind: 'existing_admin', company: result.company }} company={company} email={email} />
  }
  if (result?.status === 'company_exists') {
    return <HeldCard held={{ kind: 'company_exists' }} company={company} email={email} />
  }

  if (result) {
    const msg =
      result.status === 'expired' || result.status === 'invalid'
        ? { title: 'This link no longer works', body: 'Sign up again and we’ll send a new one.', href: '/shift/employers/challenge#sign-up', label: 'Sign up again' }
        : result.status === 'closed'
          ? {
              title: `Sign-ups for ${TEAM_CHALLENGE.label.monthName} have closed`,
              body: 'Walk/Ride Day happens every month. Tell us you’d like your team in the next one.',
              href: '/shift/employers#inquiry',
              label: 'Ask about the next one',
            }
          : { title: 'Something went wrong on our side', body: 'Try again in a minute. If it happens again, write to info@gogreenstreets.org and we’ll set your team up.', href: null, label: '' }
    return (
      <div className={CARD}>
        <h1 className={H1}>{msg.title}</h1>
        <p className={BODY}>{msg.body}</p>
        {msg.href ? (
          <Link href={msg.href} className={`${BUTTON} mt-6`}>{msg.label} &rarr;</Link>
        ) : (
          <button type="button" onClick={create} disabled={working} className={`${BUTTON} mt-6`}>
            {working ? 'Trying again…' : 'Try again'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="text-[16px] font-bold text-forest">Email confirmed</p>
      <h1 className={`${H1} mt-1`}>Create {company}&rsquo;s team</h1>
      <p className={BODY}>
        One click sets up your invite code and {company}&rsquo;s challenge, {TEAM_CHALLENGE.label.range}, on GSI&rsquo;s statewide {TEAM_CHALLENGE.label.monthName} challenge. You&rsquo;ll manage it as <b className="text-navy">{email}</b>.
      </p>
      <button type="button" onClick={create} disabled={working} className={`${BUTTON} mt-6 w-full sm:w-auto`}>
        {working ? 'Setting up your team…' : 'Create our team'}
      </button>
    </div>
  )
}
