import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import SchoolPortalClient from './client'

async function getSchoolInfo(code: string) {
  const supabase = createServerSupabaseClient()

  // Look up classroom by join code to find the school
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('id, class_name, school_id, grade, join_code, schools(id, name, city, grade_span)')
    .ilike('join_code', code)
    .limit(1)
    .single()

  if (!classroom) return null

  const school = classroom.schools as any

  // Get count of classrooms
  const { count } = await supabase
    .from('classrooms')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', classroom.school_id)

  return {
    schoolId: classroom.school_id,
    schoolName: school.name,
    city: school.city,
    gradeSpan: school.grade_span,
    classroomCount: count ?? 0,
    enteredCode: classroom.join_code,
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
