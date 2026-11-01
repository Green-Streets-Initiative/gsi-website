import { NextRequest, NextResponse } from 'next/server'
import { bikePerkPool } from '@/lib/server/bike-perks'
import { perksAlong, perksNear } from '@/lib/bike-perks'

/**
 * Bicycle Benefits members for the Shift app (src/lib/bike-perks.ts says what
 * "near" means):
 *  GET  ?near=lat,lng&r=meters  → members around a place (Around You's map)
 *  POST { line: [[lat,lng]…], start: [lat,lng] } → members by a ride's
 *       meeting spot or along its route (the app's ride page)
 * Public data from the program's own published list; nothing personal in or out.
 */

const inArea = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40 && lat <= 44 && lng >= -75 && lng <= -69

export async function GET(req: NextRequest) {
  const [lat, lng] = (req.nextUrl.searchParams.get('near') ?? '').split(',').map(parseFloat)
  if (!inArea(lat, lng)) return NextResponse.json({ error: 'near=lat,lng required' }, { status: 400 })
  const r = Math.min(Math.max(parseFloat(req.nextUrl.searchParams.get('r') ?? '') || 3000, 100), 8000)
  const perks = perksNear(await bikePerkPool(), { lat, lng }, r, 10)
  return NextResponse.json({ perks }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { line?: unknown; start?: unknown } | null
  const pt = (v: unknown) => Array.isArray(v) && v.length === 2 && inArea(Number(v[0]), Number(v[1])) ? { lat: Number(v[0]), lng: Number(v[1]) } : null
  const line = Array.isArray(body?.line) ? body.line.slice(0, 3000).map(pt).filter((p): p is { lat: number; lng: number } => !!p) : []
  const start = pt(body?.start)
  if (!start && line.length < 2) return NextResponse.json({ error: 'line or start required' }, { status: 400 })
  const perks = perksAlong(await bikePerkPool(), line, start)
  return NextResponse.json({ perks }, { headers: { 'Cache-Control': 'private, no-store' } })
}
