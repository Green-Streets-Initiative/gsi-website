import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const REQUIRED = ['title', 'eventType', 'description', 'date', 'startTime', 'venueName', 'city', 'contactEmail'] as const

const VALID_TAGS = [
  'free', 'paid', 'beginner_friendly', 'registration_required',
  'family_friendly', 'seniors', 'lgbtq', 'women',
  'spanish', 'bilingual',
]

// Mirrors FEED_TYPE_OPTIONS in SubmitEventForm. Stored as submitted rather than
// mapped onto event_sources.source_type: 'social' has no equivalent there, and
// an admin decides what kind of source a feed request becomes.
const VALID_FEED_TYPES = [
  'not_applicable', 'ical', 'google_calendar', 'website', 'social', 'other',
]

// Set well above what a real organizer needs — someone posting a season of
// group rides in one sitting is a user we want, not one to block. This is only
// a flood cap; the honeypot and content checks below do the real work.
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  )
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps)
    return true
  }
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return false
}

// Real people take longer than this to fill in an event form. Bots post instantly.
const MIN_FILL_MS = 3000

// How far ahead an event can reasonably be scheduled.
const MAX_DAYS_AHEAD = 730

// Shown when a submission trips a spam check. Deliberately gives a real person
// a way through, since no heuristic is perfect.
const TRY_AGAIN_MESSAGE =
  "We couldn't process this submission. If you're a person, email info@gogreenstreets.org and we'll add your event by hand."

/**
 * Scores a single free-text field for "random token" junk — the signature of
 * the link-spam bots that hit this form. Real venue and organizer names are
 * either short, multi-word, or ordinary English; generated tokens like
 * "GOBwbQeLVWhuhAXwBqtW" are long, single-word, vowel-starved, and switch
 * case at random. Short and multi-word values are always given a pass, so
 * legitimate names ("MassBike", "Somerville Bike Co-op") never trip this.
 */
function looksLikeRandomToken(value: string): boolean {
  const v = value.trim()
  if (v.length < 12) return false
  if (/\s/.test(v)) return false

  const letters = v.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 12) return false

  const vowels = (letters.match(/[aeiouyAEIOUY]/g) ?? []).length
  if (vowels / letters.length < 0.32) return true

  // CamelCase words concatenate a few times; random tokens flip case constantly.
  const caseSwitches = (letters.match(/[a-z][A-Z]/g) ?? []).length
  return caseSwitches >= 4
}

function spamScore(body: Record<string, unknown>): number {
  const fields = ['title', 'description', 'venueName', 'organizerName', 'city', 'address']
  return fields.reduce((score, field) => {
    const v = body[field]
    return typeof v === 'string' && looksLikeRandomToken(v) ? score + 1 : score
  }, 0)
}

export async function POST(request: Request) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  if (isRateLimited(clientIp)) {
    return Response.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot — hidden from real users, bots fill it in. Accept silently so the
  // bot has no signal to retry against.
  if (body.website) {
    return Response.json({ ok: true, id: null })
  }

  // Bots post the instant they parse the form. This field is stamped when the
  // form mounts; our form is the only caller, so a missing value is a bot too.
  // Unlike the honeypot this answers with an error rather than a silent accept:
  // a false positive here must never swallow a real person's event.
  const loadedAt = Number(body.formLoadedAt)
  if (!Number.isFinite(loadedAt) || loadedAt <= 0 || Date.now() - loadedAt < MIN_FILL_MS) {
    return Response.json({ error: TRY_AGAIN_MESSAGE }, { status: 400 })
  }

  for (const field of REQUIRED) {
    if (!body[field]?.trim()) {
      return Response.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.contactEmail)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  // Date sanity — the 1970 dates spam submits, and genuine typos, both land here.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return Response.json({ error: 'Please enter a valid date.' }, { status: 400 })
  }
  const eventDate = new Date(`${body.date}T12:00:00`)
  if (Number.isNaN(eventDate.getTime())) {
    return Response.json({ error: 'Please enter a valid date.' }, { status: 400 })
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)
  if (eventDate < today) {
    return Response.json({ error: 'That date has already passed. Pick an upcoming date.' }, { status: 400 })
  }
  if (eventDate > maxDate) {
    return Response.json({ error: 'That date is too far in the future. Pick a date within the next two years.' }, { status: 400 })
  }

  // Two or more junk-looking fields is well past coincidence.
  if (spamScore(body) >= 2) {
    return Response.json({ error: TRY_AGAIN_MESSAGE }, { status: 400 })
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
    distance_text: body.length?.trim() || null,
    tags,
  })

  if (edError) {
    console.error('event_details insert error:', edError)
    await supabase.from('content_items').delete().eq('id', contentId)
    return Response.json({ error: 'Failed to save event details. Please try again.' }, { status: 500 })
  }

  // Submitter contact details and any feed request go in the admin-only table.
  // They must not land on event_details, which anyone can read with the anon key.
  const feedType = VALID_FEED_TYPES.includes(body.feedType) ? body.feedType : null
  const feedUrl = body.feedUrl?.trim() || null
  const wantsFeed = feedType !== null && feedType !== 'not_applicable' && feedUrl !== null

  const { error: esError } = await supabase.from('event_submissions').insert({
    content_id: contentId,
    submitter_email: body.contactEmail.trim(),
    submitter_name: body.contactName?.trim() || null,
    submitter_phone: body.contactPhone?.trim() || null,
    feed_type: wantsFeed ? feedType : null,
    feed_url: wantsFeed ? feedUrl : null,
  })

  if (esError) {
    // Without the contact details we could never tell this person their event
    // went live, and the success screen promises exactly that. Roll back and
    // let them retry rather than accept a submission we can't follow up on.
    console.error('event_submissions insert error:', esError)
    await supabase.from('event_details').delete().eq('content_id', contentId)
    await supabase.from('content_items').delete().eq('id', contentId)
    return Response.json({ error: 'Failed to save your contact details. Please try again.' }, { status: 500 })
  }

  try {
    await resend.emails.send({
      from: 'Shift Events <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New event submitted: ${body.title.trim()}`,
      html: buildAdminNotificationHtml({
        title: body.title.trim(),
        date: body.date,
        city: body.city.trim(),
        eventType: body.eventType,
        organizer: body.organizerName?.trim(),
        contactName: body.contactName?.trim(),
        contactEmail: body.contactEmail.trim(),
        id: contentId,
      }),
    })
  } catch (emailError) {
    console.error('Admin notification email error:', emailError)
  }

  return Response.json({ ok: true, id: contentId })
}

function buildAdminNotificationHtml(ev: {
  title: string; date: string; city: string; eventType: string;
  organizer?: string; contactName?: string; contactEmail: string; id: string;
}) {
  const typeLabel = ev.eventType.replace(/_/g, ' ')
  const d = new Date(ev.date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a2e;">
  <div style="background: #191A2E; padding: 24px 28px; border-radius: 12px 12px 0 0;">
    <img src="https://gogreenstreets.org/shift-wordmark-white.svg" alt="Shift" width="72" style="display: block;" />
  </div>
  <div style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="margin: 0 0 4px; font-size: 18px; color: #1a1a2e;">New event submitted</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Review and approve it in the admin dashboard.</p>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #6b7280; width: 100px;">Title</td><td style="padding: 6px 0; font-weight: 600;">${ev.title}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Date</td><td style="padding: 6px 0;">${dateStr}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Location</td><td style="padding: 6px 0;">${ev.city}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Type</td><td style="padding: 6px 0; text-transform: capitalize;">${typeLabel}</td></tr>
      ${ev.organizer ? `<tr><td style="padding: 6px 0; color: #6b7280;">Organizer</td><td style="padding: 6px 0;">${ev.organizer}</td></tr>` : ''}
      <tr><td style="padding: 6px 0; color: #6b7280;">Submitted by</td><td style="padding: 6px 0;">${ev.contactName ? `${ev.contactName} &lt;${ev.contactEmail}&gt;` : ev.contactEmail}</td></tr>
    </table>
    <div style="margin-top: 24px;">
      <a href="https://admin.gogreenstreets.org/admin/community-events" style="display: inline-block; background: #4A82F0; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Open triage queue</a>
    </div>
  </div>
</div>`
}
