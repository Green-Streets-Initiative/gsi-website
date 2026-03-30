import { createServerSupabaseClient } from '@/lib/supabase-server'

interface ImpactStats {
  total_dollars_saved: number
  total_co2_metric_tons: number
  total_active_trips: number
  total_users: number
  trips_this_month: number
  neighborhood_count: number
}

/** Round down to nearest hundred and append "+" (e.g., 4237 → "4,200+").
 *  For counts under 100, show exact number. */
function approx(n: number): string {
  if (n < 100) return n.toLocaleString('en-US')
  const rounded = Math.floor(n / 100) * 100
  return rounded.toLocaleString('en-US') + '+'
}

function dollars(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function co2(n: number): string {
  return n.toFixed(1)
}

async function fetchStats(): Promise<ImpactStats | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_global_impact_stats').single()
    if (error) {
      console.error('ImpactTicker: RPC error', error.message)
      return null
    }
    return data as ImpactStats
  } catch {
    return null
  }
}

const FALLBACK_ITEMS = [
  '4,200+ active trips this month',
  '12 Massachusetts neighborhoods',
  '$18,400 saved by commuters',
  '2.6 metric tons of CO₂ avoided',
  'Helping active commuters since 2006',
  'Walk/Ride Days — returning via Shift',
]

export default async function ImpactTicker() {
  const stats = await fetchStats()

  const items = stats
    ? [
        `${approx(stats.trips_this_month)} active trips this month`,
        `${stats.neighborhood_count} Massachusetts neighborhoods`,
        `${dollars(stats.total_dollars_saved)} saved by commuters`,
        `${co2(stats.total_co2_metric_tons)} metric tons of CO₂ avoided`,
        'Helping active commuters since 2006',
        'Walk/Ride Days — returning via Shift',
      ]
    : FALLBACK_ITEMS

  const row = items.map((text, i) => (
    <div key={i} className="flex items-center gap-6 px-4">
      <span className="whitespace-nowrap font-display text-[13px] font-bold tracking-wide text-navy">
        {text}
      </span>
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-navy/30" />
    </div>
  ))

  return (
    <section className="overflow-hidden bg-lime py-3.5">
      <div className="ticker-track">
        {row}
        {row}
      </div>
    </section>
  )
}
