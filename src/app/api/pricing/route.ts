import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRICES } from '@/lib/facts/prices'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// In-memory cache
let cache: { data: Record<string, number>; expires: number } | null = null

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  }

  try {
    const { data, error } = await supabase
      .from('pricing_data')
      .select('key, value')

    if (error || !data) {
      return NextResponse.json(getDefaults(), { status: 200 })
    }

    const pricing: Record<string, number> = {}
    for (const row of data) {
      pricing[row.key] = Number(row.value)
    }

    // Merge with defaults for any missing keys
    const result = { ...getDefaults(), ...pricing }
    cache = { data: result, expires: Date.now() + 3600_000 }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json(getDefaults(), { status: 200 })
  }
}

function getDefaults(): Record<string, number> {
  return {
    gas_price_ma: PRICES.driving.gasPerGallonMa,
    mbta_subway_single: PRICES.mbta.subwaySingle,
    mbta_subway_monthly: PRICES.mbta.linkPassMonthly,
    mbta_bus_single: PRICES.mbta.busSingle,
    mbta_bus_monthly: PRICES.mbta.busPassMonthly,
    parking_daily_boston: PRICES.driving.parkingDailyBoston,
    maint_per_mile: PRICES.driving.maintPerMile,
  }
}
