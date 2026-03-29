import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

interface StandingRow {
  entity_type: string
  entity_name: string
  school_name: string
  active_pct: number
  total_trips: number
  active_trips: number
  rank: number
}

async function getSchoolData(code: string) {
  const supabase = createServerSupabaseClient()

  // Look up classroom by join code to find the school
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id, class_name, school_id, grade, schools(id, name, city, grade_span)')
    .ilike('join_code', code)
    .limit(1)
    .single()

  if (!classroom) return null

  const school = classroom.schools as any
  const schoolId = classroom.school_id

  // Get all classrooms in this school
  const { data: allClassrooms } = await supabase
    .from('classrooms')
    .select('id, class_name, grade, student_count')
    .eq('school_id', schoolId)
    .order('grade')
    .order('class_name')

  // Get latest competition standings
  const { data: standings } = await supabase
    .from('school_competition_standings')
    .select('*')
    .eq('entity_type', 'classroom')
    .in('entity_id', (allClassrooms ?? []).map((c) => c.id))
    .order('rank')

  // Calculate school-wide shift rate from standings
  let schoolActivePct = 0
  if (standings && standings.length > 0) {
    const totalActive = standings.reduce((sum: number, s: any) => sum + (s.active_trips ?? 0), 0)
    const totalTrips = standings.reduce((sum: number, s: any) => sum + (s.total_trips ?? 0), 0)
    schoolActivePct = totalTrips > 0 ? (totalActive / totalTrips) * 100 : 0
  }

  // Group standings by grade
  const gradeMap = new Map<number, typeof standings>()
  for (const s of standings ?? []) {
    const cr = (allClassrooms ?? []).find((c) => c.id === s.entity_id)
    const grade = cr?.grade ?? -1
    if (!gradeMap.has(grade)) gradeMap.set(grade, [])
    gradeMap.get(grade)!.push(s)
  }

  return {
    school,
    schoolId,
    classroomCode: code.toUpperCase(),
    classroomName: classroom.class_name,
    schoolActivePct,
    gradeStandings: [...gradeMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([grade, rows]) => ({
        grade,
        gradeName: grade === 0 ? 'Kindergarten' : `Grade ${grade}`,
        classrooms: (rows as StandingRow[]).sort((a, b) => a.rank - b.rank),
      })),
    totalClassrooms: allClassrooms?.length ?? 0,
  }
}

export default async function SchoolPortalPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const data = await getSchoolData(code)
  if (!data) return notFound()

  const { school, classroomCode, schoolActivePct, gradeStandings, totalClassrooms } = data

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-6 py-8 text-center">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-extrabold text-white">&raquo; Shift</span>
            <span className="text-sm font-medium text-white/50">for Schools</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            {school.name}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {school.city} &middot; {school.grade_span}
          </p>
        </div>
      </div>

      {/* Teal accent line */}
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[800px] space-y-8 px-6 py-10">
        {/* School-wide Shift Rate */}
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            School-Wide Active Transportation Rate
          </p>
          <p className="mt-2 font-display text-5xl font-extrabold text-[#191A2E]">
            {Math.round(schoolActivePct)}%
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            {totalClassrooms} participating classroom{totalClassrooms !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Standings by grade */}
        {gradeStandings.length > 0 ? (
          <div className="space-y-6">
            <h2 className="font-display text-lg font-bold text-[#191A2E]">
              Classroom Standings
            </h2>
            {gradeStandings.map(({ grade, gradeName, classrooms }) => (
              <div key={grade} className="rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-[#F4F8EE] px-5 py-3">
                  <h3 className="text-sm font-semibold text-[#191A2E]">{gradeName}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {classrooms.map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#191A2E] text-xs font-bold text-white">
                          {row.rank}
                        </span>
                        <span className="text-sm font-medium text-[#191A2E]">
                          {row.entity_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-display text-lg font-bold text-[#191A2E]">
                          {Math.round(Number(row.active_pct) * 100)}%
                        </span>
                        <span className="ml-2 text-xs text-[#6B7280]">
                          {row.active_trips} active trips
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

        {/* Join section */}
        <div className="rounded-2xl bg-[#191A2E] p-8 text-center">
          <h2 className="font-display text-lg font-bold text-white">
            Want to follow your child&apos;s class?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            Download the Shift app and enter your classroom code to get weekly
            updates on how your child&apos;s class is doing.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3">
            <span className="text-xs text-white/50">Classroom Code</span>
            <span className="font-display text-2xl font-extrabold tracking-wider text-[#BAF14D]">
              {classroomCode}
            </span>
          </div>
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
