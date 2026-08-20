import { NextResponse } from 'next/server'
import { getNearbyPromos } from '@/lib/server/nearby-promo'

/**
 * Active contextual promos for the /nearby disruption detail (matched to alerts
 * client-side by effect/route). Global config, no lat/lng. Consumed by the
 * website and by the app's nearby-transit edge function.
 */
export async function GET() {
  const promos = await getNearbyPromos().catch(() => [])
  return NextResponse.json(
    { promos },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } },
  )
}
