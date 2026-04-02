import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import TrainingPortalClient from './client'

interface TrackData {
  id: string
  trackNumber: number
  title: string
  description: string | null
  recertificationMonths: number | null
  prerequisiteTrackId: string | null
  guidePdfStoragePath: string | null
}

interface ModuleData {
  id: string
  moduleNumber: number
  title: string
  contentMarkdown: string | null
  screenshots: { url: string; caption: string }[]
  videoStoragePath: string | null
  videoDurationSeconds: number | null
  quizRequired: boolean
  sequenceOrder: number
}

interface QuestionData {
  id: string
  questionText: string
  options: { id: string; text: string }[]
  correctOptionId: string
  explanation: string | null
  sequenceOrder: number
}

interface ModuleCompletion {
  moduleId: string
  completedAt: string | null
  quizPassed: boolean | null
  quizScore: number | null
}

export interface TrainingPortalProps {
  assignmentId: string
  token: string
  volunteerId: string
  volunteerName: string
  schoolName: string
  track: TrackData
  modules: (ModuleData & { questions: QuestionData[]; completion: ModuleCompletion | null })[]
  prerequisiteMet: boolean
  backgroundCheckStatus: string
  coriRequired: boolean
}

async function getTrainingData(token: string) {
  const supabase = createServerSupabaseClient()

  // 1. Validate token
  const { data: assignment } = await supabase
    .from('training_assignments')
    .select(`
      id, volunteer_id, track_id, token, token_expires_at, assigned_at,
      training_tracks!inner (
        id, track_number, title, description,
        recertification_months, prerequisite_track_id,
        guide_pdf_storage_path
      )
    `)
    .eq('token', token)
    .single()

  if (!assignment) return null

  // Check token expiry
  const now = new Date()
  const expires = new Date(assignment.token_expires_at)
  if (expires < now) return { expired: true }

  const track = assignment.training_tracks as any

  // 2. Check if already certified for this track
  const { data: existingCert } = await supabase
    .from('volunteer_track_completions')
    .select('certified_at')
    .eq('volunteer_id', assignment.volunteer_id)
    .eq('track_id', assignment.track_id)
    .single()

  if (existingCert?.certified_at) {
    const expiresAt = track.recertification_months
      ? new Date(new Date(existingCert.certified_at).getTime() + track.recertification_months * 30.44 * 24 * 60 * 60 * 1000)
      : null
    if (!expiresAt || expiresAt > now) {
      return { alreadyCertified: true, trackTitle: track.title }
    }
    // Certification expired — allow re-taking
  }

  // 3. Check prerequisite track
  let prerequisiteMet = true
  if (track.prerequisite_track_id) {
    const { data: prereqCert } = await supabase
      .from('volunteer_track_completions')
      .select('certified_at, certification_expires_at')
      .eq('volunteer_id', assignment.volunteer_id)
      .eq('track_id', track.prerequisite_track_id)
      .single()

    if (!prereqCert?.certified_at) {
      prerequisiteMet = false
    } else if (prereqCert.certification_expires_at) {
      const prereqExpires = new Date(prereqCert.certification_expires_at)
      if (prereqExpires < now) prerequisiteMet = false
    }
  }

  // 4. Get volunteer info for display
  const { data: volunteer } = await supabase
    .from('volunteer_profiles')
    .select('display_name, role, school_id, background_check_status, schools!inner(name)')
    .eq('id', assignment.volunteer_id)
    .single()

  // 5. Get modules for this track
  const { data: modules } = await supabase
    .from('training_modules')
    .select('id, module_number, title, content_markdown, screenshots, video_storage_path, video_duration_seconds, quiz_required, sequence_order')
    .eq('track_id', assignment.track_id)
    .order('sequence_order', { ascending: true })

  // 6. Get questions for all modules
  const moduleIds = (modules ?? []).map((m: any) => m.id)
  const { data: questions } = await supabase
    .from('training_questions')
    .select('id, module_id, question_text, options, correct_option_id, explanation, sequence_order')
    .in('module_id', moduleIds.length > 0 ? moduleIds : ['__none__'])
    .order('sequence_order', { ascending: true })

  // 7. Get existing completions for this volunteer
  const { data: completions } = await supabase
    .from('volunteer_module_completions')
    .select('module_id, completed_at, quiz_passed, quiz_score')
    .eq('volunteer_id', assignment.volunteer_id)
    .in('module_id', moduleIds.length > 0 ? moduleIds : ['__none__'])

  // Build module data with questions and completions
  const completionMap = new Map((completions ?? []).map((c: any) => [c.module_id, c]))
  const questionMap = new Map<string, any[]>()
  for (const q of questions ?? []) {
    const list = questionMap.get((q as any).module_id) ?? []
    list.push(q)
    questionMap.set((q as any).module_id, list)
  }

  const school = (volunteer as any)?.schools
  const volunteerName = (volunteer as any)?.display_name ?? 'Volunteer'
  const schoolName = school?.name ?? 'your school'

  return {
    assignmentId: assignment.id,
    token: assignment.token,
    volunteerId: assignment.volunteer_id,
    volunteerName,
    schoolName,
    track: {
      id: track.id,
      trackNumber: track.track_number,
      title: track.title,
      description: track.description,
      recertificationMonths: track.recertification_months,
      prerequisiteTrackId: track.prerequisite_track_id,
      guidePdfStoragePath: track.guide_pdf_storage_path,
    },
    modules: await Promise.all((modules ?? []).map(async (m: any) => {
      // Generate public URLs for screenshots
      const rawScreenshots = (m.screenshots ?? []) as { storage_path: string; caption: string; sort_order: number }[]
      const screenshotUrls = rawScreenshots
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((s) => ({
          url: supabase.storage.from('training-screenshots').getPublicUrl(s.storage_path).data.publicUrl,
          caption: s.caption,
        }))

      return {
        id: m.id,
        moduleNumber: m.module_number,
        title: m.title,
        contentMarkdown: m.content_markdown,
        screenshots: screenshotUrls,
        videoStoragePath: m.video_storage_path,
        videoDurationSeconds: m.video_duration_seconds,
        quizRequired: m.quiz_required,
        sequenceOrder: m.sequence_order,
      questions: (questionMap.get(m.id) ?? []).map((q: any) => ({
        id: q.id,
        questionText: q.question_text,
        options: q.options,
        correctOptionId: q.correct_option_id,
        explanation: q.explanation,
        sequenceOrder: q.sequence_order,
      })),
      completion: completionMap.has(m.id)
        ? {
            moduleId: m.id,
            completedAt: completionMap.get(m.id).completed_at,
            quizPassed: completionMap.get(m.id).quiz_passed,
            quizScore: completionMap.get(m.id).quiz_score,
          }
        : null,
      }
    })),
    prerequisiteMet,
    backgroundCheckStatus: (volunteer as any)?.background_check_status ?? 'not_required',
    coriRequired: ['parent_volunteer', 'route_volunteer'].includes((volunteer as any)?.role ?? ''),
  } satisfies TrainingPortalProps
}

export default async function TrainingPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getTrainingData(token)

  if (!data) return notFound()

  if ('expired' in data) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-[#191A2E]">Link Expired</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            This training link has expired. Please contact your Green Streets coordinator for a new link.
          </p>
        </div>
      </main>
    )
  }

  if ('alreadyCertified' in data) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-[#191A2E]">Already Certified</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            You&apos;ve already completed the {data.trackTitle}. No further action needed!
          </p>
        </div>
      </main>
    )
  }

  return <TrainingPortalClient {...data} />
}
