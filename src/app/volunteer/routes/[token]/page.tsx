import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import VolunteerAssessmentClient from './client'

async function getAssignmentData(token: string) {
  const supabase = createServerSupabaseClient()

  // Validate token
  const { data: assignment } = await supabase
    .from('corridor_assignments')
    .select(`
      id, corridor_id, volunteer_id, token, token_expires_at,
      assigned_at, submitted_at,
      route_corridors!inner (
        id, name, distance_miles, estimated_walk_minutes, estimated_bike_minutes,
        waypoints, ai_flags, start_lat, start_lng, end_lat, end_lng,
        assessment_id,
        route_assessments!inner (
          school_id,
          schools!inner (name, city)
        )
      )
    `)
    .eq('token', token)
    .single()

  if (!assignment) return null

  // Check token validity
  const now = new Date()
  const expires = new Date(assignment.token_expires_at)
  if (expires < now) return { expired: true }
  if (assignment.submitted_at) return { alreadySubmitted: true }

  // Check Route Planning certification (Track 3) — gate access
  const { data: routeTrack } = await supabase
    .from('training_tracks')
    .select('id')
    .eq('track_number', 3)
    .single()

  if (routeTrack) {
    const { data: cert } = await supabase
      .from('volunteer_track_completions')
      .select('certified_at, certification_expires_at')
      .eq('volunteer_id', assignment.volunteer_id)
      .eq('track_id', routeTrack.id)
      .single()

    const isCertified = cert?.certified_at && (
      !cert.certification_expires_at || new Date(cert.certification_expires_at) > now
    )

    if (!isCertified) {
      // Check if they have a training assignment with a portal link
      const { data: trainingAssignment } = await supabase
        .from('training_assignments')
        .select('token')
        .eq('volunteer_id', assignment.volunteer_id)
        .eq('track_id', routeTrack.id)
        .single()

      return {
        needsTraining: true,
        trainingToken: trainingAssignment?.token ?? null,
      }
    }
  }

  const corridor = assignment.route_corridors as any
  const school = corridor.route_assessments?.schools

  // Get all corridors assigned to this volunteer for this assessment
  const { data: allAssignments } = await supabase
    .from('corridor_assignments')
    .select(`
      id, corridor_id, token, submitted_at,
      route_corridors!inner (id, name, distance_miles)
    `)
    .eq('volunteer_id', assignment.volunteer_id)
    .is('submitted_at', null)

  // Filter to same assessment
  const siblingAssignments = (allAssignments ?? []).filter((a: any) =>
    a.route_corridors?.id && !a.submitted_at
  )

  // Build Google Maps deep links from waypoints
  const waypoints = corridor.waypoints as { lat: number; lng: number }[] ?? []
  const start = waypoints[0]
  const end = waypoints[waypoints.length - 1]
  const midpoints = waypoints.slice(1, -1)

  let walkUrl = ''
  let bikeUrl = ''
  if (start && end) {
    const origin = `${start.lat},${start.lng}`
    const destination = `${end.lat},${end.lng}`
    const wp = midpoints.map((p) => `${p.lat},${p.lng}`).join('|')
    walkUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp ? `&waypoints=${wp}` : ''}&travelmode=walking`
    bikeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp ? `&waypoints=${wp}` : ''}&travelmode=bicycling`
  }

  // Neutrally worded AI flags (no scores revealed)
  const pointsOfInterest = (corridor.ai_flags ?? []).map((f: any) => ({
    description: typeof f === 'string' ? f : f.description ?? 'Area of interest',
  }))

  return {
    assignmentId: assignment.id,
    token: assignment.token,
    corridorId: corridor.id,
    corridorName: corridor.name,
    distanceMiles: corridor.distance_miles,
    walkMinutes: corridor.estimated_walk_minutes,
    bikeMinutes: corridor.estimated_bike_minutes,
    schoolName: school?.name ?? 'School',
    schoolCity: school?.city ?? '',
    walkUrl,
    bikeUrl,
    pointsOfInterest,
    siblingCorridors: siblingAssignments.map((a: any) => ({
      assignmentId: a.id,
      token: a.token,
      corridorName: a.route_corridors?.name ?? 'Corridor',
      isCurrent: a.corridor_id === corridor.id,
    })),
  }
}

export default async function VolunteerAssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getAssignmentData(token)

  if (!data) return notFound()

  if ('expired' in data) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-[#191A2E]">Link Expired</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            This assessment link has expired. Please contact your Green Streets coordinator for a new link.
          </p>
        </div>
      </main>
    )
  }

  if ('needsTraining' in data) {
    const trainingUrl = data.trainingToken
      ? `/volunteer/training/${data.trainingToken}`
      : null
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">📋</span>
          </div>
          <h1 className="text-xl font-bold text-[#191A2E]">Training Required</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            You need to complete the Route Planning Certification before you can
            submit corridor assessments.
          </p>
          {trainingUrl ? (
            <a
              href={trainingUrl}
              className="mt-6 inline-block rounded-xl bg-[#2966E5] px-8 py-3 text-sm font-semibold text-white hover:bg-[#2966E5]/90 transition"
            >
              Start Training →
            </a>
          ) : (
            <p className="mt-4 text-sm text-[#6B7280]">
              Please contact your Green Streets coordinator to get your training link.
            </p>
          )}
        </div>
      </main>
    )
  }

  if ('alreadySubmitted' in data) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-[#191A2E]">Already Submitted</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            You've already submitted your assessment for this corridor. Thank you!
          </p>
        </div>
      </main>
    )
  }

  return <VolunteerAssessmentClient {...data} />
}
