'use client'

// Home, led by the assistant (Keith 2026-10-21: "the assistant feels bolted-on
// versus an integrated and strong user pathway"). The forest panel asks what
// they want to get done; under it, up to three next steps, each done with the
// assistant or by hand. Everything here is worked out from what the portal
// already loaded (setup steps, challenges, who has joined), so Home is
// instant, costs nothing and works when the assistant can't answer. Only for
// workplaces that have the assistant; the rest keep the plain Home.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowUp, BarChart3, Building2, ImageIcon, Route, Sparkles, Target, Trophy, Users } from 'lucide-react'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import { openAssistant } from '../_components/AssistantPanel'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import type { SetupStepDef } from '../_lib/setup-steps'
import { SETUP_PROMPTS } from '../_lib/assistant-prompts'
import type { Challenge, EmployerOnboarding, Group } from '../_lib/portal-types'

const PORTAL = '/shift/employers/portal'
const DAY = 86_400_000

type Step = { id: string; icon: typeof Users; title: string; desc: string; prompt: string; href: string }

/** Setup steps, as tasks the assistant can take on. */
const SETUP: Record<string, { icon: typeof Users; desc: string }> = {
  success: { icon: Target, desc: 'What matters most to you, a target and a date. A few questions.' },
  profile: { icon: Building2, desc: 'A contact name, and a phone number or website.' },
  logo: { icon: ImageIcon, desc: 'It shows on the join page, the Commute Advisor and the app.' },
  advisor: { icon: Route, desc: 'Your office and your commute benefits, so employees can plan a new way in.' },
  employees: { icon: Users, desc: 'Attach your staff list and the assistant sends the invitations.' },
  challenge: { icon: Trophy, desc: 'A few questions, then a draft you can launch when it looks right.' },
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

export function homeSuggestions(args: {
  group: Group
  steps: SetupStepDef[]
  challenges: Challenge[]
  memberCount: number
  canAct: boolean
  nowMs: number
}): { steps: Step[]; starters: string[] } {
  const { group, steps, challenges, memberCount, canAct, nowMs } = args
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
      desc: `${headcount ? `${memberCount} of ${headcount.toLocaleString('en-US')}` : memberCount} ${memberCount === 1 ? 'has' : 'have'} joined. "${soon.name}" starts in ${days} day${days === 1 ? '' : 's'}.`,
      prompt: `Help me get my team into Shift before "${soon.name}" starts. I can attach our staff list.`,
      href: `${PORTAL}/employees?invite=1`,
    })
  }
  if (canAct) {
    for (const s of steps) {
      if (s.done || !SETUP[s.id] || !SETUP_PROMPTS[s.id] || (s.id === 'employees' && out.some((o) => o.id === 'people'))) continue
      out.push({ id: s.id, icon: SETUP[s.id].icon, title: s.label, desc: SETUP[s.id].desc, prompt: SETUP_PROMPTS[s.id], href: s.route ?? `${PORTAL}/setup` })
    }
  }
  if (ended) {
    out.push({
      id: 'recap',
      icon: BarChart3,
      title: `See how "${ended.name}" went`,
      desc: `It ended ${fmtDate(ended.ends_at)}. Who took part, what they tried, and what to do next.`,
      prompt: `How did "${ended.name}" go, and what should we try next?`,
      href: `${PORTAL}/challenges`,
    })
  }
  if (canAct && !upcoming && !running && steps.every((s) => s.id !== 'challenge' || s.done)) {
    out.push({
      id: 'next-challenge',
      icon: Trophy,
      title: 'Plan your next challenge',
      desc: 'A season from the year plan or one of your own. A few questions, then a draft.',
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

export default function AssistantHome({ steps, starters }: { steps: Step[]; starters: string[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const ask = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    openAssistant(text)
  }

  return (
    <>
      <PortalHeroPanel
        title="What would you like to get done?"
        lede={<p>Ask in your own words. The assistant sets things up with you and asks before anything your team sees.</p>}
        below={
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask()
              }}
              className="flex items-center gap-2 rounded-xl bg-white p-1.5 pl-4 shadow-sm focus-within:ring-2 focus-within:ring-white/60"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Ask the assistant"
                placeholder="Set up a challenge, invite your team, ask how it's going…"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-muted"
              />
              <button
                type="submit"
                aria-label="Ask"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest text-white transition-opacity hover:opacity-90"
              >
                <ArrowUp size={18} strokeWidth={2.2} />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => openAssistant(s)}
                  className="rounded-full border border-white/40 px-3.5 py-1.5 text-[13.5px] font-medium text-white transition-colors hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {steps.length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center gap-2 px-5 pb-1 pt-4">
            <Sparkles size={15} className="text-accent" aria-hidden />
            <h2 className="text-[14px] font-semibold text-ink">Suggested next steps</h2>
          </div>
          <ul className="divide-y divide-line-2 px-5">
            {steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <s.icon size={20} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1 basis-[240px]">
                  <p className="text-[14.5px] font-semibold text-ink">{s.title}</p>
                  <p className="text-[13px] text-ink-muted">{s.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 pl-9 sm:pl-0">
                  <Button variant="secondary" size="sm" onClick={() => openAssistant(s.prompt)}>
                    Do it with the assistant
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => router.push(s.href)}>
                    I&apos;ll do it
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
