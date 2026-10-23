import { NextRequest, NextResponse } from 'next/server'

/**
 * "Report a problem with this route" (Shift product item 15): forwards one
 * report to Shift's report-route-issue function, which checks every field,
 * rate-limits per visitor and saves it to route_feedback.
 *
 * The service-role key and the visitor's IP stay on this server; the
 * browser only ever talks to this route. Nearby will post here too.
 */

const MAX_BODY_BYTES = 4096

function clientIp(req: NextRequest): string {
  return (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
}

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  // Only the fields the function reads, and the site version from here, not the browser.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  const forward = {
    surface: body.surface,
    kinds: body.kinds,
    note: body.note,
    email: body.email,
    route_hash: body.route_hash,
    segment: body.segment,
    sources: body.sources,
    employer_slug: body.employer_slug,
    app_version: sha ? `web-${sha.slice(0, 7)}` : 'web',
  }

  const ip = clientIp(req)
  try {
    const res = await fetch(`${base}/functions/v1/report-route-issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'x-advisor-key': key,
        ...(ip ? { 'x-advisor-client-ip': ip } : {}),
      },
      body: JSON.stringify(forward),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) return NextResponse.json({ ok: true })
    const error = typeof data?.error === 'string' ? data.error : 'unavailable'
    return NextResponse.json({ error }, { status: res.status === 429 || res.status === 400 ? res.status : 502 })
  } catch (err) {
    console.error('report-route: function unreachable', err)
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
