import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware for WMU Funder Dashboard auth.
 *
 * Flow:
 * 1. ?token= query param → verify JWT, set httpOnly cookie, redirect (strip token from URL)
 * 2. wmu_funder_token cookie present → verify JWT, allow through
 * 3. No valid token → redirect to /whatmovesus/dashboard/expired
 */

const COOKIE_NAME = 'wmu_funder_token'
const SECRET_ENV = 'WMU_FUNDER_JWT_SECRET'

export const config = {
  matcher: '/whatmovesus/dashboard/:path*',
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip the expired page itself
  if (pathname === '/whatmovesus/dashboard/expired') {
    return NextResponse.next()
  }

  const secret = process.env[SECRET_ENV]
  if (!secret) {
    console.error('[WMU Middleware] Missing WMU_FUNDER_JWT_SECRET')
    return redirectToExpired(req)
  }

  // ── Check for token in query param (first visit via magic link) ──
  const tokenParam = req.nextUrl.searchParams.get('token')
  if (tokenParam) {
    const result = await verifyJwt(tokenParam, secret)
    if (!result.ok) {
      return redirectToExpired(req)
    }

    // Set cookie and redirect without the token param
    const cleanUrl = new URL(req.url)
    cleanUrl.searchParams.delete('token')

    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set(COOKIE_NAME, tokenParam, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/whatmovesus/dashboard',
      maxAge: result.payload.exp - Math.floor(Date.now() / 1000),
    })
    return response
  }

  // ── Check for existing cookie ──
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value
  if (!cookieToken) {
    return redirectToExpired(req)
  }

  const result = await verifyJwt(cookieToken, secret)
  if (!result.ok) {
    // Clear invalid cookie
    const response = redirectToExpired(req)
    response.cookies.delete(COOKIE_NAME)
    return response
  }

  // Pass campaign info to the page via headers
  const response = NextResponse.next()
  response.headers.set('x-wmu-campaign-id', result.payload.campaign_id)
  response.headers.set('x-wmu-campaign-slug', result.payload.campaign_slug)
  response.headers.set('x-wmu-token', cookieToken)
  return response
}

// ── JWT verification (Web Crypto API, Edge Runtime compatible) ──

interface JwtPayload {
  campaign_id: string
  campaign_slug: string
  nonce: string
  scope: string
  iat: number
  exp: number
}

type VerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false }

async function verifyJwt(token: string, secret: string): Promise<VerifyResult> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return { ok: false }

    const [header, body, sig] = parts

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const signingInput = `${header}.${body}`
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sig),
      new TextEncoder().encode(signingInput),
    )

    if (!valid) return { ok: false }

    const payload: JwtPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body)),
    )

    if (payload.scope !== 'wmu_funder_readonly') return { ok: false }

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return { ok: false }

    return { ok: true, payload }
  } catch {
    return { ok: false }
  }
}

function base64UrlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

function redirectToExpired(req: NextRequest) {
  const url = new URL('/whatmovesus/dashboard/expired', req.url)
  return NextResponse.redirect(url)
}
