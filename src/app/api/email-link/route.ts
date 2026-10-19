/*
 * The /email/confirm page's calls (Shift product item 19). A confirm or stop
 * link in an email opens that page, which asks for one tap before anything
 * changes (mail scanners open every link). "read" says what the link is for;
 * "act" does it. Only the link's id and signature are passed on.
 */
const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-subscriptions`

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }
  const action = body.action === 'act' ? 'link' : 'link-read'
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, a: body.a, id: body.id, s: body.s }),
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    return Response.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
