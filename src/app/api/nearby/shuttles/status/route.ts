import { NextResponse } from 'next/server'
import { shuttleFeedStatus } from '@/lib/server/shuttle-gtfs'

/**
 * Health of the shuttle operator feeds behind /api/nearby/topology — one
 * row per configured operator with stop/route counts, or the fetch error.
 * Read-only, no secrets; the operator list itself is public.
 */

export const maxDuration = 30

export async function GET() {
  const feeds = await shuttleFeedStatus()
  return NextResponse.json(
    { checkedAt: new Date().toISOString(), feeds },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  )
}
