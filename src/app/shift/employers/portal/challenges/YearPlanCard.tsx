'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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

/**
 * The status pill. A filled green dot means the season is this company's
 * challenge; a hollow ring means it is only on the calendar. A season whose
 * dates have started reads "not running here" unless they launched it, so
 * nobody mistakes GSI's calendar for their own challenge (Keith 2026-10-12,
 * after Loomis's portal showed Commute Month as "Under way").
 */
type Pill = { text: string; tone: 'running' | 'waiting' | 'calendar' | 'off' }

function stateLabel(s: SeasonState, enabled: boolean, run: { starts_on: string }, today: string): Pill {
  switch (s.kind) {
    case 'drafted':
      return { text: 'Drafted, waiting for you', tone: 'waiting' }
    case 'launched':
      return run.starts_on <= today ? { text: 'Running here', tone: 'running' } : { text: 'Launched', tone: 'running' }
    case 'skipped':
      return { text: 'Skipped this year', tone: 'off' }
    case 'left_out':
      return { text: 'Left out', tone: 'off' }
    case 'started':
      return { text: `Started ${shortDay(run.starts_on)}, not running here`, tone: 'calendar' }
    case 'drafts_on':
      return enabled ? { text: `Drafts ${shortDay(s.day)}`, tone: 'calendar' } : { text: 'Not drafted (plan is off)', tone: 'off' }
  }
}

const pillClasses: Record<Pill['tone'], string> = {
  running: 'bg-accent-soft text-accent-ink',
  waiting: 'bg-accent-softer text-accent',
  calendar: 'bg-surface-2 text-ink-muted',
  off: 'text-ink-muted',
}

function StatusPill({ pill }: { pill: Pill }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[10px] py-[4px] text-[14px] font-semibold leading-none ${pillClasses[pill.tone]}`}
    >
      {pill.tone === 'running' && <span className="h-[7px] w-[7px] rounded-full bg-accent" />}
      {pill.tone === 'waiting' && <span className="h-[7px] w-[7px] rounded-full border-[1.5px] border-accent bg-accent-soft" />}
      {pill.tone === 'calendar' && <span className="h-[7px] w-[7px] rounded-full border-[1.5px] border-ink-faint" />}
      {pill.text}
    </span>
  )
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
  const { enabled, skipped, busy, error, savePlan } = plan
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  // Seasons in the plan: one entry per run, soonest first. The Walk/Ride Day
  // team day isn't drafted, so it isn't listed.
  const seasons = upcoming.filter((o) => o.run && o.template.slug !== 'walk-ride-day-team')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const states = seasons.map((o) => ({ o, s: stateOf(o, plan, today) }))

  // How many workplaces are on each started season's public board. The link
  // shows only when someone is on it: an empty board helps nobody, and a
  // full one is worth seeing even when this company isn't on it (Keith
  // 2026-10-12). Fetched when the calendar opens; until then, no link.
  const startedIds = seasons.filter((o) => o.run!.starts_on <= today).map((o) => o.run!.id).join(',')
  const [boardCounts, setBoardCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!open || !startedIds) return
    let cancelled = false
    const ids = startedIds.split(',')
    Promise.all(ids.map((id) => supabase.rpc('get_seasonal_leaderboard', { p_run_id: id }))).then((res) => {
      if (cancelled) return
      const counts: Record<string, number> = {}
      res.forEach(({ data }, i) => {
        counts[ids[i]] = Array.isArray(data?.employers) ? data.employers.length : 0
      })
      setBoardCounts(counts)
    })
    return () => {
      cancelled = true
    }
  }, [open, startedIds])

  // The sentence under the switch: what is drafted now, and what drafts next.
  const nextToDraft = states.find(({ s }) => s.kind === 'drafts_on')
  const status = !enabled
    ? 'A draft appears three weeks before each season. You decide whether to launch it.'
    : nextToDraft && nextToDraft.s.kind === 'drafts_on'
      ? `On. Next draft: ${nextToDraft.o.template.title}, ${shortDay(nextToDraft.s.day)}.`
      : 'On. Every season this year is drafted or decided.'

  // Turning the plan on for the first time opens the calendar, so the admin
  // sees the year they just agreed to. After that it stays as they left it.
  async function toggle(next: boolean) {
    await savePlan(next, skipped)
    if (next) setOpen(true)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <label className={`flex min-w-0 flex-1 basis-[280px] items-start gap-2.5 ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
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
            <span className="mt-0.5 block max-w-[72ch] text-[14px] leading-[1.5] text-ink-muted">{status}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 whitespace-nowrap text-[15px] font-semibold text-accent hover:underline"
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
            const label = stateLabel(s, enabled, run, today)
            const onBoard = boardCounts[run.id] ?? 0
            const canDraftNow = canManage && (s.kind === 'drafts_on' || s.kind === 'left_out' || s.kind === 'skipped' || s.kind === 'started')
            return (
              <div key={run.id} className="border-b border-line-2 last:border-0">
                <div className="grid items-center gap-x-4 gap-y-1 py-2.5 text-[15px] sm:grid-cols-[1fr_auto_auto]">
                  <button
                    type="button"
                    onClick={() => setDetail(showing ? null : run.id)}
                    aria-expanded={showing}
                    className={`flex min-w-0 items-center gap-2 text-left ${off || s.kind === 'started' ? 'text-ink-muted' : 'text-ink'}`}
                  >
                    <span className={off ? 'line-through' : ''}>
                      <strong>{o.template.title}</strong> · {runRange(run)}
                    </span>
                    {showing ? <ChevronUp size={14} strokeWidth={2} className="shrink-0 text-ink-icon" /> : <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-ink-icon" />}
                  </button>
                  <span>
                    <StatusPill pill={label} />
                  </span>
                  <span className="flex items-center gap-3 text-[14px] font-semibold">
                    {run.starts_on <= today && onBoard > 0 && (
                      <a href={`/shift/season/${run.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Public leaderboard ({onBoard} {onBoard === 1 ? 'workplace' : 'workplaces'})
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
                  <div className="mb-3 grid gap-2 rounded-xl bg-surface-2 px-4 py-3.5 text-[15px] leading-[1.55] text-ink">
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
                                  : `This season started ${shortDay(run.starts_on)} on GSI's calendar, but your company isn't running it, so your team isn't taking part. You can still draft a challenge for the rest of it.`}
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

      {error && <p className="px-6 pb-4 text-[14px] font-semibold text-ep-danger">{error}</p>}
    </Card>
  )
}
