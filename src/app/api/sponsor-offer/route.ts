import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { createHmac } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY!)

const IP_RATE_LIMIT_MAX = 50
const IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const ipRateLimitMap = new Map<string, number[]>()

const EMAIL_RATE_LIMIT_MAX = 10
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface OfferLeadBody {
  slug: string
  firstName: string
  lastName: string
  email: string
}

interface OfferRow {
  id: string
  discount_code: string
  notification_method: 'email' | 'webhook'
  contact_email: string | null
  webhook_url: string | null
  offer_headline: string
  sponsors: { name: string } | null
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function isIpRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (ipRateLimitMap.get(ip) ?? []).filter(
    (ts) => now - ts < IP_RATE_LIMIT_WINDOW_MS,
  )
  if (timestamps.length >= IP_RATE_LIMIT_MAX) {
    ipRateLimitMap.set(ip, timestamps)
    return true
  }
  timestamps.push(now)
  ipRateLimitMap.set(ip, timestamps)
  return false
}

async function isEmailRateLimited(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  email: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('sponsor_offer_leads')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('captured_at', since)

  if (error) {
    console.error('[sponsor-offer] email rate-limit query failed:', error)
    return false
  }
  return (count ?? 0) >= EMAIL_RATE_LIMIT_MAX
}

function buildLeadEmailHtml(
  body: OfferLeadBody,
  offer: OfferRow,
): string {
  return [
    `<p>A new lead came in for your <strong>${offer.offer_headline}</strong> offer on Shift Your Summer.</p>`,
    `<p><strong>Name:</strong> ${body.firstName} ${body.lastName}</p>`,
    `<p><strong>Email:</strong> ${body.email}</p>`,
    `<hr/>`,
    `<p style="color:#888;font-size:12px">Captured via gogreenstreets.org/offers/${body.slug}<br/>${new Date().toISOString()}</p>`,
  ].join('\n')
}

async function forwardViaEmail(
  body: OfferLeadBody,
  offer: OfferRow,
): Promise<string | null> {
  if (!offer.contact_email) return 'contact_email missing on offer record'
  try {
    const sponsorName = offer.sponsors?.name ?? 'Shift'
    await resend.emails.send({
      from: 'Shift Offers <noreply@gogreenstreets.org>',
      to: offer.contact_email,
      subject: `New lead from Shift Your Summer — ${offer.offer_headline}`,
      replyTo: body.email,
      html: buildLeadEmailHtml(body, offer),
      // Tag for sponsor-side filtering
      headers: { 'X-Shift-Sponsor': sponsorName },
    })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

async function forwardViaWebhook(
  body: OfferLeadBody,
  offer: OfferRow,
): Promise<string | null> {
  if (!offer.webhook_url) return 'webhook_url missing on offer record'
  const secret = process.env.SPONSOR_WEBHOOK_SECRET
  if (!secret) return 'SPONSOR_WEBHOOK_SECRET env var not set'

  const payload = JSON.stringify({
    offer_id: offer.id,
    slug: body.slug,
    first_name: body.firstName,
    last_name: body.lastName,
    email: body.email,
    captured_at: new Date().toISOString(),
  })
  const signature = createHmac('sha256', secret).update(payload).digest('hex')

  try {
    const res = await fetch(offer.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shift-Signature': signature,
      },
      body: payload,
    })
    if (!res.ok) return `webhook returned ${res.status}`
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

export async function POST(req: Request) {
  let body: OfferLeadBody
  try {
    body = (await req.json()) as OfferLeadBody
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const slug = body.slug?.trim()
  const firstName = body.firstName?.trim()
  const lastName = body.lastName?.trim()
  const email = body.email?.trim().toLowerCase()

  if (!slug || !firstName || !lastName || !email) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!EMAIL_REGEX.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const ip = clientIp(req)
  if (isIpRateLimited(ip)) {
    return Response.json(
      { error: 'Too many submissions from your network. Please try again in an hour.' },
      { status: 429 },
    )
  }

  const supabase = createServerSupabaseClient()

  if (await isEmailRateLimited(supabase, email)) {
    return Response.json(
      { error: 'You’ve already requested this offer several times today. Please try again tomorrow.' },
      { status: 429 },
    )
  }

  const { data: offer, error: offerError } = await supabase
    .from('sponsor_offers')
    .select(
      'id, discount_code, notification_method, contact_email, webhook_url, offer_headline, sponsors!inner(name)',
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (offerError || !offer) {
    return Response.json({ error: 'Offer not found' }, { status: 404 })
  }

  const sponsor = Array.isArray(offer.sponsors) ? offer.sponsors[0] : offer.sponsors
  const normalizedOffer: OfferRow = { ...offer, sponsors: sponsor ?? null } as OfferRow

  const { data: lead, error: insertError } = await supabase
    .from('sponsor_offer_leads')
    .insert({
      offer_id: normalizedOffer.id,
      first_name: firstName,
      last_name: lastName,
      email,
      ip_address: ip === 'unknown' ? null : ip,
    })
    .select('id')
    .single()

  if (insertError || !lead) {
    console.error('[sponsor-offer] lead insert failed:', insertError)
    return Response.json({ error: 'Could not record your submission' }, { status: 500 })
  }

  // Forward to sponsor. Failures are recorded but the user still gets the
  // code — we have their lead, we'll retry forwarding out-of-band.
  const forwardError =
    normalizedOffer.notification_method === 'email'
      ? await forwardViaEmail({ slug, firstName, lastName, email }, normalizedOffer)
      : await forwardViaWebhook({ slug, firstName, lastName, email }, normalizedOffer)

  await supabase
    .from('sponsor_offer_leads')
    .update(
      forwardError
        ? { forward_error: forwardError }
        : { forwarded_at: new Date().toISOString() },
    )
    .eq('id', lead.id)

  if (forwardError) {
    console.error('[sponsor-offer] forwarding failed:', forwardError)
  }

  return Response.json({ success: true, code: normalizedOffer.discount_code })
}
