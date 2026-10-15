'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { locationTitle } from '../_lib/use-employer-locations'
import type { AdvisorUsage, AdvisorUsageRow } from '../_lib/portal-types'

const MODE_LABEL: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  ebike: 'E-bike',
  transit: 'Bus or train',
  bus: 'Bus',
  rail: 'Train',
  shuttle: 'Shuttle',
  carpool: 'Carpool',
  drive: 'Driving',
  unknown: 'Not recorded',
}

const DISTANCE_LABEL: Record<string, string> = {
  short: 'Under 2 miles',
  medium: '2 to 5 miles',
  long: '5 to 15 miles',
  very_long: 'Over 15 miles',
}

const MOTIVATION_LABEL: Record<string, string> = {
  time: 'Time',
  money: 'Money',
  health: 'Health',
  climate: 'Climate',
  none: 'No preference',
}

const WEEKS = 8

type WeekBar = { label: string; runs: number }

function modeLabel(mode: string | null | undefined): string {
  const m = (mode ?? 'unknown').toLowerCase()
  return MODE_LABEL[m] ?? m
}

function changeLine(runs: number, prior: number): string {
  if (prior === 0) return 'First runs in this window'
  const diff = runs - prior
  if (diff === 0) return 'Same as the 30 days before'
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} from ${prior} the 30 days before`
}

function shortDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  return !!error && /PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(`${error.code} ${error.message}`)
}

/**
 * Runs per week for the last eight weeks. From `by_week` when the function
 * returns it; until then, eight windows of the function that exists today
 * (runs in the last 7, 14, ... 56 days), read in one go and differenced.
 * That is eight small calls on an admin card; it goes away with by_week.
 */
async function loadWeeks(groupId: string, usage: AdvisorUsage): Promise<WeekBar[]> {
  if (usage.by_week && usage.by_week.length > 0) {
    return usage.by_week.slice(-WEEKS).map((w) => ({ label: shortDate(w.week_start), runs: w.runs }))
  }
  const windows = Array.from({ length: WEEKS }, (_, i) => (i + 1) * 7)
  const results = await Promise.all(
    windows.map((days) =>
      supabase
        .rpc('get_advisor_usage', { p_group_id: groupId, p_days: days })
        .then(({ data, error }) => (error || !(data as AdvisorUsage | null)?.ok ? null : (data as AdvisorUsage).runs)),
    ),
  )
  if (results.some((r) => r === null)) return []
  const cumulative = results as number[]
  const now = Date.now()
  const bars: WeekBar[] = []
  for (let i = WEEKS - 1; i >= 0; i--) {
    const runs = Math.max(0, cumulative[i] - (i > 0 ? cumulative[i - 1] : 0))
    // The bar's label is the first day of its 7-day window.
    const start = new Date(now - (i + 1) * 7 * 86400000)
    bars.push({ label: shortDate(start.toISOString().slice(0, 10)), runs })
  }
  return bars
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * How employees use the Commute Advisor page (Keith 2026-09-30, v2 2026-10-05):
 * runs in the last 30 days with the change against the 30 days before, runs
 * per week, the mix of recommended modes, runs per office, and when the
 * function returns them (held Shift 01131: cta_clicks, arrive_by_changed,
 * by_motivation), join-link clicks, arrive-by changes and what mattered
 * most; the estimated yearly saving and the per-run CSV wait for a function
 * that returns those (none does yet, so they stay hidden rather than made
 * up). Data comes from get_advisor_usage (Shift 01048), which counts
 * completed recommendations only; it never has an address or a person in it.
 */
export default function AdvisorUsageCard({
  groupId,
  locations,
  fileLabel = 'commute-advisor',
}: {
  groupId: string
  locations: { id: string; name: string | null; address: string }[]
  /** Goes into the CSV's file name. */
  fileLabel?: string
}) {
  const [usage, setUsage] = useState<AdvisorUsage | null>(null)
  const [weeks, setWeeks] = useState<WeekBar[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_advisor_usage', { p_group_id: groupId, p_days: 30 }).then(async ({ data, error }) => {
      if (cancelled) return
      const u = data as AdvisorUsage | null
      // Before migration 01048 lands the function does not exist: that is
      // "no runs yet", not a failure.
      if (isMissingFunction(error)) {
        setUsage({ ok: true, days: 30, runs: 0, prior_runs: 0, by_mode: [], by_location: [] })
        setWeeks([])
        return
      }
      if (error || !u || !u.ok) {
        setFailed(true)
        return
      }
      setUsage(u)
      if (u.runs === 0 && u.prior_runs === 0 && !u.by_week) {
        setWeeks([])
        return
      }
      const bars = await loadWeeks(groupId, u)
      if (!cancelled) setWeeks(bars)
    })
    return () => {
      cancelled = true
    }
  }, [groupId])

  const locationName = (id: string | null) => {
    if (id === null) return locations.length > 1 ? 'Location not chosen' : 'Main location'
    const l = locations.find((x) => x.id === id)
    return l ? locationTitle(l) : 'A location since removed'
  }

  const topMode = usage?.by_mode?.[0]
  const rows: AdvisorUsageRow[] = Array.isArray(usage?.rows) ? usage.rows : []
  const savings =
    typeof usage?.estimated_annual_savings_usd === 'number' && Number.isFinite(usage.estimated_annual_savings_usd) && usage.estimated_annual_savings_usd > 0
      ? Math.round(usage.estimated_annual_savings_usd)
      : null
  const arriveByChanges = typeof usage?.arrive_by_changed === 'number' ? usage.arrive_by_changed : null
  const joinClicks = typeof usage?.cta_clicks === 'number' ? usage.cta_clicks : null
  const motivations = (usage?.by_motivation ?? []).filter((m) => m.runs > 0)
  const motivationsPicked = motivations.filter((m) => m.motivation !== 'none')
  const maxWeek = weeks ? Math.max(1, ...weeks.map((w) => w.runs)) : 1
  const weeksTotal = weeks ? weeks.reduce((n, w) => n + w.runs, 0) : 0

  function downloadCsv() {
    const header = ['date', 'recommended_mode', 'arrive_by', 'what_mattered_most', 'distance_band', 'location']
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.created_at ? r.created_at.slice(0, 10) : ''),
          csvCell(modeLabel(r.mode)),
          csvCell(r.arrive_by ?? ''),
          csvCell(r.motivation ? (MOTIVATION_LABEL[r.motivation] ?? r.motivation) : ''),
          csvCell(r.distance_category ? (DISTANCE_LABEL[r.distance_category] ?? r.distance_category) : ''),
          csvCell(locationName(r.location_id ?? null)),
        ].join(','),
      )
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileLabel}-runs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHead
        title="How employees use it"
        sub="Last 30 days on your Commute Advisor page"
        action={
          rows.length > 0 ? (
            <Button variant="ghost" size="sm" icon={Download} onClick={downloadCsv}>
              Download CSV
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {!usage && !failed && <p className="text-[13.5px] text-ink-muted">Loading...</p>}
        {failed && (
          <p className="text-[13.5px] leading-[1.5] text-ink-muted">
            Couldn&apos;t load usage right now. Reload to try again.
          </p>
        )}
        {usage && usage.runs === 0 && weeksTotal === 0 && (
          <p className="text-[13.5px] leading-[1.55] text-ink">
            Nobody has used your Commute Advisor page yet. Share the link from your Share Kit; each use shows
            here within a few minutes.
          </p>
        )}
        {usage && (usage.runs > 0 || weeksTotal > 0) && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <div className="text-[12px] font-semibold text-ink-muted">Commutes checked</div>
                <div className="mt-0.5 text-[24px] font-bold tracking-[-0.02em] text-ink">{usage.runs}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{changeLine(usage.runs, usage.prior_runs)}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <div className="text-[12px] font-semibold text-ink-muted">Recommended most</div>
                <div className="mt-0.5 text-[18px] font-bold leading-tight tracking-[-0.01em] text-ink">
                  {topMode ? modeLabel(topMode.mode) : 'Not yet'}
                </div>
                {topMode && (
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                    {topMode.runs} of {usage.runs} {usage.runs === 1 ? 'commute' : 'commutes'}
                  </div>
                )}
              </div>
            </div>

            {weeks && weeks.length > 0 && (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-[12px] font-semibold text-ink-muted">By week, last {weeks.length} weeks</div>
                  <div className="text-[12px] text-ink-muted">{weeksTotal} in all</div>
                </div>
                <div
                  className="grid items-end gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
                  role="img"
                  aria-label={`Runs by week: ${weeks.map((w) => `week of ${w.label} ${w.runs}`).join(', ')}`}
                >
                  {weeks.map((w, i) => (
                    <div key={i} className="grid gap-1 text-center">
                      <div className="text-[11px] font-semibold tabular-nums text-ink">{w.runs}</div>
                      <div className="flex h-12 items-end">
                        <div
                          className={`w-full rounded-t-[4px] ${w.runs > 0 ? 'bg-accent' : 'bg-ink/[0.12]'}`}
                          style={{ height: `${w.runs > 0 ? Math.max(8, Math.round((w.runs / maxWeek) * 100)) : 3}%` }}
                        />
                      </div>
                      <div className="truncate text-[10.5px] text-ink-tertiary">{w.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {usage.by_mode.length > 0 && usage.runs > 0 && (
              <div>
                <div className="mb-1.5 text-[12px] font-semibold text-ink-muted">What the advisor recommended</div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
                  {usage.by_mode.map((m, i) => (
                    <div
                      key={m.mode}
                      className="h-full"
                      style={{
                        width: `${(m.runs / usage.runs) * 100}%`,
                        background: 'var(--color-accent)',
                        opacity: 1 - Math.min(i, 4) * 0.18,
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-2 grid gap-1 text-[13px]">
                  {usage.by_mode.map((m, i) => (
                    <li key={m.mode} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-ink">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: 'var(--color-accent)', opacity: 1 - Math.min(i, 4) * 0.18 }}
                          aria-hidden
                        />
                        <span className="truncate">{modeLabel(m.mode)}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
                        {m.runs} · {Math.round((m.runs / usage.runs) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(arriveByChanges !== null || joinClicks !== null) && (
              <div className="grid grid-cols-2 gap-3">
                {arriveByChanges !== null && (
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div className="text-[12px] font-semibold text-ink-muted">Changed the arrive-by time</div>
                    <div className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-ink">{arriveByChanges}</div>
                  </div>
                )}
                {joinClicks !== null && (
                  <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                    <div className="text-[12px] font-semibold text-ink-muted">Clicked the join link</div>
                    <div className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-ink">{joinClicks}</div>
                  </div>
                )}
              </div>
            )}

            {motivationsPicked.length > 0 && usage.runs > 0 && (
              <div>
                <div className="mb-1.5 text-[12px] font-semibold text-ink-muted">What mattered most to them</div>
                <ul className="grid gap-1 text-[13px]">
                  {motivations.map((m) => (
                    <li key={m.motivation} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-ink">{MOTIVATION_LABEL[m.motivation] ?? m.motivation}</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
                        {m.runs} · {Math.round((m.runs / usage.runs) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {savings !== null && (
              <p className="text-[13px] leading-[1.5] text-ink">
                Estimated annual savings of the recommended modes:{' '}
                <span className="font-semibold">${savings.toLocaleString('en-US')}</span> a year, across everyone who checked,
                compared with driving.
              </p>
            )}

            {usage.by_location.length > 0 && (
              <div>
                <div className="mb-1.5 text-[12px] font-semibold text-ink-muted">By location</div>
                <ul className="grid gap-1 text-[13px]">
                  {usage.by_location.map((l) => (
                    <li key={l.location_id ?? 'none'} className="flex items-center justify-between gap-3 border-t border-line-2 py-1.5">
                      <span className="min-w-0 truncate text-ink">{locationName(l.location_id)}</span>
                      <span className="whitespace-nowrap font-semibold text-ink">{l.runs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[12px] leading-[1.5] text-ink-muted">
              One run is one person getting their options. Nothing about who they are or where they live is kept.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
