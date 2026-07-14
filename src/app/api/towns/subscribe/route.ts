import { NextResponse } from 'next/server'
import { subscribeTownDigest } from '@/lib/loops'

/**
 * Town-digest email capture (paths Phase 1 / E19 front door).
 * Body: { email, town } — town is the page slug ("somerville-ma").
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_RE = /^[a-z0-9-]{2,60}$/

export async function POST(req: Request) {
  let body: { email?: string; town?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const town = (body.town ?? '').trim()
  if (!EMAIL_RE.test(email) || !SLUG_RE.test(town)) {
    return NextResponse.json({ error: 'invalid email or town' }, { status: 400 })
  }
  const result = await subscribeTownDigest(email, town)
  if (!result.ok) {
    return NextResponse.json({ error: 'subscription failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
