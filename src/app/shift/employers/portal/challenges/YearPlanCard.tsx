'use client'

import { useState } from 'react'
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { whatToDo } from '@/lib/challenge-rules'
import type { SeasonalOption } from '../_lib/use-challenge-templates'
import { runRange, templatePrizeLine, draftDate, shortDay, type useYearPlan } from '../_lib/use-year-plan'

/**
 * The year plan (Shift 01025, Keith 2026-09-29), as one row: the switch and
 * what happens next, in words that update as seasons pass. "See the year"
 * opens the calendar, where each season shows its state (drafted, drafts on
 * a date, launched, skipped, left out), what counts, the suggested prize,
 * and a button to draft it now. Drafts that are ready to launch are listed
 * with the challenges on the page, not here (Keith 2026-09-30).
 */

type SeasonState =
  | { kind: 'drafted' }
  | { kind: 'launched' }
  | { kind: 'skipped' }
  | { kind: 'left_out' }
  | { kind: 'started' }
  | { kind: 'drafts_on'; day: string }

function stateOf(o: SeasonalOption, plan: ReturnType<typeof useYearPlan>, today: string): SeasonState {
  const run = o.run!
  const decided = plan.decisions[run.id]
  if (decided === 'launched') return { kind: 'launched' }
  if (decided === 'skipped') return { kind: 'skipped' }
  if (decided === 'drafted') return { kind: 'drafted' }
  if (plan.skipped.includes(o.template.slug)) return { kind: 'left_out' }
  if (run.starts_on <= today) return { kind: 'started' }
  return { kind: 'drafts_on', day: draftDate(run) }
}

function stateLabel(s: SeasonState, enabled: boolean): { text: string; tone: 'accent' | 'muted' | 'ink' } {
  switch (s.kind) {
    case 'drafted':
      return { text: 'Drafted, waiting for you', tone: 'accent' }
    case 'launched':
      return { text: 'Launched', tone: 'ink' }
    case 'skipped':
      return { text: 'Skipped this year', tone: 'muted' }
    case 'left_out':
      return { text: 'Left out', tone: 'muted' }
    case 'started':
      return { text: 'Under way', tone: 'ink' }
    case 'drafts_on':
      return enabled ? { text: `Drafts ${shortDay(s.day)}`, tone: 'ink' } : { text: 'Not drafted (plan is off)', tone: 'muted' }
  }
}

export default function YearPlanCard({
  plan,
  canManage,
  upcoming,
  onLaunch,
}: {
  plan: ReturnType<typeof useYearPlan>
  canManage: boolean
  /** Seasonal runs coming up, from useChallengeTemplates. */
  upcoming: SeasonalOption[]
  onLaunch: (o: SeasonalOption) => void
}) {
  const { enabled, skipped, drafts, busy, error, savePlan } = plan
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  // Seasons in the plan: one entry per run, soonest first. The Walk/Ride Day
  // team day isn't drafted, so it isn't listed.
  const seasons = upcoming.filter((o) => o.run && o.template.slug !== 'walk-ride-day-team')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const states = seasons.map((o) => ({ o, s: stateOf(o, plan, today) }))

  // The sentence under the switch: what is drafted now, and what drafts next.
  const nextToDraft = states.find(({ s }) => s.kind === 'drafts_on')
  const waiting = drafts.map((d) => `${d.run.template.title} (${shortDay(d.run.starts_on)})`)
  const status = !enabled
    ? "About three weeks before each season starts, a draft appears here and in your weekly email. Nothing starts until an admin launches it."
    : [
        waiting.length > 0
          ? `On. ${waiting.join(' and ')} ${waiting.length === 1 ? 'is' : 'are'} drafted below.`
          : 'On. Nothing to draft yet.',
        nextToDraft && nextToDraft.s.kind === 'drafts_on'
          ? `${waiting.length > 0 ? 'Next up' : 'First up'}: ${nextToDraft.o.template.title} drafts on ${shortDay(nextToDraft.s.day)} for a ${shortDay(nextToDraft.o.run!.starts_on)} start.`
          : 'Every season on the calendar has been drafted or decided.',
        'Nothing starts until an admin launches it.',
      ].join(' ')

  // Turning the plan on for the first time opens the calendar, so the admin
  // sees the year they just agreed to. After that it stays as they left it.
  async function toggle(next: boolean) {
    await savePlan(next, skipped)
    if (next) setOpen(true)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <label className={`flex min-w-0 flex-1 items-start gap-2.5 ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
          <input
            id="year-plan-enabled"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-accent"
            checked={enabled}
            disabled={!canManage || busy}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-ink">Draft each season&apos;s challenge for us</span>
            <span className="mt-0.5 block max-w-[72ch] text-[13px] leading-[1.5] text-ink-muted">{status}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 whitespace-nowrap text-[13.5px] font-semibold text-accent hover:underline"
        >
          <CalendarDays size={14} strokeWidth={1.75} />
          {open ? 'Hide the year' : 'See the year'}
          {open ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
        </button>
      </div>

      {open && seasons.length > 0 && (
        <div className="border-t border-line px-6 pb-4">
          {states.map(({ o, s }) => {
            const run = o.run!
            const off = s.kind === 'left_out' || s.kind === 'skipped'
            const showing = detail === run.id
            const prize = templatePrizeLine(o.template)
            const label = stateLabel(s, enabled)
            const canDraftNow = canManage && (s.kind === 'drafts_on' || s.kind === 'left_out' || s.kind === 'skipped' || s.kind === 'started')
            return (
              <div key={run.id} className="border-b border-line-2 last:border-0">
                <div className="grid items-center gap-x-4 gap-y-1 py-2.5 text-[13.5px] sm:grid-cols-[1fr_auto_auto]">
                  <button
                    type="button"
                    onClick={() => setDetail(showing ? null : run.id)}
                    aria-expanded={showing}
                    className={`flex min-w-0 items-center gap-2 text-left ${off ? 'text-ink-muted' : 'text-ink'}`}
                  >
                    <span className={off ? 'line-through' : ''}>
                      <strong>{o.template.title}</strong> · {runRange(run)}
                    </span>
                    {showing ? <ChevronUp size={14} strokeWidth={2} className="shrink-0 text-ink-icon" /> : <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-ink-icon" />}
                  </button>
                  <span
                    className={`text-[12.5px] font-semibold ${
                      label.tone === 'accent' ? 'text-accent' : label.tone === 'muted' ? 'text-ink-muted' : 'text-ink'
                    }`}
                  >
                    {label.text}
                  </span>
                  <span className="flex items-center gap-3 text-[12.5px] font-semibold">
                    {run.starts_on <= today && (
                      <a href={`/shift/season/${run.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Public leaderboard
                      </a>
                    )}
                    {canManage && enabled && s.kind !== 'launched' && s.kind !== 'skipped' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          savePlan(
                            true,
                            s.kind === 'left_out' ? skipped.filter((x) => x !== o.template.slug) : [...skipped, o.template.slug],
                          )
                        }
                        className="text-accent hover:underline"
                      >
                        {s.kind === 'left_out' ? 'Include' : 'Leave out'}
                      </button>
                    )}
                  </span>
                </div>
                {showing && (
                  <div className="mb-3 grid gap-2 rounded-xl bg-surface-2 px-4 py-3.5 text-[13.5px] leading-[1.55] text-ink">
                    <p>{o.template.line}</p>
                    {o.template.pitch && o.template.pitch !== o.template.line && <p className="text-ink-muted">{o.template.pitch}</p>}
                    <dl className="grid gap-1.5 sm:grid-cols-[110px_1fr]">
                      <dt className="font-semibold text-ink-muted">What counts</dt>
                      <dd>{whatToDo(o.template.counting_rules)}</dd>
                      {prize && (
                        <>
                          <dt className="font-semibold text-ink-muted">Suggested prize</dt>
                          <dd>{prize} You can change it before you launch.</dd>
                        </>
                      )}
                      {o.template.pairs_with_line && (
                        <>
                          <dt className="font-semibold text-ink-muted">Pairs with</dt>
                          <dd>{o.template.pairs_with_line}</dd>
                        </>
                      )}
                      <dt className="font-semibold text-ink-muted">Status</dt>
                      <dd>
                        {s.kind === 'drafts_on'
                          ? enabled
                            ? `A draft appears here on ${shortDay(s.day)}, three weeks before the start. You can also draft it now.`
                            : 'The year plan is off, so this season is not drafted. You can still draft it yourself.'
                          : s.kind === 'drafted'
                            ? 'Drafted. It is in the list above, waiting for an admin to launch or skip it.'
                            : s.kind === 'launched'
                              ? 'Launched as a challenge. It is in the list above.'
                              : s.kind === 'skipped'
                                ? 'Skipped for this year. You can still draft it yourself.'
                                : s.kind === 'left_out'
                                  ? 'Left out of the plan. Include it and it drafts three weeks before the start.'
                                  : 'This season has started. You can still draft a challenge for the rest of it.'}
                      </dd>
                    </dl>
                    {canDraftNow && (
                      <div className="pt-1">
                        <Button variant="secondary" size="sm" onClick={() => onLaunch(o)}>
                          Draft this one now
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="px-6 pb-4 text-[13px] font-semibold text-ep-danger">{error}</p>}
    </Card>
  )
}
