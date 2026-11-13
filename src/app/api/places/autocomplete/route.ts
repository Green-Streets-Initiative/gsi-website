import { NextRequest } from 'next/server'
import { autocompletePlaces, validNear } from '@/lib/server/places'

/**
 * Address box suggestions. `near` ({ lat, lng }) is where the map is, so a
 * search on a map of Worcester finds Worcester's Main Street first; without
 * it, Greater Boston (src/lib/server/places.ts, the one search path).
 */
export async function POST(req: NextRequest) {
  const { input, types, near } = (await req.json().catch(() => ({}))) as { input?: string; types?: string[]; near?: unknown }

  if (!input || input.trim().length < 3) {
    return Response.json({ predictions: [] })
  }

  const predictions = await autocompletePlaces(input, {
    types: Array.isArray(types) ? types.filter((t) => typeof t === 'string').slice(0, 5) : undefined,
    near: validNear(near),
  })
  if (predictions === null) return Response.json({ predictions: [] }, { status: 502 })
  return Response.json({ predictions })
}
