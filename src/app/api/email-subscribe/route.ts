/*
 * Email sign-ups from website forms (Shift product item 19: one email
 * subscription system). Forwards to Shift's email-subscriptions function,
 * which checks the topic's details (a town or ZIP for bike lesson alerts),
 * saves the subscription unconfirmed and sends the confirmation email. It
 * answers the same way whether or not the address is already signed up, and
 * limits how often it sends.
 */
const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-subscriptions`

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
        action: 'signup',
        topic: body.topic,
        email: body.email,
        place: body.place,
        filters: body.filters,
        town: body.town,
        locale: body.locale,
        website: body.website,
      }),
    })
    const data = await res.json().catch(() => ({ error: 'error' }))
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'error' }, { status: 502 })
  }
}
