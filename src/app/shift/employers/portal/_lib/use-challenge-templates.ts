'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CountingRules } from '@/lib/challenge-rules'

/**
 * GSI's seasonal challenge templates (Shift migration 01024) and their
 * upcoming runs. The builder shows what's coming up first; a template with
 * no runs (the step-challenge companion) can be started any time.
 */
export type ChallengeTemplate = {
  id: string
  slug: string
  title: string
  season: string
  line: string
  pitch: string
  pairs_with: string | null
  pairs_with_line: string | null
  duration_days: number
  counting_rules: CountingRules | null
  prize: {
    name: string
    award_mode: 'drawing' | 'guaranteed' | 'merit'
    metric: 'trips' | 'active_days' | 'miles'
    min_threshold: number
    winner_count: number
    amount_dollars: number
  } | null
  tips: string[]
  sort_order: number
}

export type TemplateRun = { id: string; template_id: string; label: string; starts_on: string; ends_on: string }

/** One card in the builder: a template, with a run when it has dates. */
export type SeasonalOption = { template: ChallengeTemplate; run: TemplateRun | null }

function todayEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function useChallengeTemplates() {
  const [upcoming, setUpcoming] = useState<SeasonalOption[]>([])
  const [anytime, setAnytime] = useState<SeasonalOption[]>([])
  const [calendar, setCalendar] = useState<SeasonalOption[]>([])

  useEffect(() => {
    let cancelled = false
    const today = todayEt()
    Promise.all([
      supabase
        .from('challenge_templates')
        .select('id, slug, title, season, line, pitch, pairs_with, pairs_with_line, duration_days, counting_rules, prize, tips, sort_order')
        .eq('active', true)
        .order('sort_order')
        .limit(50),
      supabase
        .from('challenge_template_runs')
        .select('id, template_id, label, starts_on, ends_on')
        .gte('ends_on', today)
        .order('starts_on')
        .limit(100),
    ]).then(([t, r]) => {
      if (cancelled) return
      const templates = (t.data ?? []) as ChallengeTemplate[]
      const runs = (r.data ?? []) as TemplateRun[]
      const byId = new Map(templates.map((x) => [x.id, x]))
      const withRuns = new Set(runs.map((x) => x.template_id))

      // Seasonal: runs still open, soonest first. The Walk/Ride Day team day
      // only offers its next date, so it doesn't crowd out the seasons.
      const seen = new Set<string>()
      const up: SeasonalOption[] = []
      for (const run of runs) {
        const template = byId.get(run.template_id)
        if (!template) continue
        if (template.slug === 'walk-ride-day-team' && seen.has(template.slug)) continue
        seen.add(template.slug)
        up.push({ template, run })
      }
      setUpcoming(up.slice(0, 6))
      // The whole year ahead, for the year plan (team days left out).
      setCalendar(
        runs
          .map((run) => ({ template: byId.get(run.template_id)!, run }))
          .filter((o) => o.template && o.template.slug !== 'walk-ride-day-team'),
      )
      setAnytime(templates.filter((x) => !withRuns.has(x.id)).map((template) => ({ template, run: null })))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { upcoming, anytime, calendar }
}
