import { createServerSupabaseClient } from '@/lib/supabase-server'

const REQUIRED = ['title', 'eventType', 'description', 'date', 'startTime', 'venueName', 'city', 'contactEmail'] as const

const VALID_TAGS = [
  'free', 'paid', 'beginner_friendly', 'registration_required',
  'family_friendly', 'seniors', 'lgbtq', 'women',
  'spanish', 'bilingual',
]

export async function POST(request: Request) {
  const body = await request.json()

  for (const field of REQUIRED) {
    if (!body[field]?.trim()) {
      return Response.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.contactEmail)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const slug = body.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const contentId = `ce_submit_${slug}_${body.date}`

  const { error: ciError } = await supabase.from('content_items').insert({
    id: contentId,
    content_type: 'community_event',
    title: body.title.trim(),
    body: body.description.trim(),
    summary: body.description.trim().slice(0, 200),
    primary_barrier: 'awareness',
    primary_mode: 'mixed',
    benefit_tags: [],
    surfaces: ['community_calendar'],
    status: 'draft',
  })

  if (ciError) {
    if (ciError.code === '23505') {
      return Response.json({ error: 'An event with this title and date already exists.' }, { status: 409 })
    }
    console.error('content_items insert error:', ciError)
    return Response.json({ error: 'Failed to save event. Please try again.' }, { status: 500 })
  }

  const lat = body.lat ? parseFloat(body.lat) : null
  const lng = body.lng ? parseFloat(body.lng) : null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t: string) => VALID_TAGS.includes(t)) : []

  const { error: edError } = await supabase.from('event_details').insert({
    content_id: contentId,
    event_date: body.date,
    event_time: body.startTime || null,
    event_end_time: body.endTime || null,
    location_name: body.venueName.trim(),
    location_address: body.address?.trim() || null,
    location_lat: lat,
    location_lng: lng,
    event_type: body.eventType,
    organizer_name: body.organizerName?.trim() || null,
    organizer_url: body.organizerUrl?.trim() || null,
    event_url: body.eventUrl?.trim() || null,
    registration_url: body.registrationUrl?.trim() || null,
    tags,
  })

  if (edError) {
    console.error('event_details insert error:', edError)
    await supabase.from('content_items').delete().eq('id', contentId)
    return Response.json({ error: 'Failed to save event details. Please try again.' }, { status: 500 })
  }

  return Response.json({ ok: true, id: contentId })
}
