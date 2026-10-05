import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isImpactRangeKey, type ImpactRangeKey } from '@/lib/impact-range'

/**
 * Employer impact report — signed, short-lived links (sign + verify).
 *
 * POST /api/employer/report-link signs one for a signed-in portal admin,
 * viewer or GSI staff member; /shift/employers/report verifies it before
 * rendering the company's numbers with the service-role client. HS256
 * JWT-shaped, base64url, one-hour expiry: the link is meant to be opened
 * straight away and printed, not forwarded. Secret:
 * EMPLOYER_REPORT_TOKEN_SECRET.
 */

const SCOPE = 'employer_report'
export const EMPLOYER_REPORT_TOKEN_TTL_SECONDS = 60 * 60

export interface EmployerReportTokenPayload {
  group_id: string
  range: ImpactRangeKey
  /** Who asked for the link; printed in the report footer. */
  email: string
  scope: typeof SCOPE
  iat: number
  exp: number
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function signEmployerReportToken(groupId: string, range: ImpactRangeKey, email: string): string {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) throw new Error('EMPLOYER_REPORT_TOKEN_SECRET not set')
  const iat = Math.floor(Date.now() / 1000)
  const payload: EmployerReportTokenPayload = {
    group_id: groupId,
    range,
    email,
    scope: SCOPE,
    iat,
    exp: iat + EMPLOYER_REPORT_TOKEN_TTL_SECONDS,
  }
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  return `${header}.${body}.${base64UrlEncode(sig)}`
}

export type EmployerReportTokenResult =
  | { ok: true; payload: EmployerReportTokenPayload }
  | { ok: false; error: 'config' | 'malformed' | 'signature' | 'expired' | 'scope' | 'group' }

/** Verifies the signature, the expiry, and that the token is for `groupId`. */
export function verifyEmployerReportToken(token: string, groupId: string): EmployerReportTokenResult {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) return { ok: false, error: 'config' }

  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'malformed' }
  const [header, body, sig] = parts

  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const given = base64UrlDecode(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, error: 'signature' }
  }

  let payload: EmployerReportTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'))
  } catch {
    return { ok: false, error: 'malformed' }
  }

  if (payload.scope !== SCOPE) return { ok: false, error: 'scope' }
  if (!payload.group_id || !isImpactRangeKey(payload.range) || typeof payload.exp !== 'number') {
    return { ok: false, error: 'malformed' }
  }
  if (payload.group_id !== groupId) return { ok: false, error: 'group' }
  if (payload.exp * 1000 < Date.now()) return { ok: false, error: 'expired' }

  return { ok: true, payload }
}
