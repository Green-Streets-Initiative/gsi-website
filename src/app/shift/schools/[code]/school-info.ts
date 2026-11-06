import 'server-only'
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// The school behind a portal code: a classroom join code, else the school's
// own join code. Shared by the family page and its admin preview.
export const getSchoolInfo = cache(async (code: string) => {
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
