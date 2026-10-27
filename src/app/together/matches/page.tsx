'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { Badge, Button, Card, Notice, Spinner } from '@/components/organizers/ui'
import { DAYS, TIMES, WAYS, answerMatch, answerWent, myMatches, track, type Match } from '@/lib/together'

/**
 * gogreenstreets.org/together/matches: the web version of the app's matches
 * screen (Phase A, Keith 2026-10-27). Yes or no; once both say yes, the other
 * person's email; after the trip, "did you go together?". Everything comes
 * from get_my_partner_matches, so a web person sees exactly what the app
 * would show, and nothing more before both say yes.
 */

const label = (list: { id: string; label: string }[], ids: string[]) =>
  ids.map((i) => list.find((x) => x.id === i)?.label ?? i).join(', ')

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setMatches(await myMatches())
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => {
    let live = true
    myMatches().then((m) => { if (live) setMatches(m) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  async function answer(m: Match, yes: boolean) {
    setBusy(m.id)
    const ok = await answerMatch(m.id, yes)
    track('together_match_answered', { kind: m.kind, yes, ok })
    await load()
    setBusy(null)
  }

  async function went(m: Match, yes: boolean) {
    setBusy(m.id)
    const ok = await answerWent(m.id, yes)
    track('together_went_answered', { kind: m.kind, went: yes, ok })
    await load()
    setBusy(null)
  }

  if (failed) return <Notice tone="off">We couldn&rsquo;t load your matches. Try again in a minute.</Notice>
  if (!matches) return <Spinner label="Opening your matches" />

  return (
    <div className="grid gap-5">
      <h1 className="font-display text-[clamp(28px,4vw,38px)] font-extrabold">Your matches</h1>
      {matches.length === 0 && (
        <Card>
          <p className="text-[16px] leading-relaxed text-(--ev-ink-85)">
            No matches yet. We&rsquo;ll email you as soon as someone&rsquo;s trip fits yours.
          </p>
          <Link href="/together" className="mt-4 inline-flex min-h-[44px] items-center font-semibold text-(--ev-accent) underline">Check or change your sign-up</Link>
        </Card>
      )}
      {matches.map((m) => {
        const name = m.other.first_name || 'Someone'
        const ways = m.other.shared_modes?.length ? label(WAYS, m.other.shared_modes) : null
        const days = m.other.shared_days?.length ? label(DAYS, m.other.shared_days) : null
        const times = m.other.shared_times?.length ? label(TIMES, m.other.shared_times) : null
        const role = m.kind === 'carpool'
          ? (m.i_drive ? `You'd drive${m.detour_minutes != null ? `, about ${m.detour_minutes} extra minutes` : ''}` : `${name} would drive`)
          : m.my_kind === 'guide' ? `You'd show ${name} the way` : `${name} would show you the way`
        return (
          <Card key={m.id} as="article">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--ev-accent-fill) font-display text-[20px] font-extrabold text-(--ev-on-accent-fill)" aria-hidden>
                {name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-bold">
                  {name}{m.status !== 'proposed' && m.other.last_initial ? ` ${m.other.last_initial}.` : ''}
                </h2>
                <p className="text-[15px] text-(--ev-ink-80)">{role}</p>
              </div>
              <Badge tone={m.status === 'proposed' ? 'info' : 'good'}>
                {m.status === 'proposed' ? 'Possible match' : m.status === 'connected' ? 'You both said yes' : 'Went together'}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-2 text-[15px] sm:grid-cols-3">
              {m.home_miles != null && <div><dt className="text-(--ev-ink-75)">Starts</dt><dd className="font-semibold">{m.home_miles.toFixed(1)} mi from you</dd></div>}
              {ways && <div><dt className="text-(--ev-ink-75)">Ways</dt><dd className="font-semibold">{ways}</dd></div>}
              {(days || times) && <div><dt className="text-(--ev-ink-75)">When you both go</dt><dd className="font-semibold">{[days, times].filter(Boolean).join(' · ')}</dd></div>}
            </dl>

            {m.status === 'proposed' && m.my_answer == null && (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="primary" busy={busy === m.id} onClick={() => void answer(m, true)}>Yes, introduce us</Button>
                <Button variant="ghost" disabled={busy === m.id} onClick={() => void answer(m, false)}>No thanks</Button>
              </div>
            )}
            {m.status === 'proposed' && m.my_answer === 'yes' && (
              <p className="mt-4 text-[15px] text-(--ev-ink-85)">You said yes. We&rsquo;ll email you when {name} answers.</p>
            )}

            {m.status !== 'proposed' && m.other.email && (
              <a
                href={`mailto:${m.other.email}?subject=${encodeURIComponent('Shift Together: our first trip')}`}
                onClick={() => track('together_email_tapped', { kind: m.kind })}
                className="mt-5 flex min-h-[48px] items-center gap-3 rounded-xl bg-(--ev-panel) px-4 py-2"
              >
                <Mail className="h-5 w-5 text-(--ev-accent)" aria-hidden />
                <span>Email {name}: <strong>{m.other.email}</strong></span>
              </a>
            )}
            {m.status === 'connected' && (
              <div className="mt-5 grid gap-3 rounded-xl border border-(--ev-line) p-4">
                <p className="text-[15px] font-semibold">After your trip: did you go together?</p>
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" variant="primary" busy={busy === m.id} onClick={() => void went(m, true)}>We went</Button>
                  <Button size="sm" disabled={busy === m.id} onClick={() => void went(m, false)}>We didn&rsquo;t go</Button>
                </div>
              </div>
            )}
          </Card>
        )
      })}
      <p className="text-[14px] leading-snug text-(--ev-ink-75)">
        Planning the trip, counting it and unlocking rewards happen in the free Shift app.{' '}
        <a href="https://shift.gogreenstreets.org/get" className="font-semibold underline">Get Shift</a>
      </p>
    </div>
  )
}
