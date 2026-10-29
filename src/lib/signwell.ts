import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Minimal SignWell API client for the Employer Platform Agreement
// (Keith 2026-10-28: SignWell, 25 free API documents a month).
// Docs: developers.signwell.com. Key: SIGNWELL_API_KEY (Vercel, Sensitive).

const BASE = 'https://www.signwell.com/api/v1'

function key(): string {
  const k = process.env.SIGNWELL_API_KEY
  if (!k) throw new Error('SIGNWELL_API_KEY is not set')
  return k
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'X-Api-Key': key(), 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SignWell ${init.method ?? 'GET'} ${path} ${res.status}: ${text.slice(0, 300)}`)
  }
  return (res.status === 204 ? null : await res.json()) as T
}

export type SignWellRecipient = { id: string; name: string; email: string; status: string | null; signing_order?: number }
export type SignWellDocument = {
  id: string
  status: string
  test_mode?: boolean
  recipients: SignWellRecipient[]
  metadata?: Record<string, string> | null
}

// No redirect_url: SignWell appends the signer's email to it, which would
// land in page analytics. Signers finish on SignWell's own page.
export function createDocument(body: {
  test_mode: boolean
  name: string
  subject: string
  message: string
  pdfBase64: string
  fileName: string
  recipients: { id: string; name: string; email: string }[]
  expires_in: number
  metadata: Record<string, string>
}): Promise<SignWellDocument> {
  return call<SignWellDocument>('/documents', {
    method: 'POST',
    body: JSON.stringify({
      test_mode: body.test_mode,
      name: body.name,
      subject: body.subject,
      message: body.message,
      files: [{ name: body.fileName, file_base64: body.pdfBase64 }],
      recipients: body.recipients,
      apply_signing_order: true,
      reminders: true,
      expires_in: body.expires_in,
      text_tags: true,
      custom_requester_name: 'Green Streets Initiative',
      custom_requester_email: 'info@gogreenstreets.org',
      metadata: body.metadata,
    }),
  })
}

export function getDocument(id: string): Promise<SignWellDocument> {
  return call<SignWellDocument>(`/documents/${encodeURIComponent(id)}`)
}

export async function deleteDocument(id: string): Promise<void> {
  await call<null>(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** The signed PDF, with SignWell's audit page. */
export async function getCompletedPdf(id: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(id)}/completed_pdf`, {
    headers: { 'X-Api-Key': key() },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`SignWell completed_pdf ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

type Hook = { id: string; callback_url: string }
export function listHooks(): Promise<Hook[]> {
  return call<Hook[]>('/hooks')
}
export function createHook(callbackUrl: string): Promise<Hook> {
  return call<Hook>('/hooks', { method: 'POST', body: JSON.stringify({ callback_url: callbackUrl }) })
}

let hookIds: { ids: string[]; at: number } | null = null

/**
 * SignWell signs each event with HMAC-SHA256 of "<type>@<time>", keyed by
 * the webhook's id. The id isn't much of a secret, so the webhook route
 * also re-reads the document from the API before acting on anything.
 */
export async function verifyEventHash(event: { type?: string; time?: number | string; hash?: string }): Promise<boolean> {
  if (!event?.type || event.time == null || !event.hash) return false
  if (!hookIds || Date.now() - hookIds.at > 10 * 60_000) {
    hookIds = { ids: (await listHooks()).map((h) => h.id), at: Date.now() }
  }
  const expected = Buffer.from(String(event.hash))
  return hookIds.ids.some((id) => {
    const calc = Buffer.from(createHmac('sha256', id).update(`${event.type}@${event.time}`).digest('hex'))
    return calc.length === expected.length && timingSafeEqual(calc, expected)
  })
}
