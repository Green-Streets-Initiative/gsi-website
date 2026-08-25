import { cache } from 'react'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import SchoolPortalClient from './client'

const getSchoolInfo = cache(async (code: string) => {
  const supabase = createServerSupabaseClient()

  // Look up classroom by join code to find the school
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id, class_name, school_id, grade, join_code, schools(id, name, city, grade_span)')
    .ilike('join_code', code)
    .limit(1)
    .single()

  // Fall back to a school join code — the app's Safe Routes link and the
  // printed route-map PDFs use schools.join_code, not a classroom code.
  let schoolId: string
  let school: any
  let enteredCode: string | null = null

  if (classroom) {
    schoolId = classroom.school_id
    school = classroom.schools as any
    enteredCode = classroom.join_code
  } else {
    const { data: schoolRow } = await supabase
      .from('schools')
      .select('id, name, city, grade_span')
      .ilike('join_code', code)
      .limit(1)
      .single()

    if (!schoolRow) return null
    schoolId = schoolRow.id
    school = schoolRow
  }

  // Get count of classrooms
  const { count } = await supabase
    .from('classrooms')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  return {
    schoolId,
    schoolName: school.name as string,
    city: school.city as string,
    gradeSpan: school.grade_span as string,
    classroomCount: count ?? 0,
    enteredCode,
  }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  const info = await getSchoolInfo(code)
  if (!info) return { title: 'Shift for Schools' }

  const title = `${info.schoolName} — Shift for Schools`
  const description = `Classroom standings and safe walking and biking routes for ${info.schoolName} in ${info.city}.`
  return {
    title,
    description,
    // Portal URLs embed join codes — keep them out of search indexes.
    robots: { index: false },
    openGraph: {
      title,
      description,
      siteName: 'Green Streets Initiative',
      images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift for Schools by Green Streets Initiative' }],
      locale: 'en_US',
      type: 'website',
    },
  }
}

export default async function SchoolPortalPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const info = await getSchoolInfo(code)
  if (!info) return notFound()

  return <SchoolPortalClient {...info} />
}
