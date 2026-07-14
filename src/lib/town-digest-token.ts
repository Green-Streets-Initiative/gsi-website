import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Town digest — signed unsubscribe tokens (verify side).
 *
 * The Shift repo's town-digest edge function signs a token per subscriber
 * into every digest's unsubscribe link (see
 * Shift/supabase/functions/_shared/town-digest-token.ts — the two files must
 * stay format-compatible: HS256 JWT-shaped, base64url, no expiry). Shared
 * secret: TOWN_DIGEST_TOKEN_SECRET, set in both the edge function secrets
 * and this app's env.
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
