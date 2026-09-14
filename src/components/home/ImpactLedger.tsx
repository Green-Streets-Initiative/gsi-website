import { createServerSupabaseClient } from '@/lib/supabase-server'
import { LANE, RouteSegment } from './RouteLine'

interface ImpactStats {
  total_dollars_saved: number
  total_co2_metric_tons: number
  total_active_trips: number
  total_users: number
  trips_this_month: number
  neighborhood_count: number
}

/** Round down to the nearest hundred and append "+"; exact under 100. */
function approx(n: number): string {
  if (n < 100) return n.toLocaleString('en-US')
  return (Math.floor(n / 100) * 100).toLocaleString('en-US') + '+'
}

async function fetchStats(): Promise<ImpactStats | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_global_impact_stats').single()
    if (error) {
      console.error('ImpactLedger: RPC error', error.message)
      return null
    }
    return data as ImpactStats
  } catch {
    return null
  }
}

export default async function ImpactLedger() {
  // No fabricated fallback: a failed read drops the section rather than
  // printing stale constants. Silence beats wrong numbers.
  const stats = await fetchStats()
  if (!stats) return null

  const asOf = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // A fourth slot is open here. It held `neighborhood_count`, labelled
  // "Massachusetts neighborhoods" — but that RPC field counts micro
  // neighborhoods (1,796 of them), so the label read as a claim to operate in
  // all of them. Pulled pending Keith's copy pass. Candidates already
  // available from the same RPC, no new query needed:
  //   total_active_trips  25,296  ("Active trips since launch")
  //   total_users            271
  const rows: { label: string; value: string }[] = [
    { label: 'Active trips this month', value: approx(stats.trips_this_month) },
    { label: 'Saved by commuters', value: '$' + Math.round(stats.total_dollars_saved).toLocaleString('en-US') },
    { label: 'Metric tons of CO₂ avoided', value: stats.total_co2_metric_tons.toFixed(1) },
  ]

  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="straight" />
        <div className="hidden md:block" />
        <div className="border-y border-navy/15 py-7">
          <dl className="grid gap-x-10 gap-y-4 md:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline gap-3 md:block">
                <dt className="order-2 text-[13px] leading-snug text-ink-soft md:order-none md:mt-1">{r.label}</dt>
                <dd className="order-1 font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:order-none md:text-[2.5rem]">
                  {r.value}
                </dd>
                <span className="order-1 hidden flex-1 border-b border-dotted border-navy/30 md:hidden" />
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-ink-soft">Live from the Shift app, as of {asOf}.</p>
        </div>
      </div>
    </section>
  )
}
