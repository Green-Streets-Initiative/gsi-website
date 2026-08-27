'use client'

import { useMemo, useState } from 'react'
import { CopySimple, DownloadSimple, MapPin } from '@phosphor-icons/react'
import { AUDIT_MODULES, moduleById } from '@/components/walk-audit/moduleModel'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import type { ProblemPin } from '@/components/volunteer-route/formModel'

interface Submission {
  id: string
  module: string
  observer_name: string | null
  answers: Record<string, unknown>
  problem_pins: ProblemPin[]
  photos: { url: string; caption?: string; lat?: number; lng?: number }[]
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
    created_at: string
  }
  submissions: Submission[]
}

const ROLLUP_STYLE: Record<string, string> = {
  great: 'bg-green-100 text-green-700',
  acceptable: 'bg-blue-100 text-blue-700',
  mixed: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function WalkAuditResultsClient({ data }: { data: ResultsData }) {
  const { audit, submissions } = data
  const [copied, setCopied] = useState(false)

  const routeCoordinates: [number, number][] =
    audit.area_type === 'route' && Array.isArray(audit.area)
      ? audit.area
          .filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
          .map((p) => [p.lng, p.lat] as [number, number])
      : []
  const locationCenter =
    audit.area_type === 'location' && !Array.isArray(audit.area) ? audit.area : null

  // Every flagged spot across every submission, attributed in the popup note.
  const allPins: ProblemPin[] = useMemo(
    () =>
      submissions.flatMap((s) =>
        (s.problem_pins ?? []).map((p) => ({
          ...p,
          note: [p.note, s.observer_name ? `— ${s.observer_name}` : null]
            .filter(Boolean)
            .join(' '),
        })),
      ),
    [submissions],
  )

  const moduleTallies = useMemo(() => {
    return AUDIT_MODULES.map((m) => {
      const subs = submissions.filter((s) => s.module === m.id)
      const rollups: Record<string, number> = {}
      for (const s of subs) {
        const r = s.answers?.rollup as string | undefined
        if (r) rollups[r] = (rollups[r] ?? 0) + 1
      }
      return { module: m, count: subs.length, rollups }
    }).filter((t) => t.count > 0)
  }, [submissions])

  function downloadCsv() {
    const keys = new Set<string>()
    for (const s of submissions) for (const k of Object.keys(s.answers ?? {})) keys.add(k)
    const answerKeys = [...keys].sort()
    const header = ['submitted_at', 'module', 'observer', 'pins', 'photos', ...answerKeys]
    const rows = submissions.map((s) => [
      s.submitted_at,
      moduleById(s.module)?.name ?? s.module,
      s.observer_name ?? '',
      (s.problem_pins ?? [])
        .map((p) => `${p.note || 'flag'} (${p.lat.toFixed(5)},${p.lng.toFixed(5)})`)
        .join(' | '),
      (s.photos ?? []).map((p) => p.url).join(' | '),
      ...answerKeys.map((k) => s.answers?.[k]),
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
      await navigator.clipboard.writeText(
        `${window.location.origin}/walk-audit/${audit.participant_token}`,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      <div className="bg-[#191A2E] px-4 py-6">
        <div className="mx-auto max-w-[800px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/75">
            Walk audit results
          </p>
          <h1 className="mt-1 text-xl font-bold text-white">{audit.title}</h1>
          <p className="mt-0.5 text-sm text-white/75">
            {[audit.area_label, audit.city, audit.org_name].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[800px] space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#374151]">
            <span className="font-bold text-[#191A2E]">{submissions.length}</span> submission
            {submissions.length === 1 ? '' : 's'} ·{' '}
            <span className="font-bold text-[#191A2E]">{allPins.length}</span> flagged spot
            {allPins.length === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={copyParticipantLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#191A2E] hover:border-[#2966E5]"
            >
              <CopySimple size={14} weight="bold" />
              {copied ? 'Copied!' : 'Copy participant link'}
            </button>
            {submissions.length > 0 && (
              <button
                onClick={downloadCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2966E5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2966E5]/90"
              >
                <DownloadSimple size={14} weight="bold" /> Download CSV
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-2 shadow-sm">
          <VolunteerRouteMap
            routeCoordinates={routeCoordinates}
            center={locationCenter}
            pins={allPins}
            heightClass="h-80"
          />
          <p className="mt-1.5 inline-flex items-center gap-1 px-2 pb-1 text-[11px] text-[#6B7280]">
            <MapPin size={13} weight="fill" className="text-[#D97706]" />
            Amber pins are flagged spots from every submission — tap one for the note.
          </p>
        </div>

        {moduleTallies.length > 0 && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase text-[#6B7280]">By section</p>
            <div className="space-y-2">
              {moduleTallies.map(({ module, count, rollups }) => (
                <div key={module.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#191A2E]">
                    {module.name}{' '}
                    <span className="font-normal text-[#6B7280]">
                      ({count} submission{count === 1 ? '' : 's'})
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    {Object.entries(rollups).map(([r, n]) => (
                      <span
                        key={r}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLLUP_STYLE[r] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {r} ×{n}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submissions.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#6B7280]">
              No submissions yet. Share the participant link with your walkers — results appear
              here as they submit.
            </p>
          </div>
        )}

        {submissions.map((s) => {
          const m = moduleById(s.module)
          const rollup = s.answers?.rollup as string | undefined
          const notes = s.answers?.notes as string | undefined
          return (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#191A2E]">
                  {m?.name ?? s.module}
                  {s.observer_name && (
                    <span className="ml-2 font-normal text-[#6B7280]">by {s.observer_name}</span>
                  )}
                </p>
                <span className="flex items-center gap-2">
                  {rollup && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLLUP_STYLE[rollup] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {rollup}
                    </span>
                  )}
                  <span className="text-[11px] text-[#6B7280]">
                    {new Date(s.submitted_at).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                </span>
              </div>

              {(s.problem_pins ?? []).length > 0 && (
                <ul className="mb-2 space-y-1">
                  {s.problem_pins.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-[#374151]">
                      <MapPin size={13} weight="fill" className="mt-0.5 shrink-0 text-[#D97706]" />
                      {p.note || '(flagged, no note)'}
                      {p.category && (
                        <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {p.category}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {notes && <p className="mb-2 text-sm italic text-[#4A4D68]">“{notes}”</p>}

              {(s.photos ?? []).length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {s.photos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.caption || ''} className="h-20 w-28 rounded-lg object-cover" />
                      {p.caption && (
                        <p className="mt-0.5 max-w-[112px] truncate text-[10px] text-[#6B7280]">{p.caption}</p>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
