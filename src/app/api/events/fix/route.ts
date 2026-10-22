import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SITE_URL } from '@/lib/seo'
import { hostPath } from '@/lib/hosts'

/**
 * "Fix this listing": a correction or a removal request for an event or a
 * host page, from anyone, no account. Goes to GSI by email, where the
 * calendar's triage already happens (same path as /events/submit).
 */
const resend = new Resend(process.env.RESEND_API_KEY!)

const KINDS: Record<string, string> = {
  time: 'Wrong date or time',
  place: 'Wrong place',
  cancelled: 'Cancelled or not happening',
  details: 'Other details are wrong',
  remove: 'Please take our listings down',
  other: 'Something else',
}

// A flood cap per network; the honeypot does the real work.
const hits = new Map<string, number[]>()
function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 8
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as Record<string, string> | null
  if (!body) return Response.json({ error: 'Something went wrong. Try again.' }, { status: 400 })
  if (body.website) return Response.json({ ok: true })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (limited(ip)) return Response.json({ error: 'Too many tries. Give it a little while.' }, { status: 429 })

  const kind = KINDS[body.kind] ? body.kind : null
  const details = (body.details ?? '').trim().slice(0, 2000)
  const name = (body.name ?? '').trim().slice(0, 80)
  const email = (body.email ?? '').trim().slice(0, 200)
  if (!kind) return Response.json({ error: 'Pick what needs fixing.' }, { status: 400 })
  if (kind !== 'remove' && details.length < 3) return Response.json({ error: 'Tell us what to change.' }, { status: 400 })
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'Check the email address.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  let what = ''
  if (body.event && /^[0-9a-f-]{36}$/i.test(body.event)) {
    const { data } = await supabase.from('content_items').select('id, title, slug').eq('id', body.event).maybeSingle()
    if (data) what = `<p>Event: <a href="${SITE_URL}/events/${esc(String(data.slug ?? data.id))}">${esc(String(data.title))}</a></p>`
  }
  if (body.host && /^[a-z0-9_-]{1,120}$/i.test(body.host)) {
    const { data } = await supabase.from('event_organizers').select('id, name').eq('id', body.host).maybeSingle()
    if (data) what += `<p>Host: <a href="${SITE_URL}${hostPath(String(data.id))}">${esc(String(data.name))}</a> (${esc(String(data.id))})</p>`
  }
  if (!what) return Response.json({ error: 'We couldn’t find that listing.' }, { status: 404 })

  try {
    await resend.emails.send({
      from: 'Shift Events <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      ...(email ? { replyTo: email } : {}),
      subject: `Listing fix: ${KINDS[kind]}`,
      html: `<h2>${esc(KINDS[kind])}</h2>${what}` +
        (details ? `<p style="white-space:pre-wrap">${esc(details)}</p>` : '') +
        `<p>From: ${esc(name || 'no name')}${email ? ` &lt;${esc(email)}&gt;` : ' (no email given)'}</p>`,
    })
  } catch (err) {
    console.error('listing fix email error:', err)
    return Response.json({ error: 'Couldn’t send that. Try again in a minute.' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
