import { NextRequest, NextResponse } from 'next/server'
import { forwardRouteIssue, routeIssueConfigured, routeIssueStatus } from '@/lib/server/route-issue'

/**
 * "Still true", "Not anymore" and "Report this note" (route notes, Shift
 * 01763) from the website: forwarded to report-route-issue as
 * { vote: { note_id, answer } }, which keeps one answer of each kind per
 * visitor per note per week and answers the note's group as it now stands.
 * Body: application/json { note_id, answer }. Answers { ok, note }.
 */

const MAX_BODY_BYTES = 512
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ANSWERS = new Set(['still', 'gone', 'report'])

export async function POST(req: NextRequest) {
  if (!routeIssueConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  const noteId = body && typeof body.note_id === 'string' && UUID.test(body.note_id) ? body.note_id : null
  const answer = body && typeof body.answer === 'string' && ANSWERS.has(body.answer) ? body.answer : null
  if (!noteId || !answer) return NextResponse.json({ error: 'bad_vote' }, { status: 400 })

  try {
    const { status, data } = await forwardRouteIssue(req, { vote: { note_id: noteId, answer } })
    if (status >= 200 && status < 300 && data.ok) return NextResponse.json({ ok: true, note: data.note ?? null })
    const error = typeof data.error === 'string' ? data.error : 'unavailable'
    return NextResponse.json({ error }, { status: routeIssueStatus(status) })
  } catch (err) {
    console.error('notes/vote: function unreachable', err)
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
