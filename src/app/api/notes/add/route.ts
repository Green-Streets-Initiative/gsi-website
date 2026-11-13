import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripJpegMetadata } from '@/lib/photo/strip-jpeg'
import { forwardRouteIssue, routeIssueConfigured, routeIssueStatus, siteVersion } from '@/lib/server/route-issue'

/**
 * "Add a note" (route notes, Shift 01763): the website's server half. Takes
 * one note from the sheet (components/notes/NoteSheet.tsx), keeps its photo
 * in the private spot-photos bucket under web/ (the photo check makes the
 * public, blurred copy), and forwards the note to Shift's
 * report-route-issue, which checks every field, rate-limits per visitor,
 * saves it to route_feedback and answers { ok, id, street, town }.
 *
 * Body: multipart/form-data with `note` (JSON: surface, kinds, note,
 * heading, both_ways, osm, segment) and an optional `photo` (a JPEG the
 * sheet already resized and re-encoded, which drops the camera's EXIF).
 * Built like /api/spot/report.
 */

const MAX_NOTE_BYTES = 4096
/** The sheet sends at most 1.5 MB; a little room for rounding. */
const MAX_PHOTO_BYTES = 1_572_864
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + MAX_NOTE_BYTES + 4096

/** Where the website lets people add notes (report-route-issue's SURFACES). */
const SURFACES = new Set(['advisor_bike', 'nearby_reach', 'nearby_corridor', 'web_street', 'web_roam'])
const BUCKET = 'spot-photos'

export async function POST(req: NextRequest) {
  if (!routeIssueConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  const type = req.headers.get('content-type') ?? ''
  if (!type.includes('multipart/form-data')) return NextResponse.json({ error: 'bad_body' }, { status: 415 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 })
  }

  const raw = form.get('note')
  if (typeof raw !== 'string' || raw.length > MAX_NOTE_BYTES) return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  let n: Record<string, unknown>
  try {
    n = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!n || typeof n !== 'object' || Array.isArray(n)) return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  if (typeof n.surface !== 'string' || !SURFACES.has(n.surface)) return NextResponse.json({ error: 'bad_surface' }, { status: 400 })

  // The photo: checked to be a JPEG of the right size, its metadata taken
  // out, then saved before the note so the note can point at it.
  let photo: Uint8Array | null = null
  const field = form.get('photo')
  if (field instanceof File && field.size > 0) {
    if (field.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'photo_too_large' }, { status: 413 })
    photo = stripJpegMetadata(new Uint8Array(await field.arrayBuffer()))
    if (!photo) return NextResponse.json({ error: 'bad_photo' }, { status: 400 })
  }

  const db = createServerSupabaseClient()
  let photoPath: string | null = null
  if (photo) {
    photoPath = `web/${crypto.randomUUID()}.jpg`
    const { error } = await db.storage.from(BUCKET).upload(photoPath, photo, { contentType: 'image/jpeg', upsert: false })
    if (error) {
      console.error('notes/add: photo upload failed', error.message)
      return NextResponse.json({ error: 'unavailable' }, { status: 502 })
    }
  }
  const dropPhoto = async () => {
    if (photoPath) await db.storage.from(BUCKET).remove([photoPath]).then(() => {}, () => {})
  }

  // Only the fields the function reads. A note is always a bike note here:
  // walking routes add theirs through Report a spot.
  const body = {
    surface: n.surface,
    note_mode: 'bike',
    kinds: n.kinds,
    note: n.note,
    heading: n.heading,
    both_ways: n.both_ways === true,
    osm: n.osm === true,
    segment: n.segment,
    photo_path: photoPath,
    app_version: siteVersion(),
  }

  try {
    const { status, data } = await forwardRouteIssue(req, body)
    if (status >= 200 && status < 300 && data.ok) {
      return NextResponse.json({
        ok: true,
        id: typeof data.id === 'string' ? data.id : null,
        street: typeof data.street === 'string' ? data.street : null,
        town: typeof data.town === 'string' ? data.town : null,
      })
    }
    // Not saved: the photo has nothing to belong to.
    await dropPhoto()
    const error = typeof data.error === 'string' ? data.error : 'unavailable'
    return NextResponse.json({ error }, { status: routeIssueStatus(status) })
  } catch (err) {
    // No answer (a timeout can still have saved it), so the photo stays.
    console.error('notes/add: function unreachable', err)
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
