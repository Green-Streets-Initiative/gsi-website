import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    gas_price_ma: 3.59,
    mbta_subway_single: 2.40,
    mbta_subway_monthly: 90,
    mbta_bus_single: 1.70,
    mbta_bus_monthly: 55,
    parking_daily_boston: 18,
    maint_per_mile: 0.109,
  }
}
