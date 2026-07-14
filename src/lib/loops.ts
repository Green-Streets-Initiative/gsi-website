// Server-only module: uses process.env and node:crypto. Imported by Next.js
// API routes and by the bulk-sync CLI script — both server-side. Not safe to
// import from a Client Component.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const LOOPS_BASE = 'https://app.loops.so/api/v1'
const RATE_LIMIT_PER_SEC = 8 // Loops cap is 10/sec; leave headroom

export const LOOPS_LIST_IDS = {
  newsletter: process.env.LOOPS_LIST_NEWSLETTER_ID || '',
  shiftUpdates: process.env.LOOPS_LIST_SHIFT_UPDATES_ID || '',
  businessPartners: process.env.LOOPS_LIST_BUSINESS_PARTNERS_ID || '',
  schools: process.env.LOOPS_LIST_SCHOOLS_ID || '',
  donors: process.env.LOOPS_LIST_DONORS_ID || '',
}

export type LoopsContactPayload = {
  email: string
  userId: string
  firstName?: string | null
  lastName?: string | null
  source: string
  subscribed: boolean
  userGroup?: string
  neighborhood?: string | null
  phone?: string | null
  title?: string | null
  signupSource?: string | null
  classificationStatus?: string | null
  signupDate?: string | null
  linkedinUrl?: string | null
  mailingLists: Record<string, boolean>
}

export type ViewRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  title: string | null
  neighborhood: string | null
  signup_source: string | null
  classification_status: string | null
  linkedin_url: string | null
  loops_subscribed: boolean
  loops_contact_id: string | null
  loops_payload_hash: string | null
  created_at: string
  is_shift_user: boolean
  is_business_partner: boolean
  is_school: boolean
  is_donor: boolean
  user_group: string
}

export function buildLoopsPayload(row: ViewRow): LoopsContactPayload {
  return {
    email: row.email,
    userId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    source: 'supabase-crm',
    subscribed: row.loops_subscribed,
    userGroup: row.user_group,
    neighborhood: row.neighborhood,
    phone: row.phone,
    title: row.title,
    signupSource: row.signup_source,
    classificationStatus: row.classification_status,
    signupDate: row.created_at,
    linkedinUrl: row.linkedin_url,
    mailingLists: {
      [LOOPS_LIST_IDS.newsletter]: true,
      [LOOPS_LIST_IDS.shiftUpdates]: row.is_shift_user,
      [LOOPS_LIST_IDS.businessPartners]: row.is_business_partner,
      [LOOPS_LIST_IDS.schools]: row.is_school,
      [LOOPS_LIST_IDS.donors]: row.is_donor,
    },
  }
}

export function hashPayload(payload: LoopsContactPayload): string {
  // Deterministic hash: stringify with sorted keys.
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((m, k) => {
      const v = (payload as unknown as Record<string, unknown>)[k]
      if (k === 'mailingLists' && v && typeof v === 'object') {
        const lists = v as Record<string, boolean>
        m[k] = Object.keys(lists)
          .sort()
          .reduce<Record<string, boolean>>((mm, kk) => ((mm[kk] = lists[kk]), mm), {})
      } else {
        m[k] = v
      }
      return m
    }, {})
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex')
}

// ---------------------------------------------------------------------------
// Rate-limit gate. Single global token bucket across the process; sufficient
// for Vercel cold-start single-call paths and for the bulk script.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let lastCallAt = 0
async function rateLimit(): Promise<void> {
  const now = Date.now()
  const minGap = 1000 / RATE_LIMIT_PER_SEC
  const wait = Math.max(0, lastCallAt + minGap - now)
  if (wait > 0) await sleep(wait)
  lastCallAt = Date.now()
}

// ---------------------------------------------------------------------------
// Loops API calls
// ---------------------------------------------------------------------------

async function loopsFetch(path: string, init: RequestInit, attempt = 0): Promise<Response> {
  await rateLimit()
  const apiKey = process.env.LOOPS_API_KEY
  if (!apiKey) throw new Error('LOOPS_API_KEY not set')

  const res = await fetch(`${LOOPS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (res.status === 429 && attempt < 3) {
    const backoff = 1000 * Math.pow(2, attempt)
    await sleep(backoff)
    return loopsFetch(path, init, attempt + 1)
  }
  return res
}

export async function upsertContact(
  payload: LoopsContactPayload,
): Promise<{ ok: true; id: string } | { ok: false; status: number; body: string }> {
  const res = await loopsFetch('/contacts/update', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, body: text }
  let json: { id?: string }
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, status: res.status, body: `non-JSON body: ${text.slice(0, 200)}` }
  }
  if (!json.id) return { ok: false, status: res.status, body: `no id in response: ${text.slice(0, 200)}` }
  return { ok: true, id: json.id }
}

export async function unsubscribeContact(args: {
  email: string
  userId: string
  reason: string
}): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const payload = {
    email: args.email,
    userId: args.userId,
    subscribed: false,
    source: `supabase-crm-${args.reason}`,
  }
  const res = await loopsFetch('/contacts/update', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, status: res.status, body }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Inbound webhook signature verification.
// Loops signs with HMAC-SHA256 over the raw request body, sent as
// "Signature" header (timestamp + signature). The exact header format is
// confirmed against Loops's webhook docs at integration time; this helper
// supports the common t=...,v1=... pattern and a plain HMAC fallback.
// ---------------------------------------------------------------------------


/**
 * Town-digest signup (E19's front door — town pages' email capture).
 * Anonymous web visitors: no userId; Loops upserts by email. The contact
 * lands on the newsletter list with townDigest carrying the town slug so
 * the future digest can segment per town.
 */
export async function subscribeTownDigest(
  email: string,
  townSlug: string,
): Promise<{ ok: boolean; status?: number }> {
  const body: Record<string, unknown> = {
    email,
    source: 'town_page',
    subscribed: true,
    townDigest: townSlug,
  }
  if (LOOPS_LIST_IDS.newsletter) {
    body.mailingLists = { [LOOPS_LIST_IDS.newsletter]: true }
  }
  const res = await loopsFetch('/contacts/update', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true }
}

/**
 * Unsubscribe an email-only contact (town-digest subscribers have no CRM
 * userId — Loops matches by email alone).
 */
export async function unsubscribeTownDigestContact(
  email: string,
  reason: string,
): Promise<{ ok: boolean; status?: number }> {
  const res = await loopsFetch('/contacts/update', {
    method: 'PUT',
    body: JSON.stringify({
      email,
      subscribed: false,
      source: `town_digest_${reason}`,
    }),
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true }
}

export function verifyLoopsSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LOOPS_WEBHOOK_SECRET
  if (!secret) throw new Error('LOOPS_WEBHOOK_SECRET not set')
  if (!signatureHeader) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  // Try exact-match first (plain hex HMAC).
  if (signatureHeader === expected) return true

  // Try Stripe-style "t=...,v1=..." parsing.
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  )
  const v1 = parts.v1
  if (v1 && v1.length === expected.length) {
    try {
      return timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  }
  return false
}
