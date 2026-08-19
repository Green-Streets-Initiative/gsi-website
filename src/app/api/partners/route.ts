import { createServerSupabaseClient } from '@/lib/supabase-server'
import { slugify } from '@/lib/utm'
import { Resend } from 'resend'

/**
 * Self-service partner signup (/partners): org name + logo in, a pending
 * `partners` row + public logo out. The co-branded /nearby?partner=<slug>
 * link works the moment this returns — review happens after the fact in the
 * admin dashboard (pending → approved/rejected), so nobody waits on Keith.
 */

const resend = new Resend(process.env.RESEND_API_KEY!)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const MAX_NAME_LEN = 120
// Slugs must satisfy parsePartnerSlug (src/lib/nearby/partner.ts): ^[a-z0-9-]{1,60}$
const MAX_SLUG_LEN = 60

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  )
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps)
    return true
  }
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return false
}

// The bucket is public and anyone can post here, so the file's own bytes are
// the arbiter — extension and client MIME type are attacker-chosen. SVG is
// deliberately unsupported: script inside an SVG runs on direct navigation
// to the storage URL. Admins can still attach SVGs through the dashboard.
function sniffImage(bytes: Uint8Array): { ext: string; contentType: string } | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' }
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  return null
}

function partnerSlugBase(name: string): string {
  const base = slugify(name).slice(0, MAX_SLUG_LEN).replace(/-+$/, '')
  return base || 'partner'
}

export async function POST(req: Request) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  if (isRateLimited(clientIp)) {
    return Response.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form body' }, { status: 400 })
  }

  // Honeypot — bots fill it, real users never see it
  const honeypot = form.get('website')
  if (typeof honeypot === 'string' && honeypot.trim()) {
    return Response.json({ success: true, slug: 'partner' })
  }

  const nameRaw = form.get('name')
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
  const emailRaw = form.get('contact_email')
  const contactEmail = typeof emailRaw === 'string' ? emailRaw.trim() : ''

  const errors: string[] = []
  if (!name) errors.push('Organization name is required')
  else if (name.length > MAX_NAME_LEN) errors.push(`Organization name must be ${MAX_NAME_LEN} characters or fewer`)
  if (contactEmail && !EMAIL_RE.test(contactEmail)) errors.push('Invalid email format')

  const logoFile = form.get('logo')
  if (!(logoFile instanceof File) || logoFile.size === 0) {
    errors.push('A logo is required')
  } else if (logoFile.size > MAX_LOGO_BYTES) {
    errors.push('Logo file too large (max 2MB)')
  }
  if (errors.length > 0) {
    return Response.json({ error: errors.join('; ') }, { status: 400 })
  }

  const logoBytes = new Uint8Array(await (logoFile as File).arrayBuffer())
  const sniffed = sniffImage(logoBytes)
  if (!sniffed) {
    return Response.json(
      { error: 'Logo must be a PNG, JPEG, or WebP image' },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()

  // Upload first — the row needs the public URL. Path/type come from the
  // sniffed bytes, never the client filename.
  const objectPath = `${Date.now()}-${crypto.randomUUID()}.${sniffed.ext}`
  const { error: uploadError } = await supabase.storage
    .from('partner-logos')
    .upload(objectPath, logoBytes, { contentType: sniffed.contentType, upsert: false })
  if (uploadError) {
    console.error('Partner logo upload error:', uploadError)
    return Response.json({ error: 'Could not save your logo. Please try again.' }, { status: 500 })
  }
  const { data: pub } = supabase.storage.from('partner-logos').getPublicUrl(objectPath)
  const logoUrl = pub.publicUrl

  // Insert with slug dedupe: the unique constraint is the arbiter (23505),
  // numeric suffixes first, one random suffix as the last resort.
  const base = partnerSlugBase(name)
  const candidates = ['', '-2', '-3', '-4', '-5', `-${crypto.randomUUID().slice(0, 4)}`]
    .map((suffix) => base.slice(0, MAX_SLUG_LEN - suffix.length).replace(/-+$/, '') + suffix)

  let slug: string | null = null
  let insertError: unknown = null
  for (const candidate of candidates) {
    const { error } = await supabase.from('partners').insert({
      slug: candidate,
      name,
      logo_url: logoUrl,
      contact_email: contactEmail || null,
      active: true,
      status: 'pending',
    })
    if (!error) {
      slug = candidate
      break
    }
    insertError = error
    if (error.code !== '23505') break
  }

  if (!slug) {
    console.error('Partner insert error:', insertError)
    // Best-effort cleanup so failed signups don't strand logos in the bucket
    await supabase.storage.from('partner-logos').remove([objectPath]).catch(() => {})
    return Response.json({ error: 'Could not create your page. Please try again.' }, { status: 500 })
  }

  // Heads-up to Keith so pending rows get spot-checked; the signup itself
  // never waits on (or fails with) the email.
  try {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const liveUrl = `https://www.gogreenstreets.org/nearby?partner=${slug}`
    await resend.emails.send({
      from: 'GSI Website <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New self-service partner: ${name}`,
      html: [
        `<h2>New self-service partner signup</h2>`,
        `<p><strong>${esc(name)}</strong> (status: pending)</p>`,
        `<p>Live link: <a href="${liveUrl}">${liveUrl}</a></p>`,
        `<p>Logo: <a href="${logoUrl}">${logoUrl}</a><br/>`,
        `<img src="${logoUrl}" alt="" style="max-height:60px;background:#fff;padding:8px;border-radius:6px"/></p>`,
        contactEmail ? `<p>Contact: ${esc(contactEmail)}</p>` : '',
        `<p>Review it on the <a href="https://admin.gogreenstreets.org">admin dashboard</a> (Outreach Partners) — reject reverts the link to the default page.</p>`,
        `<hr/><p style="color:#888;font-size:12px">Submitted via gogreenstreets.org/partners<br/>${new Date().toISOString()}</p>`,
      ].join('\n'),
    })
  } catch (emailError) {
    console.error('Partner signup email error:', emailError)
  }

  return Response.json({ success: true, slug })
}
