import { Bike, Bus, Footprints, Shuffle, ArrowRight, ExternalLink, Mountain, ParkingSquare, Lightbulb } from 'lucide-react'
import { roamDuration } from '@/components/roams/RoamCard'
import type { RoamCheckpoint, RoamLeg, RoamComfortSegment } from '@/lib/roams/queries'

/**
 * The route, stop by stop. Each stop is one card, and the stretch that leaves
 * it ("Next: bike 6.4 mi to Lexington Center") sits INSIDE that card, so the
 * detail belongs visibly to the stop it starts from (Keith 2026-10-19: the
 * old leg boxes sat closer to the next stop than their own). Bike stretches
 * carry the app's detail in one glance: a comfort bar and a one-line split
 * ("6.2 mi separated path · 0.3 mi on streets"), hills and bike parking.
 * (2026-10-20: the per-stretch list read as raw map data, and the shared
 * ComfortBar's own total could disagree with the leg's distance.)
 */

const MODE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  bike: Bike,
  walk: Footprints,
  transit: Bus,
  ferry: Bus,
  multi: Shuffle,
}

const MODE_VERB: Record<string, string> = { bike: 'Bike', walk: 'Walk', transit: 'Ride', ferry: 'Ferry', multi: 'Go' }

// One palette for the bar and its legend, dark enough to read on the light page.
const DOT: Record<string, string> = { separated: '#6A9A12', bike_lane: '#2966E5', street: '#C2410C' }
const KIND_LABEL: Record<string, string> = { separated: 'separated path', bike_lane: 'bike lane', street: 'on streets' }
const BUCKET: Record<string, string> = { protected: 'separated', path: 'separated', bike_lane: 'bike_lane', shared_road: 'street' }

function mi(n: number): string {
  const r = Math.round(n * 10) / 10
  return r < 0.1 ? '<0.1' : Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** Miles by kind of riding, in a fixed order: separated, bike lane, street. */
function split(segments: RoamComfortSegment[]): Array<{ kind: string; miles: number }> {
  const t: Record<string, number> = {}
  for (const s of segments) {
    if (!s || !(s.distance_mi > 0)) continue
    const k = BUCKET[s.rating] ?? 'street'
    t[k] = (t[k] ?? 0) + s.distance_mi
  }
  return ['separated', 'bike_lane', 'street'].filter((k) => (t[k] ?? 0) > 0).map((k) => ({ kind: k, miles: t[k] }))
}

/** The route's segments in order as one thin bar, each stretch its share of the length. */
function ComfortStrip({ segments }: { segments: RoamComfortSegment[] }) {
  const segs = segments.filter((s) => s && s.distance_mi > 0)
  const total = segs.reduce((a, s) => a + s.distance_mi, 0)
  const parts = split(segs)
  if (total <= 0) return null
  return (
    <div className="mt-3">
      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Route: ${parts.map((p) => `${mi(p.miles)} miles ${KIND_LABEL[p.kind]}`).join(', ')}`}>
        {segs.map((s, i) => (
          <span key={i} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.distance_mi / total) * 100}%`, minWidth: 3, backgroundColor: DOT[BUCKET[s.rating] ?? 'street'] }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] text-ink-soft">
        {parts.map((p) => (
          <span key={p.kind} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOT[p.kind] }} aria-hidden />
            <span><span className="font-semibold tabular-nums text-navy">{mi(p.miles)} mi</span> {KIND_LABEL[p.kind]}</span>
          </span>
        ))}
      </p>
    </div>
  )
}

function LegDetail({ leg, toLabel }: { leg: RoamLeg; toLabel: string | null }) {
  const Icon = MODE_ICON[leg.leg_type] ?? Footprints
  const meta = [
    leg.distance_miles != null ? `${mi(Number(leg.distance_miles))} mi` : null,
    leg.estimated_minutes != null ? roamDuration(leg.estimated_minutes) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mt-4 border-t border-navy/[0.08] pt-4">
      <div className="flex items-start gap-2.5">
        <Icon size={17} className="mt-0.5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold leading-snug text-navy">
            Next: {MODE_VERB[leg.leg_type] ?? 'Go'}
            {toLabel ? <> to {toLabel}</> : null}
          </p>
          {meta && <p className="text-[0.875rem] tabular-nums text-ink-soft">{meta}</p>}
        </div>
      </div>

      {leg.narrative_snippet && (
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{leg.narrative_snippet}</p>
      )}

      {leg.bike?.comfort_segments?.length ? <ComfortStrip segments={leg.bike.comfort_segments} /> : null}

      {(leg.bike?.elevation_summary || leg.bike?.bike_parking_note) && (
        <dl className="mt-3 space-y-1 text-[0.9375rem]">
          {leg.bike?.elevation_summary && (
            <div className="flex gap-2">
              <dt className="flex shrink-0 items-center gap-1.5 font-semibold text-navy">
                <Mountain size={14} className="text-ink-soft" aria-hidden /> Hills
              </dt>
              <dd className="m-0 text-ink-soft">{leg.bike.elevation_summary.replace(/\s+—\s+/g, ': ')}</dd>
            </div>
          )}
          {leg.bike?.bike_parking_note && (
            <div className="flex gap-2">
              <dt className="flex shrink-0 items-center gap-1.5 font-semibold text-navy">
                <ParkingSquare size={14} className="text-ink-soft" aria-hidden /> Bike parking
              </dt>
              <dd className="m-0 text-ink-soft">{leg.bike.bike_parking_note}</dd>
            </div>
          )}
        </dl>
      )}

      {leg.transit && (
        <dl className="mt-3 space-y-1 text-[0.9375rem]">
          {(leg.transit.route_name || leg.transit.board_stop_name) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {leg.transit.route_name && (
                <span className="rounded bg-forest/10 px-1.5 py-0.5 text-[0.8125rem] font-semibold text-forest">{leg.transit.route_name}</span>
              )}
              {leg.transit.board_stop_name && (
                <span className="text-navy">
                  Board at <span className="font-semibold">{leg.transit.board_stop_name}</span>
                </span>
              )}
              {leg.transit.alight_stop_name && (
                <>
                  <ArrowRight size={13} className="text-ink-soft" aria-hidden />
                  <span className="text-navy">{leg.transit.alight_stop_name}</span>
                </>
              )}
              {leg.transit.num_stops ? (
                <span className="text-ink-soft">
                  ({leg.transit.num_stops} {leg.transit.num_stops === 1 ? 'stop' : 'stops'}
                  {leg.transit.direction ? `, ${leg.transit.direction}` : ''})
                </span>
              ) : null}
            </div>
          )}
          {leg.transit.fare_note && <p className="text-ink-soft"><span className="font-semibold text-navy">Fare:</span> {leg.transit.fare_note}</p>}
          {leg.transit.transfer_note && <p className="text-ink-soft"><span className="font-semibold text-navy">Transfers:</span> {leg.transit.transfer_note}</p>}
          {leg.transit.boarding_tip && (
            <p className="flex gap-1.5 text-ink-soft">
              <Lightbulb size={14} className="mt-1 shrink-0 text-ink-soft" aria-hidden />
              {leg.transit.boarding_tip}
            </p>
          )}
        </dl>
      )}

      {leg.walk && (leg.walk.terrain_note || leg.walk.waypoint_note) && (
        <dl className="mt-3 space-y-1 text-[0.9375rem]">
          {leg.walk.terrain_note && <p className="text-ink-soft"><span className="font-semibold text-navy">Terrain:</span> {leg.walk.terrain_note}</p>}
          {leg.walk.waypoint_note && <p className="text-ink-soft"><span className="font-semibold text-navy">Along the way:</span> {leg.walk.waypoint_note}</p>}
        </dl>
      )}
    </div>
  )
}

function StopCard({
  stop,
  number,
  role,
  leg,
  nextLabel,
  dockLine,
}: {
  stop: RoamCheckpoint
  number: number
  role: 'start' | 'finish' | 'loop' | null
  leg: RoamLeg | null
  nextLabel: string | null
  dockLine: string | null
}) {
  return (
    <li id={`stop-${number}`} className="scroll-mt-32 rounded-[14px] border border-navy/10 bg-white px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-[0.875rem] font-bold text-white" aria-hidden>
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] font-semibold leading-snug text-navy">
            <span className="sr-only">Stop {number}: </span>
            {stop.label}
          </h3>
          {role && (
            <p className="text-[0.8125rem] font-semibold text-forest">
              {role === 'start' ? 'Start' : role === 'loop' ? 'Back at the start' : 'Finish'}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 sm:pl-[46px]">
        <div className="min-w-0">
          {stop.description && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{stop.description}</p>}
          {dockLine && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-navy">{dockLine}</p>}
          {stop.external_url && (
            <a
              href={stop.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-[0.875rem] font-semibold text-forest underline-offset-4 hover:underline"
            >
              About this stop <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </div>
      {leg && <LegDetail leg={leg} toLabel={nextLabel} />}
    </li>
  )
}

export default function RoamStopList({
  stops,
  bonus,
  legs,
  startDockLine,
}: {
  stops: RoamCheckpoint[]
  bonus: RoamCheckpoint[]
  legs: RoamLeg[]
  /** "Bluebikes: Alewife Station dock, 7 bikes now, 2 min walk" for the first stop. */
  startDockLine: string | null
}) {
  const legFrom = new Map(legs.filter((l) => l.from_checkpoint_id).map((l) => [l.from_checkpoint_id!, l]))
  const isLoop =
    stops.length > 2 &&
    Math.abs(stops[0].lat - stops[stops.length - 1].lat) < 0.0005 &&
    Math.abs(stops[0].lng - stops[stops.length - 1].lng) < 0.0005

  return (
    <div>
      <ol className="space-y-6">
        {stops.map((s, i) => {
          const leg = legFrom.get(s.id) ?? (legs.length === stops.length - 1 ? legs[i] ?? null : null)
          const next = i < stops.length - 1 ? stops[i + 1] : null
          const role = i === 0 ? 'start' : i === stops.length - 1 ? (isLoop ? 'loop' : 'finish') : null
          return (
            <StopCard
              key={s.id}
              stop={s}
              number={i + 1}
              role={role}
              leg={i < stops.length - 1 ? leg : null}
              nextLabel={next?.label ?? leg?.to_label ?? null}
              dockLine={i === 0 ? startDockLine : null}
            />
          )
        })}
      </ol>

      {bonus.length > 0 && (
        <div className="mt-8">
          <h3 className="text-[1.0625rem] font-semibold text-navy">Bonus stops</h3>
          <p className="mt-0.5 text-[0.9375rem] text-ink-soft">Optional detours near the route, worth the extra few minutes.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {bonus.map((c) => (
              <li key={c.id} className="rounded-[12px] border border-[#EDB93C]/50 bg-white px-4 py-3.5">
                <p className="text-[0.9375rem] font-semibold text-navy">{c.label}</p>
                {c.description && <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{c.description}</p>}
                {c.external_url && (
                  <a href={c.external_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-[0.875rem] font-semibold text-forest underline-offset-4 hover:underline">
                    About this stop <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
