import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Self-serve team challenge: the signed link in the "confirm your email"
 * message. It carries what the person typed, so nothing is stored until they
 * confirm. HS256, JWT-shaped, 72-hour expiry, same secret as the employer
 * report links (EMPLOYER_REPORT_TOKEN_SECRET) with its own scope.
 *
 * Opening the link changes nothing: the confirm page asks for a click first,
 * so a corporate mail scanner that loads every link can't create the team.
 */

const SCOPE = 'employer_team_challenge'
const TTL_SECONDS = 72 * 60 * 60

export interface TeamChallengeSignup {
  company: string
  name: string
  email: string
  headcount: number
}

interface Payload extends TeamChallengeSignup {
  scope: typeof SCOPE
  iat: number
  exp: number
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function signTeamChallengeToken(s: TeamChallengeSignup): string {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) throw new Error('EMPLOYER_REPORT_TOKEN_SECRET not set')
  const iat = Math.floor(Date.now() / 1000)
  const payload: Payload = { ...s, scope: SCOPE, iat, exp: iat + TTL_SECONDS }
  const header = b64(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  return `${header}.${body}.${b64(sig)}`
}

export type TeamChallengeTokenResult =
  | { ok: true; signup: TeamChallengeSignup }
  | { ok: false; error: 'config' | 'malformed' | 'signature' | 'expired' }

export function verifyTeamChallengeToken(token: string): TeamChallengeTokenResult {
  const secret = process.env.EMPLOYER_REPORT_TOKEN_SECRET
  if (!secret) return { ok: false, error: 'config' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'malformed' }
  const [header, body, sig] = parts
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const given = unb64(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: 'signature' }
  let p: Payload
  try {
    p = JSON.parse(unb64(body).toString('utf8'))
  } catch {
    return { ok: false, error: 'malformed' }
  }
  if (p.scope !== SCOPE || !p.company || !p.email || typeof p.exp !== 'number') return { ok: false, error: 'malformed' }
  if (p.exp * 1000 < Date.now()) return { ok: false, error: 'expired' }
  return { ok: true, signup: { company: p.company, name: p.name ?? '', email: p.email, headcount: p.headcount } }
}
