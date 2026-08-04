import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Calendar file for a published civic item (meeting/hearing) — the
 * "Apple / Outlook" half of the town digest's add-to-calendar line
 * (Google Calendar uses a template URL and needs no endpoint).
 *
 * Mirrors lib/events.ts buildIcs: floating local times, no TZID — every
 * recipient is local to the meeting. Published items only; the row's
 * public fields are already world-readable via the app's anon queries.
 */

function icsEscape(text: string): string {
  return String(text).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

function icsStamp(date: string, time: string | null): string {
  return date.replace(/-/g, '') + 'T' + (time ?? '18:00').replace(/:/g, '').slice(0, 4) + '00'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 })

  const sb = createServerSupabaseClient()
  const { data } = await sb
    .from('infrastructure_hearings')
    .select('id, title, description, digest_headline, community_name, hearing_date, hearing_time, hearing_end_time, hearing_location_name, hearing_location_address, source_url, lat, lng')
    .eq('id', id)
    .eq('status', 'published')
    .single()
  if (!data || !data.hearing_date) return new Response('Not found', { status: 404 })

  // Same display-name logic as the digest: checker headline first, then the
  // official title, community name leading when it isn't already there.
  let summary: string = data.digest_headline?.trim() || data.title
  const name = data.community_name?.trim()
  if (name && !summary.toLowerCase().includes(name.toLowerCase())) summary = `${name}: ${summary}`

  const location = [data.hearing_location_name, data.hearing_location_address].filter(Boolean).join(', ')
  const desc = [data.description, data.source_url, 'via Green Streets Initiative'].filter(Boolean).join('\n\n')
  const allDay = !data.hearing_time

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Streets Initiative//Civic//EN',
    'BEGIN:VEVENT',
    `UID:civic-${data.id}@gogreenstreets.org`,
    ...(allDay
      ? [`DTSTART;VALUE=DATE:${data.hearing_date.replace(/-/g, '')}`]
      : [
        `DTSTART:${icsStamp(data.hearing_date, data.hearing_time)}`,
        `DTEND:${icsStamp(data.hearing_date, data.hearing_end_time ?? data.hearing_time)}`,
      ]),
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    ...(data.lat != null && data.lng != null ? [`GEO:${data.lat};${data.lng}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar;charset=utf-8',
      'Content-Disposition': `attachment; filename="${summary.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().slice(0, 60) || 'meeting'}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
