'use client'

import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { BLUEBIKES_NOTE } from '@/lib/nearby/config'
import posthog from 'posthog-js'
import NearbyMap, { type NearbyMarker } from './NearbyMap'
import { userDotHtml, bluebikeHtml, protectedPathFlagHtml } from './markers'
import type { SectionData, BikeNetworkData } from './types'
import { SectionShell, SkeletonRows, ErrorCard } from './SectionShell'

interface Props {
  center: { lat: number; lng: number }
  bluebikes: SectionData<BluebikeStationLive[]>
  bikeNetwork: SectionData<BikeNetworkData | null>
  onRetry: () => void
}

export default function BikesSection({ center, bluebikes, bikeNetwork, onRetry }: Props) {
  const docks = bluebikes.data.slice(0, 8)
  const net = bikeNetwork.data
  const nearest = net?.nearest_protected ?? null

  const markers: NearbyMarker[] = [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
    ...docks.map(d => ({
      id: `dock-${d.station_id}`,
      lat: d.lat,
      lng: d.lng,
      html: bluebikeHtml(d.num_bikes_available, d.name),
      zIndex: 3,
    })),
    ...(nearest
      ? [{ id: 'nearest-path', lat: nearest.lat, lng: nearest.lng, html: protectedPathFlagHtml(nearest.name), zIndex: 5 }]
      : []),
  ]

  return (
    <SectionShell
      eyebrow="Getting around by bike"
      title="Bikes & bike lanes"
      subtitle="Bluebikes dock pins show how many bikes are there right now. Solid green lines are protected lanes and car-free paths; dashed blue are painted lanes."
    >
      <NearbyMap
        center={center}
        markers={markers}
        lines={net?.geojson ?? null}
        fitCount={5}
      />

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-white/75">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#BAF14D]" /> Protected lane / path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#7FB5FF] [background-image:repeating-linear-gradient(90deg,#7FB5FF_0_5px,transparent_5px_9px)]" /> Painted lane
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2B6CB0] text-[8px] font-bold text-white">4</span> Bluebikes (bikes now)
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {/* Nearest protected route callout */}
        {bikeNetwork.status === 'ready' && (
          nearest ? (
            <div className="rounded-xl border border-[rgba(186,241,77,0.25)] bg-[rgba(186,241,77,0.08)] px-5 py-4">
              <div className="text-[0.7rem] font-bold uppercase tracking-wider text-[#BAF14D]">
                Nearest protected route
              </div>
              <div className="mt-1 text-[0.95rem] font-semibold text-white">
                {nearest.name ?? 'Protected bike lane'}
                <span className="ml-2 font-normal text-white/80">
                  {formatDistance(nearest.distance_meters)} away · about {walkTimeMinutes(nearest.distance_meters)} min on foot
                </span>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
              No protected bike lanes within 3 miles of this spot in the data we check — painted lanes and quiet streets may still work well.
            </p>
          )
        )}
        {bikeNetwork.status === 'error' && (
          <ErrorCard label="Couldn't load the bike-lane network." onRetry={onRetry} />
        )}

        {/* Dock cards */}
        {bluebikes.status === 'loading' && <SkeletonRows count={2} />}
        {bluebikes.status === 'error' && <ErrorCard label="Couldn't reach Bluebikes right now." onRetry={onRetry} />}
        {bluebikes.status === 'ready' && docks.length === 0 && (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
            No Bluebikes docks within about a mile of this spot. The network grows every year — and your own bike works everywhere.
          </p>
        )}
        {docks.slice(0, 3).map(d => (
          <div key={d.station_id} className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[0.9rem] font-semibold text-white">{d.name}</span>
              <span className="text-[0.8rem] text-white/75">
                {walkTimeMinutes(d.distance_meters)} min walk · {formatDistance(d.distance_meters)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.8rem] text-white/80">
                <strong className="font-bold text-[#BAF14D]">{d.num_bikes_available} bikes</strong>
                {d.num_ebikes_available > 0 && <> ({d.num_ebikes_available} electric)</>}
                {' · '}{d.num_docks_available} open docks
              </span>
              <a
                href={directionsUrl(d.lat, d.lng)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'bluebike' })}
                className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
              >
                Walk there →
              </a>
            </div>
          </div>
        ))}

        <p className="px-1 text-[0.8rem] leading-relaxed text-white/75">{BLUEBIKES_NOTE}</p>
      </div>
    </SectionShell>
  )
}
