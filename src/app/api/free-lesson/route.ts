/*
 * The /bike-lessons free lesson request (Shift 01465, Keith 2026-10-27, 10-28).
 * Forwards to Shift's free-lessons function, which finds the ZIP or town,
 * gives out a code from the free road lesson program, sends the request to
 * the instructors and emails the learner their code. It answers "sent"
 * whether the code is new or one this address already has.
 */
const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/free-lessons`

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'claim',
        name: body.name,
        email: body.email,
        place: body.place,
        availability: body.availability,
        note: body.note,
        website: body.website,
      }),
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
