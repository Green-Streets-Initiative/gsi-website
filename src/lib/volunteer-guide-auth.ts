import type { NextRequest } from 'next/server'

/**
 * Volunteer Guide session — shared by middleware (page gate) and the
 * /api/volunteer-guide/* route handlers (write gate). Web Crypto only, no
 * Node imports, so the edge middleware can import it.
 */
export const GUIDE_COOKIE = 'gsi_volunteer_guide_token'
export const GUIDE_SCOPE = 'gsi_volunteer_guide'

export function base64UrlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

export async function verifyScopedJwt(
  token: string,
  secret: string,
  scope: string,
): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const [header, body, sig] = parts
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sig),
      new TextEncoder().encode(`${header}.${body}`),
    )
    if (!valid) return false

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)))
    if (payload.scope !== scope) return false
    if (payload.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

/** True when the request carries a valid guide cookie. */
export async function requireGuideSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.VOLUNTEER_GUIDE_PASSWORD
  if (!secret) return false
  const token = req.cookies.get(GUIDE_COOKIE)?.value
  if (!token) return false
  return verifyScopedJwt(token, secret, GUIDE_SCOPE)
}
