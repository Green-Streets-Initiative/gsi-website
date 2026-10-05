'use client'

/**
 * Awards recap for an ended challenge (Shift 01047).
 *
 * The morning after a challenge ends, Shift gives every participant one
 * award for what they did most distinctively and picks one headline winner
 * per award. This block shows the employer that recap: the headline winners
 * (by name only when the group's leaderboard is public, otherwise
 * "A colleague"), how the awards spread out, what the group did together,
 * one sentence to talk about, and a button that copies a Slack-ready text
 * version. Renders nothing when the RPC is not on the server yet.
 */

import { useEffect, useState } from 'react'
import { Award, Copy } from 'lucide-react'
import posthog from 'posthog-js'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { supabase } from '@/lib/supabase'
import type { Challenge } from '../_lib/portal-types'

type Headline = {
  key: string
  name: string
  color: string
  measures: string
  value_text: string | null
  name_or_colleague: string | null
  flagged: boolean
}

type SpreadRow = { key: string; name: string; color: string; count: number }

type Recap = {
  ok: boolean
  computed: boolean
  reason?: string
  computed_at?: string
  show_names?: boolean
  headlines?: Headline[]
  spread?: SpreadRow[]
  participants?: number
  group_totals?: {
    active_trips: number
    all_trips: number
    active_share_pct: number | null
    walk_miles: number
    bike_miles: number
    transit_trips: number
    mix: { mode: string; share_pct: number }[]
  }
  conversation_starter?: string | null
}

type Status = 'loading' | 'missing' | 'pending' | 'ready' | 'failed'

const MODE_LABELS: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  escooter: 'Scooter',
  transit_bus: 'Bus',
  transit_train: 'Train',
  transit_commuter_rail: 'Commuter rail',
  ferry: 'Ferry',
  carpool: 'Carpool',
}

function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode
}

/** PostgREST's "no such function" errors, so a missing RPC renders nothing. */
function rpcMissing(message: string | null | undefined): boolean {
  return /could not find the function|does not exist|PGRST202/i.test(message ?? '')
}

function totalsLine(r: Recap): string {
  const g = r.group_totals
  if (!g) return ''
  const parts: string[] = []
  parts.push(`${r.participants ?? 0} ${r.participants === 1 ? 'person' : 'people'} took part`)
  parts.push(`${g.active_trips} active ${g.active_trips === 1 ? 'trip' : 'trips'}`)
  if (g.active_share_pct != null && g.all_trips > 0) {
    parts.push(`${g.active_share_pct}% of all trips were active`)
  }
  const top = (g.mix ?? []).slice(0, 3)
  if (top.length > 0) {
    parts.push(`top modes: ${top.map((m) => `${modeLabel(m.mode)} ${m.share_pct}%`).join(', ')}`)
  }
  return parts.join(' · ')
}

/** Slack-friendly plain text (bold with *asterisks*, bullets with •). */
export function recapText(challenge: Challenge, r: Recap): string {
  const lines: string[] = []
  lines.push(`*${challenge.name} — awards recap*`)
  if (r.conversation_starter) lines.push(r.conversation_starter)
  const totals = totalsLine(r)
  if (totals) lines.push(totals)
  const winners = (r.headlines ?? []).filter((h) => !h.flagged)
  if (winners.length > 0) {
    lines.push('')
    lines.push('*Headline winners*')
    for (const h of winners) {
      lines.push(`• ${h.name} — ${h.name_or_colleague ?? 'A colleague'} — ${h.value_text ?? ''}`.trim())
    }
  }
  const spread = r.spread ?? []
  if (spread.length > 0) {
    lines.push('')
    lines.push('*How the awards spread out*')
    for (const s of spread) {
      lines.push(`• ${s.name} — ${s.count} ${s.count === 1 ? 'person' : 'people'}`)
    }
  }
  lines.push('')
  lines.push("Everyone's own award is waiting in the Shift app, under the challenge.")
  return lines.join('\n')
}

export default function AwardsRecap({ challenge }: { challenge: Challenge }) {
  const toast = useToast()
  const [status, setStatus] = useState<Status>('loading')
  const [recap, setRecap] = useState<Recap | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_challenge_awards_recap', { p_competition_id: challenge.id })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          if (rpcMissing(error.message)) {
            setStatus('missing')
          } else {
            console.error('Awards recap failed:', error.message)
            setStatus('failed')
          }
          return
        }
        const r = data as Recap | null
        if (!r || !r.ok) {
          // Forbidden or not found: nothing to show this viewer.
          setStatus('missing')
          return
        }
        if (!r.computed) {
          setStatus('pending')
          return
        }
        setRecap(r)
        setStatus('ready')
      })
    return () => {
      cancelled = true
    }
  }, [challenge.id])

  function copyRecap() {
    if (!recap) return
    const text = recapText(challenge, recap)
    try {
      navigator.clipboard.writeText(text)
      toast('Recap copied. Paste it into Slack or an email.', { type: 'success' })
      posthog.capture('portal_awards_recap_copied', { challenge_id: challenge.id })
    } catch {
      toast("Couldn't copy. Select the text on screen and copy it instead.", { type: 'error' })
    }
  }

  if (status === 'loading' || status === 'missing') return null

  if (status === 'failed') {
    return (
      <div className="mt-5 border-t border-line-2 pt-5">
        <p className="text-[13.5px] text-ink-muted">
          The awards recap couldn&apos;t load just now. Reload the page to try again.
        </p>
      </div>
    )
  }

  if (status === 'pending' || !recap) {
    return (
      <div className="mt-5 border-t border-line-2 pt-5">
        <div className="flex items-center gap-2">
          <Award size={16} strokeWidth={1.75} className="text-ink-muted" />
          <h4 className="text-[15px] font-bold text-ink">Awards recap</h4>
        </div>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-muted">
          The recap is put together the morning after the challenge ends.
        </p>
      </div>
    )
  }

  const headlines = recap.headlines ?? []
  const spread = recap.spread ?? []
  const maxCount = spread.reduce((m, s) => Math.max(m, s.count), 0)
  const totals = totalsLine(recap)

  return (
    <div className="mt-5 border-t border-line-2 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Award size={16} strokeWidth={1.75} className="text-accent" />
            <h4 className="text-[15px] font-bold text-ink">Awards recap</h4>
          </div>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-ink-muted">
            Everyone who took part got one award for what they did most distinctively. This is the
            group&apos;s version to share.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyRecap}>
          Copy recap for Slack
        </Button>
      </div>

      {recap.conversation_starter && (
        <blockquote className="mt-4 rounded-[10px] border border-accent/20 bg-accent-softer px-4 py-3 text-[14.5px] leading-[1.55] text-ink">
          {recap.conversation_starter}
        </blockquote>
      )}

      {totals && <p className="mt-3 text-[13.5px] leading-[1.5] text-ink-muted">{totals}</p>}

      {headlines.length > 0 && (
        <div className="mt-5">
          <h5 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">
            Headline winners
          </h5>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {headlines.map((h) => (
              <li
                key={h.key}
                className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ backgroundColor: h.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{h.name}</p>
                  {h.flagged ? (
                    <p className="text-[13px] text-ink-muted">
                      Being checked before it&apos;s announced.
                    </p>
                  ) : (
                    <p className="truncate text-[13px] text-ink-muted">
                      {h.name_or_colleague ?? 'A colleague'}
                      {h.value_text ? ` · ${h.value_text}` : ''}
                    </p>
                  )}
                </div>
                {h.flagged && <Badge tone="warn">Under review</Badge>}
              </li>
            ))}
          </ul>
          {!recap.show_names && (
            <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-tertiary">
              Names are hidden because this group&apos;s leaderboard isn&apos;t public. Each person
              sees their own award in the Shift app.
            </p>
          )}
        </div>
      )}

      {spread.length > 0 && (
        <div className="mt-5">
          <h5 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-tertiary">
            How the awards spread out
          </h5>
          <ul className="mt-2 grid gap-1.5">
            {spread.map((s) => (
              <li key={s.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-[13.5px] text-ink">{s.name}</span>
                <span className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${maxCount > 0 ? Math.max(4, Math.round((100 * s.count) / maxCount)) : 0}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </span>
                <span className="text-[13px] tabular-nums text-ink-muted">
                  {s.count} {s.count === 1 ? 'person' : 'people'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
