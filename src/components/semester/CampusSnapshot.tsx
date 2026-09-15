import { Bicycle, MapTrifold, Train } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import type { NearbySnapshotModel, NearbySnapshotOptions } from '@/lib/server/nearby-snapshot-model'
import StaticMapSvg from '@/components/nearby/StaticMapSvg'
import { PrintMarkerIcon } from '@/app/nearby/print/PrintMap'
import { LANE_TIER_COLOR, RASTER_TILE_ATTRIBUTION } from '@/lib/nearby/static-map'
import { shuttleAgencyFor } from '@/lib/nearby/shuttle-agencies'
import { protectionLabel } from '@/lib/nearby/bike-labels'
import { modeOptions } from '@/lib/nearby/reach-ui'
import { bikeTimeMinutes, walkTimeMinutes } from '@/lib/geo/measure'
import { t } from '@/lib/nearby/i18n'

/*
 * What's around campus, as the /nearby page knows it: the static map with
 * transit shapes, bike corridors, and mode markers, then the stations with
 * weekday frequencies, the comfortable bike routes and docks, and where you
 * can get to with the time by the fastest way. All server-rendered from the
 * shared snapshot model; live arrivals stay on the live map, which the
 * whole map block opens centred on campus.
 */

export const MAP_W = 900
export const MAP_H = 400

/** What the block draws. `mapHalf` is a superset of what the frame can
 *  show at its widest zoom, so no lane in view is trimmed. */
export const CAMPUS_SNAPSHOT_OPTS: NearbySnapshotOptions = {
  maxTransit: 8,
  maxBike: 4,
  maxDocks: 3,
  maxDestinations: 6,
  mapHalf: { lat: 0.016, lng: 0.05 },
}
const MAX_STATIONS = 6
// Tight enough that a station across open water (UMass Boston's Quincy
// ferry, 2 mi off) stays outside the frame instead of shrinking campus.
const MAP_MAX_HALF = { lat: 0.009, lng: 0.02 }

const tr = (key: string, r?: Record<string, string | number | null | undefined>) => t('en', key, r)

function ColumnHeading({ icon: IconC, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest/50 text-forest">
        <IconC size={18} aria-hidden />
      </span>
      <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{children}</h3>
    </div>
  )
}

function LegendLine({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width={22} height={8} aria-hidden>
      <line x1={1} y1={4} x2={21} y2={4} stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  )
}

export default function CampusSnapshot({
  model,
  lat,
  lng,
  href,
  shortName,
}: {
  model: NearbySnapshotModel
  lat: number
  lng: number
  href: string
  shortName: string
}) {
  const stations = model.stations.slice(0, MAX_STATIONS)
  const markers = [{ lat, lng, kind: 'home' as const, label: shortName }, ...model.markers]

  const legend: { swatch: React.ReactNode; label: string }[] = []
  if (model.hasRail) legend.push({ swatch: <LegendLine color="#DA291C" />, label: 'T lines' })
  if (model.hasBus) legend.push({ swatch: <LegendLine color="#FFC72C" />, label: 'Bus routes' })
  if (model.drawnTiers.has('path')) legend.push({ swatch: <LegendLine color={LANE_TIER_COLOR.path} />, label: 'Shared use path' })
  if (model.drawnTiers.has('protected')) legend.push({ swatch: <LegendLine color={LANE_TIER_COLOR.protected} />, label: 'Separated bike lane' })
  if (model.drawnTiers.has('painted')) legend.push({ swatch: <LegendLine color={LANE_TIER_COLOR.painted} dashed />, label: 'Painted bike lane' })
  if (stations.some(s => s.isRail)) legend.push({ swatch: <PrintMarkerIcon kind="rail" color="#DA291C" size={14} />, label: 'T station' })
  if (stations.some(s => !s.isRail && !s.isShuttle)) legend.push({ swatch: <PrintMarkerIcon kind="bus" size={14} />, label: 'Bus stop' })
  if (stations.some(s => s.isShuttle)) legend.push({ swatch: <PrintMarkerIcon kind="shuttle" size={14} />, label: 'Campus shuttle stop' })
  if (model.docks.length > 0) legend.push({ swatch: <PrintMarkerIcon kind="dock" size={14} />, label: 'Bluebikes dock' })

  const hasTransit = stations.length > 0
  const hasBike = model.bikeCorridors.length > 0 || model.docks.length > 0
  const hasReach = model.destinations.length > 0
  const columns = [hasTransit, hasBike, hasReach].filter(Boolean).length

  return (
    <div>
      {/* 4:3 on phones, wide on desktop — the SVG covers the box, so the
          phone frame is the desktop frame with its sides cropped */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-navy/10 bg-[#E9EFE3] md:aspect-[9/4]">
        <StaticMapSvg
          center={{ lat, lng }}
          lines={model.lines}
          markers={markers}
          width={MAP_W}
          height={MAP_H}
          maxHalf={MAP_MAX_HALF}
          className="absolute inset-0 h-full w-full"
          title={`Map of transit, bike routes, and bike share around ${shortName}`}
        />
        <a
          href={href}
          className="group absolute inset-0 flex items-end p-4 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-forest md:p-5"
          aria-label={`Open the live map around ${shortName}`}
        >
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-full border border-navy/10 bg-white/95 px-3.5 py-2 text-[13px] text-navy shadow-sm md:px-4 md:py-2.5 md:text-[14px]">
            <span className="text-ink-soft">Live arrivals, every route</span>
            <span className="font-semibold text-forest group-hover:underline">Open the {shortName} map &rarr;</span>
          </span>
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        {legend.map((l, i) => (
          <span key={i} className="flex items-center gap-1.5">{l.swatch}{l.label}</span>
        ))}
        <span className="ml-auto text-[11px]">{RASTER_TILE_ATTRIBUTION}.</span>
      </div>

      {columns > 0 && (
        <div className={`mt-8 grid gap-8 ${columns === 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : ''}`}>
          {hasTransit && (
            <div>
              <ColumnHeading icon={Train}>Trains &amp; buses</ColumnHeading>
              {model.anyFar && (
                <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                  Nothing stops within a short walk of campus, so these are the nearest options.
                </p>
              )}
              <ul className="mt-3 border-t border-navy/15">
                {stations.map(s => {
                  const agency = s.isShuttle ? shuttleAgencyFor(s.lines[0]?.routeId ?? '') : null
                  return (
                    <li key={s.name} className="border-b border-navy/15 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[16px] font-semibold leading-snug text-navy">{s.name}</span>
                        <span className="shrink-0 text-[13px] text-ink-soft">{s.walkMin} min walk</span>
                      </div>
                      {agency && (
                        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                          {agency.name} · {tr(`shuttle.access_${agency.access.replace('-', '_')}`, { operator: agency.idName })}
                        </p>
                      )}
                      {/* A shuttle stop's operator line already names the
                          shuttle; its single route chip would say it again. */}
                      {(!s.isShuttle || s.lines.length > 1) && s.lines.map(l => (
                        <div key={l.routeId} className="mt-1.5 flex items-baseline gap-2">
                          <span
                            className="shrink-0 rounded px-1.5 py-px text-[11px] font-bold"
                            style={{ backgroundColor: l.color, color: l.textColor }}
                          >
                            {l.label}
                          </span>
                          <span className="min-w-0 text-[13px] leading-snug text-ink-soft">
                            {l.endpoints && <span className="font-medium text-navy">{l.endpoints}</span>}
                            {l.endpoints && l.frequencyLabel && ' · '}
                            {l.frequencyLabel ?? (l.endpoints ? '' : s.isShuttle ? 'see the shuttle schedule' : 'see the live schedule')}
                          </span>
                        </div>
                      ))}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[12px] text-ink-soft">Weekday daytime frequencies. The live map has real-time arrivals.</p>
            </div>
          )}

          {hasBike && (
            <div>
              <ColumnHeading icon={Bicycle}>Bike routes</ColumnHeading>
              {model.bikeCorridors.length > 0 ? (
                <ul className="mt-3 border-t border-navy/15">
                  {model.bikeCorridors.map(c => {
                    const label = protectionLabel(c.protection, c.onewayOnly, tr)
                    return (
                      <li key={c.id} className="border-b border-navy/15 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[16px] font-semibold leading-snug text-navy">{c.name}</span>
                          <span className="shrink-0 text-[13px] text-ink-soft">{bikeTimeMinutes(c.accessDistanceMeters)} min ride away</span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                          <span className={label.emphasis ? 'font-medium text-navy' : ''}>{label.text}</span> · {c.lengthMiles} mi through the area
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">No mapped bike routes within riding distance yet.</p>
              )}
              {model.docks.length > 0 && (
                <>
                  <h4 className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Bluebikes docks</h4>
                  <ul className="mt-1.5 border-t border-navy/15">
                    {model.docks.map(d => (
                      <li key={d.station_id} className="flex items-baseline justify-between gap-3 border-b border-navy/15 py-2.5">
                        <span className="text-[15px] leading-snug text-navy">{d.name}</span>
                        <span className="shrink-0 text-[13px] text-ink-soft">{walkTimeMinutes(d.distance_meters)} min walk</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {hasReach && (
            <div>
              <ColumnHeading icon={MapTrifold}>Where you can get to</ColumnHeading>
              <ul className="mt-3 border-t border-navy/15">
                {model.destinations.map(row => {
                  const options = modeOptions(row)
                  return (
                    <li key={row.id} className="border-b border-navy/15 py-3">
                      <span className="text-[16px] font-semibold leading-snug text-navy">{row.name}</span>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-soft tabular-nums">
                        {options.map((o, i) => (
                          <span key={o.key}>
                            {i > 0 && ' · '}
                            <span className={i === 0 ? 'font-medium text-navy' : ''}>
                              {o.label} {o.estimate ? '~' : ''}{o.minutes} min
                            </span>
                          </span>
                        ))}
                      </p>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[12px] text-ink-soft">Weekday morning times; ~ marks an estimate.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
