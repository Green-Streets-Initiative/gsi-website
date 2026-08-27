'use client'

import { useMemo, useState } from 'react'
import { CopySimple, DownloadSimple, Flag, ThumbsUp, Warning } from '@phosphor-icons/react'
import { moduleById } from '@/components/walk-audit/moduleModel'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'

interface Observation {
  id: string
  lat: number
  lng: number
  valence: 'good' | 'problem'
  category: string | null
  severity: number | null
  note: string | null
  photo: { url: string } | null
  observer_name: string | null
  created_at: string
}

interface Submission {
  id: string
  module: string
  observer_name: string | null
  answers: Record<string, unknown>
  submitted_at: string
}

interface ResultsData {
  audit: {
    id: string
    title: string
    org_name: string | null
    purpose: string
    area_type: 'route' | 'location'
    area: { lat: number; lng: number }[] | { lat: number; lng: number }
    area_label: string | null
    city: string | null
    scheduled_for: string | null
    participant_token: string
    enabled_modules: string[]
    hazard_context: {
      crash_clusters?: { lat: number; lng: number; crashCount?: number }[]
      summary?: { cluster_count: number; total_crashes: number }
    } | null
    created_at: string
  }
  observations: Observation[]
  submissions: Submission[]
}

const CATEGORY_LABELS: Record<string, string> = {
  crossing: 'Crossings',
  sidewalk: 'Sidewalks',
  traffic: 'Traffic',
  biking: 'Biking',
  feels_unsafe: 'Feels unsafe',
  other: 'Other',
}

const LENS_LABELS: Record<string, string> = {
  safety: 'Safety',
  comfort: 'Comfort',
  crossings: 'Getting across',
  destinations: 'Places to go',
}

const VERDICT_LABELS: Record<string, string> = {
  great: 'Great',
  acceptable: 'Acceptable',
  mixed: 'Mixed',
  poor: 'Poor',
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function WalkAuditResultsClient({ data }: { data: ResultsData }) {
  const { audit, observations, submissions } = data
  const [copied, setCopied] = useState(false)

  const routeCoordinates: [number, number][] =
    audit.area_type === 'route' && Array.isArray(audit.area)
      ? audit.area
          .filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
          .map((p) => [p.lng, p.lat] as [number, number])
      : []
  const locationCenter =
    audit.area_type === 'location' && !Array.isArray(audit.area) ? audit.area : null

  const problems = observations.filter((o) => o.valence === 'problem')
  const goods = observations.filter((o) => o.valence === 'good')
  const wrapUps = submissions.filter((s) => s.module === 'wrap_up')
  const extraSubs = submissions.filter((s) => s.module !== 'wrap_up')

  const walkerCount = useMemo(() => {
    const names = new Set<string>()
    let anonymous = 0
    for (const o of observations) {
      if (o.observer_name) names.add(o.observer_name)
      else anonymous++
    }
    for (const s of wrapUps) {
      if (s.observer_name) names.add(s.observer_name)
    }
    return Math.max(names.size + (anonymous > 0 ? 1 : 0), wrapUps.length, 1)
  }, [observations, wrapUps])

  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of problems) {
      const c = o.category ?? 'other'
      counts[c] = (counts[c] ?? 0) + 1
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0] ? { label: CATEGORY_LABELS[sorted[0][0]] ?? sorted[0][0], count: sorted[0][1] } : null
  }, [problems])

  // "N of M walkers rated <lens> Mixed or Poor" — the humane verdict summary.
  const verdictSentences = useMemo(() => {
    if (wrapUps.length === 0) return []
    return Object.keys(LENS_LABELS).flatMap((lens) => {
      const votes = wrapUps
        .map((s) => (s.answers?.verdicts as Record<string, string> | undefined)?.[lens])
        .filter(Boolean) as string[]
      if (votes.length === 0) return []
      const concerned = votes.filter((v) => v === 'mixed' || v === 'poor').length
      const positive = votes.length - concerned
      if (concerned > 0) {
        return [`${concerned} of ${votes.length} rated ${LENS_LABELS[lens].toLowerCase()} Mixed or Poor`]
      }
      return [`all ${positive} rated ${LENS_LABELS[lens].toLowerCase()} ${votes.every((v) => v === 'great') ? 'Great' : 'Great or Acceptable'}`]
    })
  }, [wrapUps])

  const topFixes = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of wrapUps) {
      const f = s.answers?.top_fix as string | undefined
      if (f) counts[f] = (counts[f] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [wrapUps])

  const connections = wrapUps
    .map((s) => s.answers?.connected_with as string | undefined)
    .filter((c): c is string => !!c && c.trim().length > 0)

  const mapPins = useMemo(
    () => [
      ...(audit.hazard_context?.crash_clusters ?? []).slice(0, 12).map((c) => ({
        lat: c.lat, lng: c.lng,
        note: `${c.crashCount ?? 1} reported crash${(c.crashCount ?? 1) === 1 ? '' : 'es'} near here (MassDOT)`,
        category: null, color: '#DC2626',
      })),
      ...observations.map((o) => ({
        lat: o.lat, lng: o.lng,
        note: [o.note || (o.valence === 'good' ? 'Works well' : 'Problem'), o.observer_name ? `— ${o.observer_name}` : '']
          .filter(Boolean).join(' '),
        category: o.category,
        color: o.valence === 'good' ? '#BAF14D' : '#D97706',
      })),
    ],
    [observations, audit.hazard_context],
  )

  function downloadCsv() {
    const header = ['when', 'who', 'good_or_problem', 'what_kind', 'how_bad_1to5', 'note', 'photo', 'lat', 'lng']
    const rows = observations.map((o) => [
      o.created_at, o.observer_name ?? '', o.valence,
      o.category ? (CATEGORY_LABELS[o.category] ?? o.category) : '',
      o.severity ?? '', o.note ?? '', o.photo?.url ?? '', o.lat, o.lng,
    ])
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `walk-audit-${audit.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function copyParticipantLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/walk-audit/${audit.participant_token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function ObservationRow({ o }: { o: Observation }) {
    return (
      <div className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
        {o.photo?.url ? (
          <a href={o.photo.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.photo.url} alt="" className="h-16 w-20 rounded-lg object-cover" />
          </a>
        ) : (
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${o.valence === 'good' ? 'bg-[#BAF14D]/40 text-[#3D5407]' : 'bg-[#D97706]/15 text-[#B45309]'}`}>
            {o.valence === 'good' ? <ThumbsUp size={15} weight="fill" /> : <Warning size={15} weight="fill" />}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm text-[#191A2E]">{o.note || (o.valence === 'good' ? 'Works well here' : 'A problem here')}</p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            {[
              o.category ? (CATEGORY_LABELS[o.category] ?? o.category) : null,
              o.severity ? `severity ${o.severity} of 5` : null,
              o.observer_name,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      <div className="bg-[#191A2E] px-4 py-6">
        <div className="mx-auto max-w-[800px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/75">What the walk found</p>
          <h1 className="mt-1 text-xl font-bold text-white">{audit.title}</h1>
          <p className="mt-0.5 text-sm text-white/75">
            {[audit.area_label, audit.city, audit.org_name].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[800px] space-y-5 px-4 py-6">
        {/* The story, in one card */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          {observations.length === 0 && wrapUps.length === 0 ? (
            <p className="text-sm text-[#374151]">
              No findings yet. Share the walking link — as people flag spots, this page becomes the
              story of what they found.
            </p>
          ) : (
            <>
              <p className="text-[17px] leading-snug text-[#191A2E]">
                <strong>{walkerCount} walker{walkerCount === 1 ? '' : 's'}</strong> flagged{' '}
                <strong>{observations.length} spot{observations.length === 1 ? '' : 's'}</strong>
                {observations.length > 0 && (
                  <> — <strong className="text-[#B45309]">{problems.length} problem{problems.length === 1 ? '' : 's'}</strong> and{' '}
                  <strong className="text-[#3D5407]">{goods.length} that work{goods.length === 1 ? 's' : ''} well</strong></>
                )}
                {topCategory && topCategory.count > 1 && (
                  <>. The most-flagged issue: <strong>{topCategory.label.toLowerCase()}</strong> ({topCategory.count} flags)</>
                )}
                .
              </p>
              {verdictSentences.length > 0 && (
                <p className="mt-2 text-sm text-[#374151]">
                  In the wrap-ups, {verdictSentences.join('; ')}.
                </p>
              )}
              {topFixes.length > 0 && (
                <p className="mt-2 text-sm text-[#374151]">
                  Asked what to fix first, the group said: <strong>{topFixes[0][0]}</strong>
                  {topFixes[0][1] > 1 ? ` (${topFixes[0][1]} votes)` : ''}
                  {topFixes[1] ? `, then ${topFixes[1][0]}` : ''}.
                </p>
              )}
              {audit.hazard_context?.summary && audit.hazard_context.summary.cluster_count > 0 && (
                <p className="mt-2 text-xs text-[#6B7280]">
                  Context: MassDOT records {audit.hazard_context.summary.total_crashes} pedestrian/cyclist
                  crashes in {audit.hazard_context.summary.cluster_count} cluster
                  {audit.hazard_context.summary.cluster_count === 1 ? '' : 's'} around this area — the red
                  dots on the map.
                </p>
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={copyParticipantLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#191A2E] hover:border-[#2966E5]"
            >
              <CopySimple size={14} weight="bold" /> {copied ? 'Copied!' : 'Copy walking link'}
            </button>
            {observations.length > 0 && (
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2966E5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2966E5]/90"
              >
                <DownloadSimple size={14} weight="bold" /> Download the data (CSV)
              </button>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <VolunteerRouteMap
            routeCoordinates={routeCoordinates}
            center={locationCenter}
            pins={mapPins}
            heightClass="h-80"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[11px] text-[#6B7280]">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#BAF14D] border border-[#3D5407]/30"></span> works well</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#D97706]"></span> problem</span>
            {(audit.hazard_context?.crash_clusters?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]"></span> reported crashes (MassDOT)</span>
            )}
            <span className="ml-auto">Tap a pin for the note</span>
          </div>
        </div>

        {/* Problems, then what works */}
        {problems.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-[#191A2E]">
              <Warning size={18} weight="fill" className="text-[#D97706]" /> The problems ({problems.length})
            </h2>
            {problems
              .slice()
              .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
              .map((o) => <ObservationRow key={o.id} o={o} />)}
          </div>
        )}

        {goods.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-[#191A2E]">
              <ThumbsUp size={18} weight="fill" className="text-[#52B788]" /> What&apos;s working ({goods.length})
            </h2>
            {goods.map((o) => <ObservationRow key={o.id} o={o} />)}
          </div>
        )}

        {/* Who we connected with — the social outcome */}
        {connections.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-[#191A2E]">Who the walk connected</h2>
            <ul className="space-y-1">
              {connections.map((c, i) => (
                <li key={i} className="text-sm text-[#374151]">— {c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Extra assignments, only if the organizer enabled them */}
        {extraSubs.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-[#191A2E]">Extra assignments</h2>
            {extraSubs.map((s) => {
              const m = moduleById(s.module)
              const answered = Object.entries(s.answers ?? {}).filter(
                ([k, v]) => !['notes', 'rollup'].includes(k) && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
              )
              return (
                <div key={s.id} className="border-b border-gray-100 py-3 last:border-0">
                  <p className="text-sm font-semibold text-[#191A2E]">
                    {m?.name ?? s.module}
                    {s.observer_name && <span className="ml-2 font-normal text-[#6B7280]">by {s.observer_name}</span>}
                    {typeof s.answers?.rollup === 'string' && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
                        {VERDICT_LABELS[s.answers.rollup as string] ?? (s.answers.rollup as string)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">{answered.length} answer{answered.length === 1 ? '' : 's'} recorded{typeof s.answers?.notes === 'string' && s.answers.notes ? ` · “${s.answers.notes}”` : ''}</p>
                </div>
              )
            })}
            <button
              onClick={() => {
                const keys = new Set<string>()
                for (const s of extraSubs) for (const k of Object.keys(s.answers ?? {})) keys.add(k)
                const answerKeys = [...keys].sort()
                const header = ['when', 'form', 'who', ...answerKeys]
                const rows = extraSubs.map((s) => [
                  s.submitted_at,
                  moduleById(s.module)?.name ?? s.module,
                  s.observer_name ?? '',
                  ...answerKeys.map((k) => s.answers?.[k]),
                ])
                const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `walk-audit-forms-${audit.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
                a.click()
                URL.revokeObjectURL(a.href)
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#191A2E] hover:border-[#2966E5]"
            >
              <DownloadSimple size={13} weight="bold" /> Download full answers (CSV)
            </button>
          </div>
        )}

        {observations.length === 0 && wrapUps.length === 0 && (
          <p className="flex items-center justify-center gap-1.5 pt-4 text-center text-xs text-[#6B7280]">
            <Flag size={13} weight="fill" className="text-[#D97706]" /> Waiting for the first flag…
          </p>
        )}
      </div>
    </main>
  )
}
