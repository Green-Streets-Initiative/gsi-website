import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isImpactRangeKey, isCustomDates, type CustomDates, type ImpactRangeChoice } from '@/lib/impact-range'

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
  range: ImpactRangeChoice
  /** Only for range 'custom': the Eastern calendar days, both included. */
  from?: string
  to?: string
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

export function signEmployerReportToken(groupId: string, range: ImpactRangeChoice, email: string, custom?: CustomDates): string {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) throw new Error('EMPLOYER_REPORT_TOKEN_SECRET not set')
  const iat = Math.floor(Date.now() / 1000)
  const payload: EmployerReportTokenPayload = {
    group_id: groupId,
    range,
    ...(range === 'custom' && custom ? { from: custom.from, to: custom.to } : {}),
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
  const rangeOk =
    isImpactRangeKey(payload.range) || (payload.range === 'custom' && isCustomDates({ from: payload.from, to: payload.to }, Date.now()))
  if (!payload.group_id || !rangeOk || typeof payload.exp !== 'number') {
    return { ok: false, error: 'malformed' }
  }
  if (payload.group_id !== groupId) return { ok: false, error: 'group' }
  if (payload.exp * 1000 < Date.now()) return { ok: false, error: 'expired' }

  return { ok: true, payload }
}

// ── Commute survey reports (Shift 01170): same shape, its own scope ───────

const SURVEY_SCOPE = 'employer_survey_report'

export type SurveyReportVariant = 'filing' | 'leadership'

export interface EmployerSurveyReportTokenPayload {
  survey_id: string
  group_id: string
  format: string
  variant: SurveyReportVariant
  email: string
  scope: typeof SURVEY_SCOPE
  iat: number
  exp: number
}

export function signEmployerSurveyReportToken(args: {
  surveyId: string
  groupId: string
  format: string
  variant: SurveyReportVariant
  email: string
}): string {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) throw new Error('EMPLOYER_REPORT_TOKEN_SECRET not set')
  const iat = Math.floor(Date.now() / 1000)
  const payload: EmployerSurveyReportTokenPayload = {
    survey_id: args.surveyId,
    group_id: args.groupId,
    format: args.format,
    variant: args.variant,
    email: args.email,
    scope: SURVEY_SCOPE,
    iat,
    exp: iat + EMPLOYER_REPORT_TOKEN_TTL_SECONDS,
  }
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  return `${header}.${body}.${base64UrlEncode(sig)}`
}

export type EmployerSurveyReportTokenResult =
  | { ok: true; payload: EmployerSurveyReportTokenPayload }
  | { ok: false; error: 'config' | 'malformed' | 'signature' | 'expired' | 'scope' | 'survey' }

/** Verifies the signature, the expiry, and that the token is for `surveyId`, `format` and `variant`. */
export function verifyEmployerSurveyReportToken(token: string, surveyId: string, format: string, variant: string): EmployerSurveyReportTokenResult {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) return { ok: false, error: 'config' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'malformed' }
  const [header, body, sig] = parts
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const given = base64UrlDecode(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: 'signature' }
  let payload: EmployerSurveyReportTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'))
  } catch {
    return { ok: false, error: 'malformed' }
  }
  if (payload.scope !== SURVEY_SCOPE) return { ok: false, error: 'scope' }
  if (!payload.survey_id || !payload.group_id || typeof payload.exp !== 'number') return { ok: false, error: 'malformed' }
  if (payload.survey_id !== surveyId || payload.format !== format || payload.variant !== variant) return { ok: false, error: 'survey' }
  if (payload.exp * 1000 < Date.now()) return { ok: false, error: 'expired' }
  return { ok: true, payload }
}
