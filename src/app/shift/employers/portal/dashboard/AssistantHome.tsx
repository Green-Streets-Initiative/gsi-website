'use client'

// Home's first two blocks (Keith 2026-10-22, page charters: Home's one job is
// "what to do next, and is it working"). The assistant bar asks what they
// want to get done; Next up lists at most three steps, each done with the
// assistant or by hand. All worked out from what the portal already loaded
// (setup steps, challenges, who has joined), so Home is instant, costs
// nothing and works when the assistant can't answer.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUp, BarChart3, Building2, ChevronRight, ExternalLink, ImageIcon, MessageSquareText, Route, Target, Trophy, UserPlus, Users } from 'lucide-react'
import { openAssistant } from '../_components/AssistantPanel'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import type { SetupStepDef } from '../_lib/setup-steps'
import { SETUP_PROMPTS } from '../_lib/assistant-prompts'
import type { Challenge, EmployerOnboarding, Group } from '../_lib/portal-types'

const PORTAL = '/shift/employers/portal'
const DAY = 86_400_000

// A 'join' step is the person's own: no assistant, an outside link and a way
// to say no. An 'ask' step is one only an admin can do (the profile, the
// logo): it is listed so a manager knows it is open, with "Ask an admin" in
// place of the buttons.
type Step = { id: string; icon: typeof Users; title: string; desc: string; prompt: string; href: string; kind?: 'join' | 'ask' }

/** Steps that change the account itself, so only an admin does them. */
const ACCOUNT_STEPS = new Set(['profile', 'logo'])

/** Setup steps, as tasks the assistant can take on. */
const SETUP: Record<string, { icon: typeof Users; desc: string }> = {
  success: { icon: Target, desc: 'Your goal, a target and a date.' },
  profile: { icon: Building2, desc: 'A contact name, and a phone or website.' },
  logo: { icon: ImageIcon, desc: 'Shows on the join page and in the app.' },
  advisor: { icon: Route, desc: 'Your office and commute benefits.' },
  employees: { icon: Users, desc: 'Invite from your staff list.' },
  challenge: { icon: Trophy, desc: 'A few questions, then a draft to launch.' },
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

export function homeSuggestions(args: {
  group: Group
  steps: SetupStepDef[]
  challenges: Challenge[]
  memberCount: number
  /** Can run programs: challenges, inviting, the advisor (admins, managers, GSI staff, while access is live). */
  canAct: boolean
  /** Can change the account: the profile and logo steps. Admins only; a manager sees "Ask an admin". */
  canManageAccount?: boolean
  nowMs: number
  /** True when the signed-in person isn't on the team yet and hasn't said no. */
  joinYourself?: boolean
}): { steps: Step[]; starters: string[] } {
  const { group, steps, challenges, memberCount, canAct, nowMs, joinYourself } = args
  const canManageAccount = args.canManageAccount ?? canAct
  const headcount = ((group.onboarding ?? {}) as EmployerOnboarding).headcount ?? null
  const own = challenges.filter((c) => !c.is_flagship)
  const upcoming = own.filter((c) => new Date(c.starts_at).getTime() > nowMs).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const running = own.find((c) => new Date(c.starts_at).getTime() <= nowMs && new Date(c.ends_at).getTime() >= nowMs)
  const ended = own
    .filter((c) => new Date(c.ends_at).getTime() < nowMs && nowMs - new Date(c.ends_at).getTime() < 30 * DAY)
    .sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0]
  const fewJoined = headcount ? memberCount < Math.max(5, headcount * 0.25) : memberCount < 5

  const out: Step[] = []
  // A challenge is coming and hardly anyone is in: the most useful thing there is.
  const soon = upcoming && new Date(upcoming.starts_at).getTime() - nowMs < 30 * DAY ? upcoming : null
  if (canAct && soon && fewJoined) {
    const days = Math.ceil((new Date(soon.starts_at).getTime() - nowMs) / DAY)
    out.push({
      id: 'people',
      icon: Users,
      title: `Get people in before ${fmtDate(soon.starts_at)}`,
      desc: `${headcount ? `${memberCount} of ${headcount.toLocaleString('en-US')}` : memberCount} joined · challenge starts in ${days} day${days === 1 ? '' : 's'}`,
      prompt: `Help me get my team into Shift before "${soon.name}" starts. I can attach our staff list.`,
      href: `${PORTAL}/employees?invite=1`,
    })
  }
  // Signing up doesn't put the organizer on the team (Keith 2026-10-27).
  if (joinYourself && group.invite_code) {
    out.push({
      id: 'join',
      icon: UserPlus,
      title: 'Join the team yourself',
      desc: `In the app, enter code ${group.invite_code}.`,
      prompt: '',
      href: `https://shift.gogreenstreets.org/join/${group.invite_code}`,
      kind: 'join',
    })
  }
  if (canAct) {
    for (const s of steps) {
      if (s.done || !SETUP[s.id] || !SETUP_PROMPTS[s.id] || (s.id === 'employees' && out.some((o) => o.id === 'people'))) continue
      const askAdmin = ACCOUNT_STEPS.has(s.id) && !canManageAccount
      out.push({
        id: s.id,
        icon: SETUP[s.id].icon,
        title: s.label,
        desc: SETUP[s.id].desc,
        prompt: SETUP_PROMPTS[s.id],
        href: s.route ?? `${PORTAL}/setup`,
        ...(askAdmin ? { kind: 'ask' as const } : {}),
      })
    }
  }
  if (ended) {
    out.push({
      id: 'recap',
      icon: BarChart3,
      title: `See how "${ended.name}" went`,
      desc: `Ended ${fmtDate(ended.ends_at)}. Results and what to try next.`,
      prompt: `How did "${ended.name}" go, and what should we try next?`,
      href: `${PORTAL}/challenges`,
    })
  }
  if (canAct && !upcoming && !running && steps.every((s) => s.id !== 'challenge' || s.done)) {
    out.push({
      id: 'next-challenge',
      icon: Trophy,
      title: 'Plan your next challenge',
      desc: 'A season from the year plan, or your own.',
      prompt: 'Help me plan our next challenge.',
      href: `${PORTAL}/challenges?new=1`,
    })
  }

  // Chips stay short: a long challenge name becomes "the last challenge".
  const called = (c: Challenge, fallback: string) => (c.name.length > 26 ? fallback : `"${c.name}"`)
  const starters = [
    ...(canAct && fewJoined ? ['Invite my team from a spreadsheet'] : []),
    ended ? `How did ${called(ended, 'the last challenge')} go?` : running ? `How is ${called(running, 'the challenge')} going?` : 'How are we doing this month?',
    ...(canAct ? [upcoming || running ? 'Plan our next challenge' : 'Help me set up a challenge'] : []),
    'What should I do next?',
  ].slice(0, 3)
  return { steps: out.slice(0, 3), starters }
}

/** Ask in your own words; or tap a starter. Opens the assistant on that task. */
export function AssistantBar({ starters }: { starters: string[] }) {
  const [draft, setDraft] = useState('')
  const ask = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    openAssistant(text)
  }
  return (
    // ph-no-capture: analytics doesn't record what's asked.
    <section className="ph-no-capture rounded-[20px] bg-forest px-4 py-4 sm:px-5" aria-label="Ask the assistant">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
        className="flex items-center gap-2 rounded-xl bg-white p-1.5 pl-4 focus-within:ring-2 focus-within:ring-white/60"
      >
        <MessageSquareText size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Ask the assistant"
          placeholder="What would you like to get done?"
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-ink-muted"
        />
        <button type="submit" aria-label="Ask" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest text-white transition-opacity hover:opacity-90">
          <ArrowUp size={18} strokeWidth={2.2} />
        </button>
      </form>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {starters.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => openAssistant(t)}
            className="shrink-0 whitespace-nowrap rounded-full border border-white/40 px-3.5 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
          >
            {t}
          </button>
        ))}
      </div>
    </section>
  )
}

/** At most three things to do now, each with the assistant (when it's on) or by hand. */
export function NextUp({ steps, withAssistant, onSkipJoin }: { steps: Step[]; withAssistant: boolean; onSkipJoin?: () => void }) {
  const router = useRouter()
  return (
    <Card className="ph-no-capture">
      <h2 className="px-5 pb-1 pt-4 text-[17px] font-bold tracking-[-0.01em] text-ink">Next up</h2>
      {steps.length === 0 ? (
        <p className="px-5 pb-5 pt-1 text-[15px] text-ink-muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="divide-y divide-line-2 px-5 pb-1">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3.5">
              <s.icon size={20} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug text-ink">{s.title}</p>
                <p className="line-clamp-2 text-[14px] text-ink-muted">{s.desc}</p>
              </div>
              {s.kind === 'ask' ? (
                <span className="shrink-0 text-[14px] font-medium text-ink-muted">Ask an admin</span>
              ) : s.kind === 'join' ? (
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <Button variant="secondary" size="sm" iconRight={ExternalLink} onClick={() => window.open(s.href, '_blank', 'noopener')}>
                    Get the app
                  </Button>
                  {onSkipJoin && (
                    <button type="button" onClick={onSkipJoin} className="px-1 text-[14px] font-medium text-ink-muted hover:text-ink">
                      Not for me
                    </button>
                  )}
                </span>
              ) : withAssistant ? (
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <Button variant="secondary" size="sm" icon={MessageSquareText} onClick={() => openAssistant(s.prompt)}>
                    <span className="hidden sm:inline">With the assistant</span>
                    <span className="sm:hidden">Assistant</span>
                  </Button>
                  <button type="button" onClick={() => router.push(s.href)} className="px-1 text-[14px] font-medium text-ink-muted hover:text-ink">
                    Myself
                  </button>
                </span>
              ) : (
                <Button variant="secondary" size="sm" iconRight={ChevronRight} onClick={() => router.push(s.href)}>
                  Do it
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
