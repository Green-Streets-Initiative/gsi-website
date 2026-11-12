/*
 * Free road lessons (Shift 01465, matching 01750). Forwards to Shift's
 * free-lessons function, one action at a time and only the fields each one
 * takes:
 *   match          who reaches this ZIP or town (the week grid on /bike-lessons)
 *   claim          the request: the function picks the code and asks one instructor
 *   offer_get / offer_answer   the instructor's Yes / Can't page (/bike-lessons/offer/[token])
 *   teacher_get / teacher_save the instructor's usual hours (/bike-lessons/teach/[token])
 */
const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/free-lessons`

const FIELDS: Record<string, string[]> = {
  match: ['place'],
  claim: ['name', 'email', 'phone', 'place', 'cells', 'teacher', 'availability', 'note', 'website'],
  offer_get: ['token'],
  offer_answer: ['token', 'answer'],
  teacher_get: ['token'],
  teacher_save: ['token', 'hours', 'calls_first', 'paused'],
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }
  // The form from before matching sends no action: it was a claim.
  const action = typeof body.action === 'string' ? body.action : 'claim'
  const fields = FIELDS[action]
  if (!fields) return Response.json({ error: 'invalid' }, { status: 400 })
  const out: Record<string, unknown> = { action }
  for (const f of fields) if (f in body) out[f] = body[f]
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
