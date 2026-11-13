import { COMFORT_TIERS, comfortColor } from '@/lib/comfort-colors'

// A school route street by street, rated the way the ride planner rates a
// walk (route_corridors.comfort through published_route_cards, 01776). Same
// bar, walk words and colors as the admin route page
// (Shift shift-school/web/src/components/routes/RouteStretches.tsx) and the
// route map PDF (generate-asset). Parity gap gap-safe-routes-weak-scoring.

const WALK_LABELS: Record<string, string> = {
  path: 'Path',
  protected: 'Street with a protected lane',
  bike_lane: 'Street with a bike lane',
  quiet_street: 'Quiet street',
  shared_road: 'Busier street',
}

/** "0.3 mi", "0.05 mi": one decimal, two under a tenth. */
function formatMiles(mi: number): string {
  if (mi >= 0.095) return `${mi.toFixed(1)} mi`
  return `${Math.max(0.01, mi).toFixed(2)} mi`
}

export default function RouteComfortBar({
  segments,
}: {
  segments: { rating: string; distance_mi: number }[] | null | undefined
}) {
  const miles: Record<string, number> = {}
  for (const s of segments ?? []) {
    const mi = Number(s?.distance_mi) || 0
    if (mi > 0 && typeof s.rating === 'string') miles[s.rating] = (miles[s.rating] ?? 0) + mi
  }
  const total = Object.values(miles).reduce((a, b) => a + b, 0)
  const tiers = (COMFORT_TIERS as readonly string[])
    .filter((t) => miles[t] > 0)
    .map((t) => ({ rating: t, miles: miles[t], pct: (miles[t] / total) * 100 }))
  if (tiers.length === 0) return null
  const calm = Math.round(tiers.filter((t) => t.rating !== 'shared_road').reduce((a, t) => a + t.pct, 0))

  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-[#191A2E]">
        {calm}% on paths, quiet streets or streets with a bike lane
      </p>
      <div
        className="mt-2 flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={tiers.map((t) => `${Math.round(t.pct)}% ${WALK_LABELS[t.rating]}`).join(', ')}
      >
        {tiers.map((t) => (
          <span key={t.rating} style={{ width: `${t.pct}%`, backgroundColor: comfortColor(t.rating, true) }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {tiers.map((t) => (
          <li key={t.rating} className="flex items-center gap-1.5 text-[13px] text-[#4A4D68]">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: comfortColor(t.rating, true) }}
              aria-hidden
            />
            {WALK_LABELS[t.rating]} {formatMiles(t.miles)}
          </li>
        ))}
      </ul>
    </div>
  )
}
