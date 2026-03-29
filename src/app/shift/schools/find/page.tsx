import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

export const revalidate = 300 // revalidate every 5 minutes

async function getActiveSchools() {
  const supabase = createServerSupabaseClient()

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, city, grade_span, program_active')
    .eq('program_active', true)
    .order('name')

  if (!schools || schools.length === 0) return []

  // Get one classroom per school to use as the portal URL code
  const schoolIds = schools.map((s) => s.id)
  const { data: classrooms } = await supabase
    .from('classrooms')
    .select('school_id, join_code')
    .in('school_id', schoolIds)
    .order('grade')

  // Map school → first classroom code
  const codeMap = new Map<string, string>()
  for (const c of classrooms ?? []) {
    if (!codeMap.has(c.school_id)) {
      codeMap.set(c.school_id, c.join_code)
    }
  }

  return schools
    .filter((s) => codeMap.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      gradeSpan: s.grade_span,
      code: codeMap.get(s.id)!,
    }))
}

export default async function FindSchoolPage() {
  const schools = await getActiveSchools()

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-6 py-8 text-center">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-extrabold text-white">Shift</span>
            <span className="inline-flex items-center gap-[3px] relative" style={{ top: '-2px' }}>
              <svg viewBox="0 0 9 15" width="13" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#BAF14D" />
              </svg>
              <svg viewBox="0 0 9 15" width="13" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#2966E5" />
              </svg>
            </span>
            <span className="text-sm font-medium text-white/50">for Schools</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            Find Your School
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Select your school to view classroom standings
          </p>
        </div>
      </div>

      {/* Teal accent line */}
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[800px] space-y-6 px-6 py-10">
        {schools.length > 0 ? (
          <div className="space-y-3">
            {schools.map((school) => (
              <Link
                key={school.id}
                href={`/shift/schools/${school.code}`}
                className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm transition hover:ring-2 hover:ring-[#2966E5]/30"
              >
                <div>
                  <h2 className="font-display text-base font-bold text-[#191A2E]">
                    {school.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    {school.city} &middot; {school.gradeSpan}
                  </p>
                </div>
                <span className="text-sm font-medium text-[#2966E5]">
                  View &rarr;
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <p className="font-display text-lg font-bold text-[#191A2E]">
              No schools are active yet
            </p>
            <p className="mt-2 text-sm text-[#6B7280]">
              Schools will appear here once they join the Shift for Schools program.
            </p>
          </div>
        )}

        {/* Don't see your school? */}
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#191A2E]">
            Don&apos;t see your school?
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            If your child&apos;s school isn&apos;t listed, they may not have joined yet.
            You can also enter your classroom code directly:
          </p>
          <div className="mt-4">
            <Link
              href="/shift/schools"
              className="text-sm font-semibold text-[#2966E5] hover:underline"
            >
              Learn about bringing Shift to your school &rarr;
            </Link>
          </div>
        </div>

        {/* Code entry fallback */}
        <div className="rounded-xl bg-[#191A2E] p-6 text-center">
          <p className="text-sm font-medium text-white">
            Have a classroom code?
          </p>
          <p className="mt-1 text-sm text-white/60">
            If you have your classroom code from a take-home flyer, enter it below.
          </p>
          <CodeEntryRedirect />
        </div>

        <p className="text-center text-xs text-[#6B7280]">
          Shift for Schools by Green Streets Initiative &middot; gogreenstreets.org
        </p>
      </div>
    </main>
  )
}

// Client component for code entry + redirect
function CodeEntryRedirect() {
  return <CodeInput />
}

// Needs 'use client' — extract to inline
// Using a form with action to keep it simple (no JS required)
function CodeInput() {
  return (
    <form
      action="/shift/schools/redirect"
      method="GET"
      className="mt-4 flex items-center justify-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const code = (form.elements.namedItem('code') as HTMLInputElement)?.value?.trim()
        if (code) {
          window.location.href = `/shift/schools/${code.toUpperCase()}`
        }
      }}
    >
      <input
        name="code"
        type="text"
        placeholder="e.g., RODRI3"
        maxLength={8}
        className="w-36 rounded-lg border-2 border-white/20 bg-white/10 px-4 py-2.5 text-center font-display text-lg font-extrabold tracking-wider text-white uppercase placeholder:text-white/30 focus:border-[#BAF14D] focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-[#2966E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90"
      >
        Go
      </button>
    </form>
  )
}
