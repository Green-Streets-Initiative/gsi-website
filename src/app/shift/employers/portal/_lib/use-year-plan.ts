'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChallengeTemplate, TemplateRun } from './use-challenge-templates'

/**
 * The year plan (Shift 01025): one switch per employer, the seasons they
 * left out, and the drafts waiting for a launch or a skip. Lifted out of the
 * year-plan card so the Challenges page can count drafts in its status strip
 * and list them beside real challenges (Keith 2026-09-30).
 */
export type YearPlanDraft = {
  id: string
  status: 'drafted' | 'launched' | 'skipped'
  run: TemplateRun & { template: ChallengeTemplate }
}

export function useYearPlan(groupId: string | undefined) {
  const [enabled, setEnabled] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [drafts, setDrafts] = useState<YearPlanDraft[]>([])
  /** Every decision so far, by run id: launched or skipped seasons stay
   *  visible in the calendar as what happened to them. */
  const [decisions, setDecisions] = useState<Record<string, YearPlanDraft['status']>>({})
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    if (!groupId) return null
    const [plan, ds] = await Promise.all([
      supabase.from('employer_year_plans').select('enabled, skipped_slugs').eq('group_id', groupId).maybeSingle(),
      supabase
        .from('employer_challenge_drafts')
        .select(
          'id, status, run:challenge_template_runs(id, template_id, label, starts_on, ends_on, template:challenge_templates(id, slug, title, season, line, pitch, pairs_with, pairs_with_line, duration_days, counting_rules, prize, tips, sort_order))',
        )
        .eq('group_id', groupId)
        .limit(40),
    ])
    const all = ((ds.data ?? []) as unknown as YearPlanDraft[]).filter((d) => d.run?.template)
    return {
      enabled: !!plan.data?.enabled,
      skipped: (plan.data?.skipped_slugs ?? []) as string[],
      drafts: all.filter((d) => d.status === 'drafted'),
      decisions: Object.fromEntries(all.map((d) => [d.run.id, d.status])),
    }
  }, [groupId])

  const refresh = useCallback(async () => {
    const s = await fetchState()
    if (!s) return
    setEnabled(s.enabled)
    setSkipped(s.skipped)
    setDrafts(s.drafts)
    setDecisions(s.decisions)
    setLoaded(true)
  }, [fetchState])

  useEffect(() => {
    let cancelled = false
    fetchState().then((s) => {
      if (cancelled || !s) return
      setEnabled(s.enabled)
      setSkipped(s.skipped)
      setDrafts(s.drafts)
      setDecisions(s.decisions)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [fetchState])

  const savePlan = useCallback(
    async (nextEnabled: boolean, nextSkipped: string[]) => {
      if (!groupId) return
      setBusy(true)
      setError(null)
      const { data, error: err } = await supabase.rpc('set_employer_year_plan', {
        p_group_id: groupId,
        p_enabled: nextEnabled,
        p_skipped_slugs: nextSkipped,
      })
      setBusy(false)
      if (err || !data?.ok) {
        setError('Could not save the year plan. Try again in a moment.')
        return
      }
      await refresh()
    },
    [groupId, refresh],
  )

  const skipDraft = useCallback(
    async (id: string) => {
      setBusy(true)
      const { error: err } = await supabase.rpc('skip_employer_challenge_draft', { p_draft_id: id })
      setBusy(false)
      if (err) setError('Could not skip it. Try again in a moment.')
      else await refresh()
    },
    [refresh],
  )

  return { enabled, skipped, drafts, decisions, loaded, busy, error, savePlan, skipDraft, refresh }
}

/** The nightly job drafts a season 21 days before it starts (Shift 01025). */
export const DRAFT_LEAD_DAYS = 21

/** The day a run's draft appears, as YYYY-MM-DD. */
export function draftDate(run: { starts_on: string }): string {
  const d = new Date(run.starts_on + 'T12:00:00')
  d.setDate(d.getDate() - DRAFT_LEAD_DAYS)
  return d.toISOString().slice(0, 10)
}

/** "Oct 12" for a plain YYYY-MM-DD. */
export function shortDay(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Oct 5 to Oct 30, 2026", "Jan 25 to Feb 26, 2027", or "Oct 30, 2026" for a
 *  one-day run. Dates are plain YYYY-MM-DD; the year is never left out. */
export function runRange(run: { starts_on: string; ends_on: string }): string {
  const d = (s: string) => new Date(s + 'T12:00:00')
  const md = (s: string) => d(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const y = (s: string) => d(s).getFullYear()
  if (run.starts_on === run.ends_on) return `${md(run.starts_on)}, ${y(run.starts_on)}`
  return y(run.starts_on) === y(run.ends_on)
    ? `${md(run.starts_on)} to ${md(run.ends_on)}, ${y(run.ends_on)}`
    : `${md(run.starts_on)}, ${y(run.starts_on)} to ${md(run.ends_on)}, ${y(run.ends_on)}`
}

/** A template's prize, as one sentence for a calendar row. */
export function templatePrizeLine(t: ChallengeTemplate): string | null {
  const p = t.prize
  if (!p) return null
  const unit = p.metric === 'active_days' ? 'active days' : p.metric === 'miles' ? 'miles' : 'trips'
  const goal = `${p.min_threshold} ${unit}`
  const card = `$${p.amount_dollars} gift card`
  if (p.award_mode === 'guaranteed') {
    return `The first ${p.winner_count} people to reach ${goal} each get a ${card}.`
  }
  if (p.award_mode === 'drawing') {
    return `Everyone who reaches ${goal} is in a drawing for ${p.winner_count} ${card}s.`
  }
  return `The top ${p.winner_count} by ${unit} each get a ${card}.`
}
