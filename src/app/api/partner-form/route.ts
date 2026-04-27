import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_TIERS = ['community', 'champion', 'presenting', 'custom'] as const
const VALID_PRIZE_CATEGORIES = ['grand', 'weekly', 'catalog', 'unsure'] as const
const VALID_TEAM_SIZES = ['1-50', '51-250', '251-1000', '1000+'] as const

type Tier = (typeof VALID_TIERS)[number]
type PrizeCategory = (typeof VALID_PRIZE_CATEGORIES)[number]
type TeamSize = (typeof VALID_TEAM_SIZES)[number]

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

function strField(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function boolField(form: FormData, key: string): boolean {
  return form.get(key) === 'true' || form.get(key) === 'on'
}

interface SponsorMetadata {
  tier?: Tier
}
interface PrizeMetadata {
  prize_category?: PrizeCategory
  prize_description?: string
  prize_value?: string
  prize_quantity?: string
}
interface TeamMetadata {
  team_size?: TeamSize
}

export async function POST(req: Request) {
  // Rate limit
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

  // Parse multipart form
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form body' }, { status: 400 })
  }

  // Honeypot
  if (strField(form, 'website')) {
    return Response.json({ success: true })
  }

  const firstName = strField(form, 'first_name')
  const lastName = strField(form, 'last_name')
  const company = strField(form, 'company')
  const title = strField(form, 'title') || null
  const email = strField(form, 'email')
  const phone = strField(form, 'phone') || null
  const notes = strField(form, 'notes') || null

  const isSponsor = boolField(form, 'is_sponsor')
  const isPrizeDonor = boolField(form, 'is_prize_donor')
  const isTeamParticipant = boolField(form, 'is_team_participant')

  // Validation
  const errors: string[] = []
  if (!firstName) errors.push('First name is required')
  if (!lastName) errors.push('Last name is required')
  if (!company) errors.push('Company is required')
  if (!email) errors.push('Email is required')
  else if (!EMAIL_RE.test(email)) errors.push('Invalid email format')
  if (!isSponsor && !isPrizeDonor && !isTeamParticipant) {
    errors.push('Select at least one partnership type')
  }

  let sponsorMetadata: SponsorMetadata = {}
  if (isSponsor) {
    const tier = strField(form, 'tier')
    if (tier && !VALID_TIERS.includes(tier as Tier)) {
      errors.push('Invalid sponsorship tier')
    }
    sponsorMetadata = tier ? { tier: tier as Tier } : {}
  }

  let prizeMetadata: PrizeMetadata = {}
  if (isPrizeDonor) {
    const cat = strField(form, 'prize_category')
    if (cat && !VALID_PRIZE_CATEGORIES.includes(cat as PrizeCategory)) {
      errors.push('Invalid prize category')
    }
    prizeMetadata = {
      prize_category: cat ? (cat as PrizeCategory) : undefined,
      prize_description: strField(form, 'prize_description') || undefined,
      prize_value: strField(form, 'prize_value') || undefined,
      prize_quantity: strField(form, 'prize_quantity') || undefined,
    }
  }

  let teamMetadata: TeamMetadata = {}
  if (isTeamParticipant) {
    const size = strField(form, 'team_size')
    if (size && !VALID_TEAM_SIZES.includes(size as TeamSize)) {
      errors.push('Invalid team size')
    }
    teamMetadata = size ? { team_size: size as TeamSize } : {}
  }

  if (errors.length > 0) {
    return Response.json({ error: errors.join('; ') }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // 1. Logo upload (optional)
  let logoUrl: string | null = null
  const logoFile = form.get('logo')
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: 'Logo file too large (max 5MB)' },
        { status: 400 },
      )
    }
    const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png'
    const objectPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('partner-logos')
      .upload(objectPath, logoFile, {
        contentType: logoFile.type || undefined,
        upsert: false,
      })
    if (uploadError) {
      console.error('Logo upload error:', uploadError)
    } else {
      const { data: pub } = supabase.storage
        .from('partner-logos')
        .getPublicUrl(objectPath)
      logoUrl = pub.publicUrl
    }
  }

  // 2. Upsert organization (case-insensitive match on name)
  let orgId: string
  {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id, logo_url')
      .ilike('name', company)
      .maybeSingle()

    if (existing) {
      orgId = existing.id
      if (logoUrl && !existing.logo_url) {
        await supabase
          .from('organizations')
          .update({ logo_url: logoUrl })
          .eq('id', orgId)
      }
    } else {
      const { data: created, error } = await supabase
        .from('organizations')
        .insert({
          name: company,
          logo_url: logoUrl,
        })
        .select('id')
        .single()
      if (error || !created) {
        console.error('Org insert error:', error)
        return Response.json({ error: 'Database error' }, { status: 500 })
      }
      orgId = created.id
    }
  }

  // 3. Upsert contact by email
  let contactId: string
  {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .ilike('email', email)
      .maybeSingle()

    if (existing) {
      contactId = existing.id
      if (!existing.organization_id) {
        await supabase
          .from('contacts')
          .update({ organization_id: orgId })
          .eq('id', contactId)
      }
    } else {
      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          title,
          organization_id: orgId,
          source: 'manual',
          classification_status: 'unclassified',
          loops_subscribed: false,
          notes: notes ? `Partner form submission: ${notes}` : 'Partner form submission',
        })
        .select('id')
        .single()
      if (error || !created) {
        console.error('Contact insert error:', error)
        return Response.json({ error: 'Database error' }, { status: 500 })
      }
      contactId = created.id
    }
  }

  // 4. Look up "Inbound interest" stage UUIDs for the types we'll insert
  const typesToInsert: Array<{
    relationshipType: string
    metadata: SponsorMetadata | PrizeMetadata | TeamMetadata
  }> = []
  if (isSponsor) typesToInsert.push({ relationshipType: 'flagship_sponsor', metadata: sponsorMetadata })
  if (isPrizeDonor) typesToInsert.push({ relationshipType: 'prize_donor', metadata: prizeMetadata })
  if (isTeamParticipant) typesToInsert.push({ relationshipType: 'team_participant', metadata: teamMetadata })

  const relationshipTypeIds = typesToInsert.map((t) => t.relationshipType)
  const { data: stageRows } = await supabase
    .from('pipeline_stages')
    .select('id, relationship_type_id, name')
    .in('relationship_type_id', relationshipTypeIds)
    .eq('name', 'Inbound interest')

  const stageByType = new Map(
    (stageRows ?? []).map((s) => [s.relationship_type_id, s.id]),
  )

  // 5. Insert one contact_relationships row per partnership type
  const relationshipRows = typesToInsert
    .map((t) => {
      const stageId = stageByType.get(t.relationshipType)
      if (!stageId) return null
      return {
        contact_id: contactId,
        organization_id: orgId,
        relationship_type_id: t.relationshipType,
        stage_id: stageId,
        status: 'active',
        notes: notes ?? null,
        metadata: t.metadata,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (relationshipRows.length > 0) {
    const { error: relErr } = await supabase
      .from('contact_relationships')
      .insert(relationshipRows)
    if (relErr) {
      console.error('Relationship insert error:', relErr)
    }
  }

  // 6. Log as an interaction so it shows up in the CRM digest
  await supabase.from('interactions').insert({
    contact_id: contactId,
    organization_id: orgId,
    type: 'note',
    direction: 'inbound',
    subject: 'Partner form: Shift Your Summer',
    body: buildInteractionBody({
      types: typesToInsert.map((t) => t.relationshipType),
      sponsor: sponsorMetadata,
      prize: prizeMetadata,
      team: teamMetadata,
      notes,
    }),
    occurred_at: new Date().toISOString(),
  })

  // 7. Send Keith the notification
  try {
    await resend.emails.send({
      from: 'Shift Website <noreply@gogreenstreets.org>',
      to: 'keith@gogreenstreets.org',
      subject: `New partnership interest: ${company}`,
      html: buildEmailHtml({
        firstName,
        lastName,
        company,
        title,
        email,
        phone,
        types: typesToInsert.map((t) => t.relationshipType),
        sponsor: sponsorMetadata,
        prize: prizeMetadata,
        team: teamMetadata,
        notes,
        logoUrl,
      }),
    })
  } catch (emailError) {
    console.error('Partner form email error:', emailError)
  }

  return Response.json({ success: true })
}

function buildInteractionBody(args: {
  types: string[]
  sponsor: SponsorMetadata
  prize: PrizeMetadata
  team: TeamMetadata
  notes: string | null
}): string {
  const lines: string[] = []
  lines.push(`Types: ${args.types.join(', ')}`)
  if (args.sponsor.tier) lines.push(`Sponsorship tier: ${args.sponsor.tier}`)
  if (args.prize.prize_category) lines.push(`Prize category: ${args.prize.prize_category}`)
  if (args.prize.prize_description) lines.push(`Prize: ${args.prize.prize_description}`)
  if (args.prize.prize_value) lines.push(`Prize value: ${args.prize.prize_value}`)
  if (args.prize.prize_quantity) lines.push(`Prize qty: ${args.prize.prize_quantity}`)
  if (args.team.team_size) lines.push(`Team size: ${args.team.team_size}`)
  if (args.notes) lines.push(`Notes: ${args.notes}`)
  return lines.join('\n')
}

function buildEmailHtml(args: {
  firstName: string
  lastName: string
  company: string
  title: string | null
  email: string
  phone: string | null
  types: string[]
  sponsor: SponsorMetadata
  prize: PrizeMetadata
  team: TeamMetadata
  notes: string | null
  logoUrl: string | null
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines: string[] = [
    `<h2>New partnership interest</h2>`,
    `<p><strong>${esc(args.firstName)} ${esc(args.lastName)}</strong>${args.title ? ` &middot; ${esc(args.title)}` : ''}<br/>`,
    `<strong>${esc(args.company)}</strong><br/>`,
    `${esc(args.email)}${args.phone ? ` &middot; ${esc(args.phone)}` : ''}</p>`,
    `<p><strong>Partnership types:</strong> ${args.types.map(esc).join(', ')}</p>`,
  ]
  if (args.sponsor.tier) {
    lines.push(`<p><strong>Sponsorship tier:</strong> ${esc(args.sponsor.tier)}</p>`)
  }
  if (args.prize.prize_category || args.prize.prize_description || args.prize.prize_value || args.prize.prize_quantity) {
    lines.push('<p><strong>Prize donation:</strong></p><ul>')
    if (args.prize.prize_category) lines.push(`<li>Category: ${esc(args.prize.prize_category)}</li>`)
    if (args.prize.prize_description) lines.push(`<li>What: ${esc(args.prize.prize_description)}</li>`)
    if (args.prize.prize_value) lines.push(`<li>Estimated value: ${esc(args.prize.prize_value)}</li>`)
    if (args.prize.prize_quantity) lines.push(`<li>Quantity: ${esc(args.prize.prize_quantity)}</li>`)
    lines.push('</ul>')
  }
  if (args.team.team_size) {
    lines.push(`<p><strong>Team size:</strong> ${esc(args.team.team_size)}</p>`)
  }
  if (args.notes) {
    lines.push(`<p><strong>Notes:</strong></p><p>${esc(args.notes).replace(/\n/g, '<br/>')}</p>`)
  }
  if (args.logoUrl) {
    lines.push(`<p><strong>Logo:</strong> <a href="${args.logoUrl}">${args.logoUrl}</a></p>`)
  }
  lines.push(
    `<hr/><p style="color:#888;font-size:12px">Submitted via gogreenstreets.org/events/shift-your-summer/partners<br/>${new Date().toISOString()}</p>`,
  )
  return lines.join('\n')
}
