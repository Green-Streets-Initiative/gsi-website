'use client'

/**
 * Results of an ended workplace challenge, the way the team sees them in the
 * Shift app (Keith 2026-11-21: "Add the results screens to the employer
 * portal too"). Same source as the app: get_employer_challenge_results
 * (Shift 01881/01882/01883), which answers once every drawing and
 * top-of-the-board prize has been decided, and names nobody until then.
 *
 * What it shows: how many people took part and how many trips they made,
 * who won each prize (by the name the portal shows everywhere: 01883 gives
 * admins each winner's member id), the trips by type, and the shops winners
 * picked. "Copy for your team" puts a Slack-ready version on the clipboard
 * that names winners the way the app does for members (first name and last
 * initial, or "A winner" for a private profile), so a pasted post never
 * shows a name the person keeps private.
 *
 * Delivery of each prize (cards sent, forfeits) stays on the prize rows
 * below this block.
 */

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Bike, Car, Copy, Footprints, TrainFront, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import posthog from 'posthog-js'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { supabase } from '@/lib/supabase'
import { dollars } from '@/lib/challenge-rules'
import { usePortal } from '../_lib/portal-context'
import type { Challenge } from '../_lib/portal-types'

type Prize = {
  prize_id: string
  name: string
  description: string
  value: number | null
  gift_card: boolean
  quantity: number
  drawn: number
  award_mode: 'drawing' | 'merit' | 'guaranteed' | string
  metric: string | null
  threshold: number | null
  reached: number | null
}

type Winner = {
  label: string | null
  value: number | null
  prize_id: string
  metric: string | null
  metric_value: number | null
  user_id: string | null
}

type Results = {
  people: number
  trips: number
  prizes: Prize[]
  winner_people: Winner[]
  modes: { walk: number; bike: number; transit: number; carpool: number; other: number } | null
  shops: { name: string; logo_url: string | null }[]
}

const MODES: { key: 'walk' | 'bike' | 'transit' | 'carpool'; one: string; other: string; Icon: LucideIcon }[] = [
  { key: 'walk', one: 'walk', other: 'walks', Icon: Footprints },
  { key: 'bike', one: 'bike ride', other: 'bike rides', Icon: Bike },
  { key: 'transit', one: 'bus or train ride', other: 'bus and train rides', Icon: TrainFront },
  { key: 'carpool', one: 'carpool', other: 'carpools', Icon: Car },
]

/** How many winners a prize shows before "Show all". */
const FIRST = 8

function n(v: number): string {
  return v.toLocaleString('en-US')
}

function goalText(metric: string | null, v: number | null): string | null {
  if (v == null) return null
  if (metric === 'trips') return `${n(v)} ${v === 1 ? 'trip' : 'trips'}`
  if (metric === 'active_days') return `${n(v)} ${v === 1 ? 'day' : 'days'}`
  return null
}

/** How a prize was won, in the app's words (ChallengeResults howText). */
function howText(p: Prize): string | null {
  if (p.award_mode === 'merit') return 'Top of the leaderboard'
  const goal = goalText(p.metric, p.threshold)
  if (!goal) return null
  if (p.award_mode === 'drawing') {
    if (p.reached == null) return null
    return p.reached === 1
      ? `Drawn at random from the one person who made ${goal}`
      : `Drawn at random from the ${n(p.reached)} people who made ${goal}`
  }
  if (p.award_mode === 'guaranteed') {
    if (p.reached != null && p.quantity >= p.reached) return `Everyone who made ${goal}`
    return `The first ${n(p.quantity)} to make ${goal}`
  }
  return null
}

function prizeTitle(p: Prize): string {
  // The function gives dollars; dollars() takes cents.
  return p.value != null && p.gift_card ? `${dollars(Math.round(p.value * 100))} gift card` : p.description
}

/** The team's version, for Slack or an email: names as members see them. */
function teamText(challenge: Challenge, r: Results, groups: { prize: Prize; winners: Winner[] }[]): string {
  const lines: string[] = [`*${challenge.name}: the results*`]
  const modeBits = MODES.map((m) => ({ m, v: r.modes?.[m.key] ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .map(({ m, v }) => `${n(v)} ${v === 1 ? m.one : m.other}`)
  lines.push(
    `${n(r.people)} ${r.people === 1 ? 'person' : 'people'} made ${n(r.trips)} ${r.trips === 1 ? 'trip' : 'trips'}` +
      (modeBits.length > 0 ? `: ${modeBits.join(', ')}.` : '.'),
  )
  for (const g of groups) {
    lines.push('')
    const how = howText(g.prize)
    lines.push(`*${prizeTitle(g.prize)}*${how ? ` (${how.charAt(0).toLowerCase()}${how.slice(1)})` : ''}`)
    // Private profiles stay unnamed: name the rest, count the others.
    const named = g.winners.map((w) => w.label).filter((l): l is string => !!l)
    const others = g.winners.length - named.length
    lines.push(
      named.length === 0
        ? `${g.winners.length} ${g.winners.length === 1 ? 'winner' : 'winners'}`
        : named.join(', ') + (others > 0 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : ''),
    )
  }
  lines.push('')
  lines.push('Everyone’s results are in the Shift app, under the challenge.')
  return lines.join('\n')
}

export default function WorkplaceResults({ challenge, onShown }: { challenge: Challenge; onShown?: () => void }) {
  const { members } = usePortal()
  const toast = useToast()
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_employer_challenge_results', { p_competition_id: challenge.id })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Challenge results failed:', error.message)
          return
        }
        // Null until every drawing has run: the prize rows below say what's left.
        setResults((data as Results | null) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [challenge.id])

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members])

  const groups = useMemo(() => {
    if (!results) return []
    return results.prizes
      .map((prize) => ({ prize, winners: results.winner_people.filter((w) => w.prize_id === prize.prize_id) }))
      .filter((g) => g.winners.length > 0)
  }, [results])

  const showing = !!results && results.people > 0
  useEffect(() => {
    if (showing) onShown?.()
  }, [showing, onShown])

  if (!results || !showing) return null

  const prizeCount = results.winner_people.length
  const modeRows = MODES.map((m) => ({ ...m, v: results.modes?.[m.key] ?? 0 })).filter((m) => m.v > 0)
  const modeMax = Math.max(1, ...modeRows.map((m) => m.v))
  const shops = results.shops ?? []

  async function copy() {
    if (!results) return
    try {
      await navigator.clipboard.writeText(teamText(challenge, results, groups))
      toast('Results copied. Paste them into Slack or an email.', { type: 'success' })
      posthog.capture('portal_challenge_results_copied', { challenge_id: challenge.id })
    } catch {
      toast("Couldn't copy. Select the text on screen and copy it instead.", { type: 'error' })
    }
  }

  return (
    <section className="mt-5 border-t border-line-2 pt-5" aria-labelledby={`results-${challenge.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy size={16} strokeWidth={1.75} className="text-accent" />
            <h4 id={`results-${challenge.id}`} className="text-[15px] font-bold text-ink">
              Results
            </h4>
          </div>
          <p className="mt-1 text-[15px] leading-[1.5] text-ink-muted">Your team sees these in the Shift app.</p>
        </div>
        <Button variant="secondary" size="sm" icon={Copy} onClick={() => void copy()}>
          Copy results for Slack
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { v: results.people, label: results.people === 1 ? 'person took part' : 'people took part' },
          { v: results.trips, label: results.trips === 1 ? 'trip' : 'trips' },
          { v: prizeCount, label: prizeCount === 1 ? 'prize won' : 'prizes won' },
        ].map((s) => (
          <div key={s.label} className="flex flex-col-reverse justify-end rounded-[10px] border border-line bg-surface px-3 py-3">
            <dt className="mt-1 text-[14px] leading-[1.35] text-ink-muted">{s.label}</dt>
            <dd className="text-[26px] font-extrabold leading-none tabular-nums text-ink">{n(s.v)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h5 className="text-[15px] font-semibold text-ink">Who won</h5>
          <div className="mt-3 space-y-4">
            {groups.map(({ prize, winners }) => {
              const how = howText(prize)
              const all = open[prize.prize_id] || winners.length <= FIRST + 1
              const shown = all ? winners : winners.slice(0, FIRST)
              const showCounts = prize.award_mode !== 'guaranteed'
              return (
                <div key={prize.prize_id}>
                  <p className="text-[15px] font-semibold text-ink">
                    {prizeTitle(prize)}
                    {winners.length > 1 && <span className="font-normal text-ink-muted"> · {winners.length} winners</span>}
                  </p>
                  {how && <p className="text-[14px] leading-[1.45] text-ink-muted">{how}</p>}
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {shown.map((w, i) => {
                      const m = w.user_id ? memberMap.get(w.user_id) : undefined
                      const name = m?.display_name || w.label || 'A member'
                      const count = showCounts ? goalText(w.metric, w.metric_value) : null
                      return (
                        <li
                          key={`${w.user_id ?? i}-${i}`}
                          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3"
                        >
                          <WinnerFace name={name} url={m?.avatar_url ?? null} />
                          <span className="text-[14px] font-semibold text-ink">{name}</span>
                          {count && <span className="text-[14px] text-ink-muted">{count}</span>}
                        </li>
                      )
                    })}
                  </ul>
                  {!all && (
                    <button
                      type="button"
                      className="mt-2 text-[14px] font-semibold text-accent hover:underline"
                      onClick={() => setOpen({ ...open, [prize.prize_id]: true })}
                    >
                      Show all {winners.length}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {modeRows.length > 0 && (
          <div>
            <h5 className="text-[15px] font-semibold text-ink">The trips, by type</h5>
            <ul className="mt-3 space-y-3.5">
              {modeRows.map(({ key, v, one, other, Icon }) => (
                <li key={key} className="flex items-center gap-3">
                  <Icon size={20} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">
                      <strong className="font-semibold tabular-nums">{n(v)}</strong> {v === 1 ? one : other}
                    </p>
                    <div className="mt-1 h-2 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, (v / modeMax) * 100)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {shops.length > 0 && (
        <div className="mt-6">
          <h5 className="text-[15px] font-semibold text-ink">Shops winners picked for their gift cards</h5>
          <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-8">
            {shops.map((shop) => (
              <li key={shop.name} className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                  {shop.logo_url ? (
                    <Image src={shop.logo_url} alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="text-[18px] font-bold text-accent">{shop.name.charAt(0)}</span>
                  )}
                </span>
                <span className="mt-1.5 text-[13px] leading-[1.3] text-ink">{shop.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function WinnerFace({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // Most member photos are Google-hosted, which next/image isn't set up for.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={26} height={26} loading="lazy" className="h-[26px] w-[26px] rounded-full object-cover" />
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
      {initials}
    </span>
  )
}
