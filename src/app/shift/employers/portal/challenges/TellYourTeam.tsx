'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Mail } from 'lucide-react'
import Button from '@/components/employer/Button'
import {
  buildAnnouncement,
  deliverySentence,
  describeChallengeRules,
  dollars,
  midSentence,
  orderSentence,
  prizeSentence,
  type AnnouncementMoment,
  type ChallengeRulesInput,
} from '@/lib/challenge-rules'
import { onThisSite } from '@/lib/employer/office-links'
import { usePortal } from '../_lib/portal-context'
import { PRIZE_METRIC_LABELS } from '../_lib/portal-constants'
import type { Challenge } from '../_lib/portal-types'

const TABS = [
  { key: 'email', label: 'Email' },
  { key: 'chat', label: 'Slack / Teams' },
  { key: 'short', label: 'Short' },
  { key: 'rules', label: 'What counts' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** The three notes in a challenge's life. Halfway and wrap-up reuse the same channels. */
const MOMENTS: { key: AnnouncementMoment; label: string; hint: string }[] = [
  { key: 'kickoff', label: 'Kickoff', hint: 'Send before or on day one: what this is, how to join, what counts.' },
  { key: 'halfway', label: 'Halfway', hint: 'Post around the middle: days left, a nudge to keep going, how to join late.' },
  { key: 'wrapup', label: 'Wrap-up', hint: 'Send the day after it ends: thanks, check your rank and award in the app.' },
]

export function rulesPageUrl(challengeId: string): string {
  return `https://www.gogreenstreets.org/shift/challenge/${challengeId}`
}

/** The prize on the challenge, whichever kind it is. `none` = leaderboard only. */
export type TeamPrize = {
  kind: 'goal' | 'drawing' | 'top' | 'none'
  /** Trip goal (goal) or entry minimum (drawing). */
  goal: number
  /** Spots (goal) or number of winners (drawing, top). */
  spots: number
  funded: boolean
  amountCents: number | null
  description: string | null
  requiresWorkEmail: boolean
  /** What "top" ranks by. */
  metric?: string
}

function rewardWords(p: TeamPrize, employer: string): string {
  if (p.funded && p.amountCents) return `a ${dollars(p.amountCents)} gift card from ${employer}`
  return midSentence(p.description) || `a prize from ${employer}`
}

/** One sentence for a drawing, a leaderboard prize, or no prize; the goal
 *  kind keeps the rules generator's own sentence. */
function ownPrizeSentence(p: TeamPrize, employer: string): string {
  const n = p.spots
  if (p.kind === 'drawing') {
    return `Everyone with ${p.goal} or more trips is entered in a drawing at the end. ${n} ${n === 1 ? 'winner gets' : 'winners each get'} ${rewardWords(p, employer)}.`
  }
  if (p.kind === 'top') {
    const by = (PRIZE_METRIC_LABELS[p.metric ?? 'trips'] ?? 'trips').toLowerCase()
    return `The top ${n} by ${by} at the end each get ${rewardWords(p, employer)}.`
  }
  return "There's no prize this time: the leaderboard in the app shows how we're all doing."
}

function ownDeliverySentence(p: TeamPrize, employer: string): string {
  if (p.kind === 'none') return ''
  if (p.funded) return 'Winners pick where to spend their gift card in the Shift app: a local shop or a national brand.'
  return `${employer} hands out the prize to the winners.`
}

/**
 * Copy-ready text for announcing a challenge, built from the same rules
 * generator the app and the rules page use. The generator speaks for the
 * "first to the goal" prize; for a drawing, a leaderboard prize or no prize
 * its prize, order and delivery sentences are swapped for ones that fit,
 * and the rules-page link is left out (that page only exists for goal
 * prizes).
 */
export default function TellYourTeam({
  challenge,
  domains,
  prize,
}: {
  challenge: Challenge
  domains: string[]
  prize: TeamPrize
}) {
  const { group } = usePortal()
  const [tab, setTab] = useState<TabKey>('email')
  const [moment, setMoment] = useState<AnnouncementMoment>('kickoff')
  const [copied, setCopied] = useState<string | null>(null)
  const [host, setHost] = useState('')
  if (!group) return null

  const isGoal = prize.kind === 'goal'
  const joinUrl = `https://shift.gogreenstreets.org/join/${group.invite_code}`
  const rulesUrl = rulesPageUrl(challenge.id)
  const input: ChallengeRulesInput = {
    rules: challenge.counting_rules ?? null,
    startsAt: challenge.starts_at,
    endsAt: challenge.ends_at,
    goal: prize.goal,
    spots: prize.spots,
    funded: prize.funded,
    amountCents: prize.amountCents,
    description: prize.description,
    requiresWorkEmail: isGoal && prize.requiresWorkEmail,
    domains,
    employer: group.name,
    contactName: challenge.contact_name,
    contactEmail: challenge.contact_email,
  }
  const a = buildAnnouncement({ ...input, challengeName: challenge.name, joinUrl, rulesUrl, host, moment })

  // Swap the goal-shaped sentences for this prize's own.
  const fit = (s: string): string => {
    if (isGoal) return s
    const mine = ownPrizeSentence(prize, group.name)
    const delivery = ownDeliverySentence(prize, group.name)
    let out = s
      .split(prizeSentence(input)).join(mine)
      .split(` ${orderSentence()}`).join('')
      .split(orderSentence()).join('')
      .split(deliverySentence(input)).join(delivery)
    if (prize.kind === 'none') {
      out = out.split("There are prizes, too. ").join('').split("There's a prize, too. ").join('')
    }
    return out
      .split('\n')
      .filter((line) => !line.startsWith('Full rules: ') && !line.startsWith('Rules and what counts: '))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const text: Record<TabKey, string> = {
    email: fit(a.email),
    chat: fit(a.chat),
    short: fit(a.short),
    rules: fit(describeChallengeRules(input).join('\n')),
  }
  // The "What counts" tab is the same at every moment; the other three change.
  const showRulesLink = isGoal && moment !== 'wrapup'

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  const linkClass =
    'inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-[7px] text-[13px] font-semibold text-accent-ink hover:border-accent'

  return (
    <div className="rounded-xl border border-line bg-surface p-[18px]">
      <div className="mb-1 text-[14px] font-semibold text-ink">Tell your team</div>
      <p className="mb-3.5 text-[12.5px] leading-[1.55] text-ink-muted">
        Ready-to-send text for three moments: the kickoff, a reminder halfway through, and a thank-you when it
        ends. Challenges do best when a leader sends the first note and someone posts the Halfway and Wrap-up
        notes below.
      </p>

      <div className="mb-1.5 flex flex-wrap gap-1" role="tablist" aria-label="Moment">
        {MOMENTS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={moment === m.key}
            onClick={() => setMoment(m.key)}
            className={`rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              moment === m.key
                ? 'border-accent bg-white text-accent-ink'
                : 'border-line bg-surface text-ink-muted hover:border-line-2'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mb-3.5 text-[12px] leading-[1.5] text-ink-tertiary">
        {MOMENTS.find((m) => m.key === moment)?.hint}
      </p>

      <label htmlFor="tyt-host" className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
        Sent on behalf of
      </label>
      <input
        id="tyt-host"
        className="mb-3.5 w-full max-w-[360px] rounded-[10px] border border-line bg-surface px-3.5 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        placeholder={`${group.name} (or a team, like the Green Council)`}
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              tab === t.key ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-surface-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'email' && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-semibold text-ink-muted">Subject:</span>
          <span className="text-ink">{a.subject}</span>
          <button
            type="button"
            className="text-ink-muted hover:text-accent"
            onClick={() => copy(a.subject, 'subject')}
            title="Copy subject"
            aria-label="Copy subject"
          >
            {copied === 'subject' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <textarea
        readOnly
        value={text[tab]}
        rows={tab === 'short' ? 3 : 12}
        className="w-full resize-y rounded-[10px] border border-line bg-surface-2 px-3.5 py-3 font-[inherit] text-[13px] leading-[1.55] text-ink outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" icon={copied === tab ? Check : Copy} onClick={() => copy(text[tab], tab)}>
          {copied === tab ? 'Copied' : 'Copy'}
        </Button>
        {tab === 'email' && (
          <a href={`mailto:?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(text.email)}`} className={linkClass}>
            <Mail size={14} strokeWidth={1.75} />
            Open in email
          </a>
        )}
        {showRulesLink && (
          <a href={onThisSite(rulesUrl)} target="_blank" rel="noreferrer" className={linkClass}>
            <ExternalLink size={14} strokeWidth={1.75} />
            Rules page to share
          </a>
        )}
        {moment === 'kickoff' && (
          <a
            href={`/shift/employers/flyer?group=${encodeURIComponent(group.slug ?? group.invite_code)}&challenge=${challenge.id}`}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            Printable flyer
          </a>
        )}
      </div>
    </div>
  )
}
