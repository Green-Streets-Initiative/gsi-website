import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * "Report a spot" (version 1): the website's server half. Takes one report
 * from the sheet (components/spot/ReportSpotSheet.tsx), keeps its photo in
 * the private spot-photos bucket under web/, and forwards the report to
 * Shift's report-route-issue function the same way the route report does
 * (/api/commute/report-route): the service-role key and the visitor's IP
 * stay on this server, and the function checks every field, rate-limits
 * per visitor and saves it to route_feedback.
 *
 * Two bodies:
 *  - multipart/form-data: `report` (JSON: surface, kinds, note, segment)
 *    and an optional `photo` (a JPEG the sheet already resized and
 *    re-encoded, which drops the camera's EXIF). Answers the function's
 *    { ok, id, destination } for a spot, { ok } for "This map is wrong".
 *  - application/json { handoff: <id> }: the person opened the town's
 *    report page. Forwarded from here so the sender (the IP hash) matches.
 *
 * Shift never submits anything to the town.
 */

/** The report's own fields: a little text and a place, like the route report. */
const MAX_REPORT_BYTES = 4096
/** The sheet sends at most 1.5 MB; a little room for rounding. */
const MAX_PHOTO_BYTES = 1_572_864
/** The whole multipart body: the photo, the report and the form's own framing. */
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + MAX_REPORT_BYTES + 4096

const SURFACES = new Set(['web_map', 'school_routes'])
const BUCKET = 'spot-photos'

function clientIp(req: NextRequest): string {
  return (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
}

/**
 * The JPEG with its metadata segments taken out (EXIF and XMP live in APP1,
 * plus comments and the other application blocks), keeping JFIF (APP0), the
 * colour profile (APP2) and Adobe's colour flag (APP14) so it still looks
 * the same. The sheet's canvas re-encode already left none; this makes it
 * true for any sender. Null when the bytes aren't a well-formed JPEG.
 */
function stripJpegMetadata(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null
  const keep: Uint8Array[] = [b.subarray(0, 2)]
  let scan = false
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xff) { i++; continue } // fill byte
    // Start of scan: the picture itself, to the end.
    if (marker === 0xda) {
      keep.push(b.subarray(i))
      scan = true
      break
    }
    // Markers without a length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keep.push(b.subarray(i, i + 2))
      i += 2
      continue
    }
    const len = (b[i + 2] << 8) | b[i + 3]
    if (len < 2 || i + 2 + len > b.length) return null
    const isApp = marker >= 0xe0 && marker <= 0xef
    const dropped = (isApp && marker !== 0xe0 && marker !== 0xe2 && marker !== 0xee) || marker === 0xfe
    if (!dropped) keep.push(b.subarray(i, i + 2 + len))
    i += 2 + len
  }
  if (!scan) return null
  const out = new Uint8Array(keep.reduce((a, k) => a + k.length, 0))
  let o = 0
  for (const k of keep) { out.set(k, o); o += k.length }
  return out
}

async function forward(req: NextRequest, body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const ip = clientIp(req)
  const res = await fetch(`${base}/functions/v1/report-route-issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'x-advisor-key': key,
      ...(ip ? { 'x-advisor-client-ip': ip } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data: data && typeof data === 'object' ? data as Record<string, unknown> : {} }
}

function failure(status: number, data: Record<string, unknown>) {
  const error = typeof data.error === 'string' ? data.error : 'unavailable'
  return NextResponse.json({ error }, { status: status === 429 || status === 400 ? status : 502 })
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  const type = req.headers.get('content-type') ?? ''

  // ── The hand-off ────────────────────────────────────────────────────
  if (type.includes('application/json')) {
    const raw = await req.text()
    if (raw.length > MAX_REPORT_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'bad_json' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || typeof body.handoff !== 'string') {
      return NextResponse.json({ error: 'bad_handoff' }, { status: 400 })
    }
    try {
      const { status, data } = await forward(req, { handoff: body.handoff })
      return status >= 200 && status < 300 ? NextResponse.json({ ok: true }) : failure(status, data)
    } catch (err) {
      console.error('spot/report: handoff unreachable', err)
      return NextResponse.json({ error: 'unavailable' }, { status: 502 })
    }
  }

  // ── The report ──────────────────────────────────────────────────────
  if (!type.includes('multipart/form-data')) return NextResponse.json({ error: 'bad_body' }, { status: 415 })
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 })
  }

  const rawReport = form.get('report')
  if (typeof rawReport !== 'string' || rawReport.length > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  let report: Record<string, unknown>
  try {
    report = JSON.parse(rawReport)
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  // This route is only for spots; the route report has its own.
  if (typeof report.surface !== 'string' || !SURFACES.has(report.surface)) {
    return NextResponse.json({ error: 'bad_surface' }, { status: 400 })
  }

  // The photo: checked to be a JPEG of the right size, its metadata taken
  // out, then saved before the report so the report can point at it.
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
      console.error('spot/report: photo upload failed', error.message)
      return NextResponse.json({ error: 'unavailable' }, { status: 502 })
    }
  }
  const dropPhoto = async () => {
    if (photoPath) await db.storage.from(BUCKET).remove([photoPath]).then(() => {}, () => {})
  }

  // Only the fields the function reads, and the site version from here, not the browser.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  const body = {
    surface: report.surface,
    kinds: report.kinds,
    note: report.note,
    segment: report.segment,
    photo_path: photoPath,
    app_version: sha ? `web-${sha.slice(0, 7)}` : 'web',
  }

  try {
    const { status, data } = await forward(req, body)
    if (status >= 200 && status < 300 && data.ok) {
      return NextResponse.json({
        ok: true,
        ...(data.id !== undefined ? { id: data.id } : {}),
        ...(data.destination !== undefined ? { destination: data.destination } : {}),
      })
    }
    // Not saved: the photo has nothing to belong to.
    await dropPhoto()
    return failure(status, data)
  } catch (err) {
    // No answer (a timeout can still have saved it), so the photo stays.
    console.error('spot/report: function unreachable', err)
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
