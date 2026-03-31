'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  schoolId: string
  schoolName: string
  city: string
  gradeSpan: string
  classroomCount: number
  enteredCode: string
}

interface ClassroomStanding {
  name: string
  grade: number
  activePct: number
  activeTrips: number
  totalTrips: number
}

interface StandingsData {
  schoolActivePct: number
  gradeStandings: {
    grade: number
    gradeName: string
    classrooms: ClassroomStanding[]
  }[]
}

interface PublishedCorridor {
  id: string
  name: string
  recommended_modes: string | null
  mode_rationale: string | null
  family_description: string | null
  estimated_walk_minutes: number
  estimated_bike_minutes: number
  distance_miles: number
  google_maps_url_walk: string | null
  google_maps_url_bike: string | null
  priority_rank: number
}

interface PublishedRouteData {
  published_at: string | null
  corridors: PublishedCorridor[]
}

const MODE_BADGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  walk_and_bike: { label: 'Walk & Bike', bg: 'bg-green-100', text: 'text-green-700' },
  walk_only: { label: 'Walk Only', bg: 'bg-blue-100', text: 'text-blue-700' },
  bike_with_caution: { label: 'Bike with Caution', bg: 'bg-amber-100', text: 'text-amber-700' },
  bike_not_recommended: { label: 'Bike Not Recommended', bg: 'bg-red-100', text: 'text-red-700' },
}

// Shift chevron SVG mark
function ShiftMark() {
  return (
    <span className="inline-flex items-center gap-[3px] relative" style={{ top: '-2px' }}>
      <svg viewBox="0 0 9 15" width="13" height="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#BAF14D" />
      </svg>
      <svg viewBox="0 0 9 15" width="13" height="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#2966E5" />
      </svg>
    </span>
  )
}

export default function SchoolPortalClient({
  schoolId,
  schoolName,
  city,
  gradeSpan,
  classroomCount,
  enteredCode,
}: Props) {
  const [codeInput, setCodeInput] = useState('')
  const [verified, setVerified] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [standings, setStandings] = useState<StandingsData | null>(null)
  const [routeData, setRouteData] = useState<PublishedRouteData | null>(null)

  // Fetch published routes on mount (public info, no code needed)
  useEffect(() => {
    async function loadRoutes() {
      const { data: assessment } = await supabase
        .from('route_assessments')
        .select('id, published_at, route_corridors(*)')
        .eq('school_id', schoolId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (assessment) {
        const corridors = ((assessment as any).route_corridors ?? [])
          .filter((c: any) => c.published)
          .sort((a: any, b: any) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99))
        if (corridors.length > 0) {
          setRouteData({
            published_at: (assessment as any).published_at,
            corridors,
          })
        }
      }
    }
    loadRoutes()
  }, [schoolId])

  async function handleVerify() {
    const trimmed = codeInput.trim().toUpperCase()
    if (!trimmed) {
      setCodeError('Enter your classroom code')
      return
    }

    setLoading(true)
    setCodeError('')

    // Verify the code belongs to this school
    const { data: classroom } = await supabase
      .from('classrooms')
      .select('id, school_id')
      .ilike('join_code', trimmed)
      .single()

    if (!classroom || classroom.school_id !== schoolId) {
      setCodeError('Invalid code for this school')
      setLoading(false)
      return
    }

    // Fetch standings
    const { data: allClassrooms } = await supabase
      .from('classrooms')
      .select('id, class_name, grade')
      .eq('school_id', schoolId)
      .order('grade')
      .order('class_name')

    // Get all weekly logs to compute cumulative standings
    const classroomIds = (allClassrooms ?? []).map((c) => c.id)
    const { data: logs } = await supabase
      .from('weekly_logs')
      .select('classroom_id, active_trips, total_trips')
      .in('classroom_id', classroomIds)
      .in('processing_status', ['processed', 'manual'])

    // Aggregate per classroom
    const agg = new Map<string, { active: number; total: number }>()
    for (const log of logs ?? []) {
      const prev = agg.get(log.classroom_id) ?? { active: 0, total: 0 }
      prev.active += log.active_trips
      prev.total += log.total_trips
      agg.set(log.classroom_id, prev)
    }

    // Build standings
    const classroomStandings = (allClassrooms ?? [])
      .map((c) => {
        const a = agg.get(c.id)
        return {
          name: c.class_name,
          grade: c.grade,
          activePct: a && a.total > 0 ? a.active / a.total : 0,
          activeTrips: a?.active ?? 0,
          totalTrips: a?.total ?? 0,
        }
      })
      .filter((c) => c.totalTrips > 0)
      .sort((a, b) => b.activePct - a.activePct)

    // Group by grade
    const gradeMap = new Map<number, ClassroomStanding[]>()
    for (const s of classroomStandings) {
      if (!gradeMap.has(s.grade)) gradeMap.set(s.grade, [])
      gradeMap.get(s.grade)!.push(s)
    }

    const totalActive = classroomStandings.reduce((s, c) => s + c.activeTrips, 0)
    const totalTrips = classroomStandings.reduce((s, c) => s + c.totalTrips, 0)

    setStandings({
      schoolActivePct: totalTrips > 0 ? totalActive / totalTrips : 0,
      gradeStandings: [...gradeMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([grade, classrooms]) => ({
          grade,
          gradeName: grade === 0 ? 'Kindergarten' : `Grade ${grade}`,
          classrooms: classrooms.sort((a, b) => b.activePct - a.activePct),
        })),
    })

    setVerified(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-6 py-8 text-center">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-extrabold text-white">Shift</span>
            <ShiftMark />
            <span className="text-sm font-medium text-white/50">for Schools</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            {schoolName}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {city} &middot; {gradeSpan}
          </p>
        </div>
      </div>

      {/* Teal accent line */}
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[800px] space-y-8 px-6 py-10">
        {!verified ? (
          /* ── Code Entry ── */
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#191A2E]">
              Enter your classroom code to view standings
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7280]">
              Your classroom code is on the take-home flyer your child brought home,
              or in your weekly email from Shift.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase())
                  setCodeError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="e.g., RODRI3"
                maxLength={8}
                className="w-40 rounded-lg border-2 border-[#191A2E]/20 bg-white px-4 py-3 text-center font-display text-xl font-extrabold tracking-wider text-[#191A2E] uppercase placeholder:text-[#191A2E]/20 focus:border-[#2966E5] focus:outline-none"
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                className="rounded-lg bg-[#2966E5] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'View Standings'}
              </button>
            </div>
            {codeError && (
              <p className="mt-3 text-sm font-medium text-red-600">{codeError}</p>
            )}
          </div>
        ) : (
          /* ── Standings (verified) ── */
          <>
            {/* School-wide Shift Rate */}
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                School-Wide Active Transportation Rate
              </p>
              <p className="mt-2 font-display text-5xl font-extrabold text-[#191A2E]">
                {Math.round((standings?.schoolActivePct ?? 0) * 100)}%
              </p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {classroomCount} participating classroom{classroomCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Standings by grade */}
            {standings && standings.gradeStandings.length > 0 ? (
              <div className="space-y-6">
                <h2 className="font-display text-lg font-bold text-[#191A2E]">
                  Classroom Standings
                </h2>
                {standings.gradeStandings.map(({ grade, gradeName, classrooms }) => (
                  <div key={grade} className="overflow-hidden rounded-xl bg-white shadow-sm">
                    <div className="border-b border-gray-100 bg-[#F4F8EE] px-5 py-3">
                      <h3 className="text-sm font-semibold text-[#191A2E]">{gradeName}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {classrooms.map((row, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#191A2E] text-xs font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-[#191A2E]">
                              {row.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-display text-lg font-bold text-[#191A2E]">
                              {Math.round(row.activePct * 100)}%
                            </span>
                            <span className="ml-2 text-xs text-[#6B7280]">
                              {row.activeTrips} active trips
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-[#6B7280]">
                  No competition data yet. Check back once classrooms start submitting!
                </p>
              </div>
            )}
          </>
        )}

        {/* Safe Routes section */}
        {routeData && routeData.corridors.length > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-lg font-bold text-[#191A2E]">
                Safe Routes to School
              </h2>
              {routeData.published_at && (
                <p className="mt-1 text-sm text-[#6B7280]">
                  Routes assessed{' '}
                  {new Date(routeData.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}
            </div>

            {/* Stale assessment warning */}
            {routeData.published_at &&
              Date.now() - new Date(routeData.published_at).getTime() > 365 * 24 * 60 * 60 * 1000 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-center">
                  <p className="text-sm text-amber-700">
                    These routes were last assessed over a year ago. Conditions may have changed.
                  </p>
                </div>
              )}

            {routeData.corridors.map((corridor) => {
              const badge = MODE_BADGE_STYLES[corridor.recommended_modes ?? ''] ?? {
                label: corridor.recommended_modes ?? '—',
                bg: 'bg-gray-100',
                text: 'text-gray-600',
              }
              const showCycling =
                corridor.recommended_modes === 'walk_and_bike' ||
                corridor.recommended_modes === 'bike_with_caution'

              return (
                <div key={corridor.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-base font-bold text-[#191A2E]">
                        {corridor.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex gap-4 text-sm text-[#6B7280] mb-3">
                      <span>{corridor.distance_miles} mi</span>
                      <span>{corridor.estimated_walk_minutes} min walk</span>
                      {corridor.estimated_bike_minutes > 0 && (
                        <span>{corridor.estimated_bike_minutes} min bike</span>
                      )}
                    </div>

                    {corridor.mode_rationale && (
                      <p className="text-sm text-[#4A4D68] mb-3">{corridor.mode_rationale}</p>
                    )}

                    {corridor.family_description && (
                      <p className="text-sm text-[#6B7280] mb-3">{corridor.family_description}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {corridor.google_maps_url_walk && (
                        <a
                          href={corridor.google_maps_url_walk}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2966E5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90"
                        >
                          Open in Google Maps (Walking)
                        </a>
                      )}
                      {showCycling && corridor.google_maps_url_bike && (
                        <a
                          href={corridor.google_maps_url_bike}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2966E5] px-4 py-2 text-sm font-semibold text-[#2966E5] transition hover:bg-[#2966E5]/5"
                        >
                          Open in Google Maps (Cycling)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* PDF download */}
            <div className="text-center">
              <a
                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-asset?asset_type=route_map&school_id=${schoolId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#2966E5] transition hover:text-[#2966E5]/80"
              >
                Download Route Map PDF
              </a>
            </div>
          </div>
        )}

        {/* Join section */}
        <div className="rounded-2xl bg-[#191A2E] p-8 text-center">
          <h2 className="font-display text-lg font-bold text-white">
            Want to follow your child&apos;s class?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            Download the Shift app and enter your classroom code to get weekly
            updates on how your child&apos;s class is doing.
          </p>
          <div className="mt-6">
            <a
              href="https://shiftyourtrip.org/download"
              className="inline-block rounded-lg bg-[#2966E5] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90"
            >
              Download Shift
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#6B7280]">
          Shift for Schools by Green Streets Initiative &middot; gogreenstreets.org
        </p>
      </div>
    </main>
  )
}
