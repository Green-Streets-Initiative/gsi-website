import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Town digest — signed unsubscribe tokens (sign + verify).
 *
 * The town-digest cron route (src/app/api/cron/town-digest) signs a token
 * per subscriber into every digest's unsubscribe link; /api/towns/unsubscribe
 * verifies it. HS256 JWT-shaped, base64url, deliberately NO expiry — an
 * unsubscribe link must keep working however old the email is. Secret:
 * TOWN_DIGEST_TOKEN_SECRET.
 */

const SCOPE = 'town_digest_unsubscribe'

export interface TownDigestUnsubTokenPayload {
  email: string
  town_slug: string
  scope: typeof SCOPE
  iat: number
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function signTownDigestUnsubToken(email: string, townSlug: string): string {
  const secret = process.env.TOWN_DIGEST_TOKEN_SECRET
  if (!secret) throw new Error('TOWN_DIGEST_TOKEN_SECRET not set')
  const payload: TownDigestUnsubTokenPayload = {
    email,
    town_slug: townSlug,
    scope: SCOPE,
    iat: Math.floor(Date.now() / 1000),
  }
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload)))
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  return `${header}.${body}.${base64UrlEncode(sig)}`
}

export function verifyTownDigestUnsubToken(
  token: string,
): { ok: true; payload: TownDigestUnsubTokenPayload } | { ok: false; error: string } {
  const secret = process.env.TOWN_DIGEST_TOKEN_SECRET
  if (!secret) return { ok: false, error: 'Server configuration error' }

  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, error: 'Malformed token' }
  const [header, body, sig] = parts

  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const given = base64UrlDecode(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, error: 'Invalid signature' }
  }

  let payload: TownDigestUnsubTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'))
  } catch {
    return { ok: false, error: 'Invalid payload' }
  }

  if (payload.scope !== SCOPE) return { ok: false, error: 'Invalid scope' }
  if (!payload.email || !payload.town_slug) return { ok: false, error: 'Invalid payload' }

  return { ok: true, payload }
}
