/*
 * "Manage your emails" (/email/manage, Shift product item 19). Reads and saves
 * a person's email subscriptions through Shift's email-subscriptions
 * function. The page is opened from a signed link in any email; the link's
 * id and signature are all this route passes on.
 */
const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-subscriptions`

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400 })
  }
  const action = body.action === 'save' ? 'manage-save' : 'manage-read'
  try {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id: body.id, s: body.s, on: body.on, all_off: body.all_off }),
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    return Response.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
