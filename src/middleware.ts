import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    '/whatmovesus/dashboard/:path*',
    '/admin/:path*',
    '/portal/:path*',
    '/login',
    '/flyer',
    '/shift/employers/:path*',
    '/',
  ],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── shiftatwork.org employer domain ──
  const host = req.headers.get('host') ?? ''
  if (host.includes('shiftatwork.org')) {
    return handleEmployerDomain(req)
  }

  // ── Admin routes ──
  if (pathname.startsWith('/admin')) {
    return handleAdmin(req)
  }

  // ── WMU Funder Dashboard ──
  if (pathname.startsWith('/whatmovesus/dashboard')) {
    return handleWmu(req)
  }

  return NextResponse.next()
}

// ════════════════════════════════════════════════════════════════════
// shiftatwork.org — clean URL rewrites for the employer domain
// ════════════════════════════════════════════════════════════════════

function handleEmployerDomain(req: NextRequest) {
  const { pathname } = req.nextUrl

  // If someone hits the full internal path, redirect to the clean version
  if (pathname.startsWith('/shift/employers')) {
    const clean = pathname.replace(/^\/shift\/employers/, '') || '/'
    const url = new URL(clean, req.url)
    url.search = req.nextUrl.search
    return NextResponse.redirect(url, 308)
  }

  // Rewrite clean paths to internal routes
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/shift/employers', req.url))
  }
  if (pathname === '/login') {
    return NextResponse.rewrite(new URL('/shift/employers/login', req.url))
  }
  if (pathname === '/flyer') {
    const dest = new URL('/shift/employers/flyer', req.url)
    dest.search = req.nextUrl.search
    return NextResponse.rewrite(dest)
  }
  if (pathname === '/portal' || pathname.startsWith('/portal/')) {
    const rest = pathname.replace(/^\/portal/, '') || ''
    const dest = new URL(`/shift/employers/portal${rest}`, req.url)
    dest.search = req.nextUrl.search
    return NextResponse.rewrite(dest)
  }

  // Any other path on this domain → redirect to main site
  const mainUrl = new URL(`https://gogreenstreets.org${pathname}`)
  mainUrl.search = req.nextUrl.search
  return NextResponse.redirect(mainUrl, 308)
}

// ════════════════════════════════════════════════════════════════════
// Admin auth — password-based JWT cookie
// ════════════════════════════════════════════════════════════════════

const ADMIN_COOKIE = 'gsi_admin_token'

async function handleAdmin(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  const secret = process.env.ADMIN_PASSWORD
  if (!secret) {
    return redirectToAdminLogin(req)
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!token) {
    return redirectToAdminLogin(req)
  }

  const valid = await verifyAdminJwt(token, secret)
  if (!valid) {
    const res = redirectToAdminLogin(req)
    res.cookies.delete(ADMIN_COOKIE)
    return res
  }

  return NextResponse.next()
}

async function verifyAdminJwt(token: string, secret: string): Promise<boolean> {
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
    if (payload.scope !== 'gsi_admin') return false
    if (payload.exp < Math.floor(Date.now() / 1000)) return false

    return true
  } catch {
    return false
  }
}

function redirectToAdminLogin(req: NextRequest) {
  const url = new URL('/admin/login', req.url)
  return NextResponse.redirect(url)
}

// ════════════════════════════════════════════════════════════════════
// WMU Funder Dashboard auth — magic-link JWT
// ════════════════════════════════════════════════════════════════════

const WMU_COOKIE = 'wmu_funder_token'
const WMU_SECRET_ENV = 'WMU_FUNDER_JWT_SECRET'

async function handleWmu(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/whatmovesus/dashboard/expired') {
    return NextResponse.next()
  }

  const secret = process.env[WMU_SECRET_ENV]
  if (!secret) {
    console.error('[WMU Middleware] Missing WMU_FUNDER_JWT_SECRET')
    return redirectToExpired(req)
  }

  const tokenParam = req.nextUrl.searchParams.get('token')
  if (tokenParam) {
    const result = await verifyWmuJwt(tokenParam, secret)
    if (!result.ok) {
      return redirectToExpired(req)
    }

    const cleanUrl = new URL(req.url)
    cleanUrl.searchParams.delete('token')

    const response = NextResponse.redirect(cleanUrl)
    response.cookies.set(WMU_COOKIE, tokenParam, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/whatmovesus/dashboard',
      maxAge: result.payload.exp - Math.floor(Date.now() / 1000),
    })
    return response
  }

  const cookieToken = req.cookies.get(WMU_COOKIE)?.value
  if (!cookieToken) {
    return redirectToExpired(req)
  }

  const result = await verifyWmuJwt(cookieToken, secret)
  if (!result.ok) {
    const response = redirectToExpired(req)
    response.cookies.delete(WMU_COOKIE)
    return response
  }

  const response = NextResponse.next()
  response.headers.set('x-wmu-campaign-id', result.payload.campaign_id)
  response.headers.set('x-wmu-campaign-slug', result.payload.campaign_slug)
  response.headers.set('x-wmu-token', cookieToken)
  return response
}

interface WmuPayload {
  campaign_id: string
  campaign_slug: string
  nonce: string
  scope: string
  iat: number
  exp: number
}

type WmuVerifyResult =
  | { ok: true; payload: WmuPayload }
  | { ok: false }

async function verifyWmuJwt(token: string, secret: string): Promise<WmuVerifyResult> {
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

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sig),
      new TextEncoder().encode(`${header}.${body}`),
    )
    if (!valid) return { ok: false }

    const payload: WmuPayload = JSON.parse(
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
