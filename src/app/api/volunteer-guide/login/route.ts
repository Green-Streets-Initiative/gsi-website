import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'gsi_volunteer_guide_token'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const guidePassword = process.env.VOLUNTEER_GUIDE_PASSWORD

  if (!guidePassword || password !== guidePassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(guidePassword),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
  const payload = { scope: 'gsi_volunteer_guide', exp }
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${body}`),
  )
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const token = `${header}.${body}.${sigStr}`

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/volunteer/guide',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
