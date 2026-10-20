'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Navigation, ChevronDown } from 'lucide-react'
import { gaEvent } from '@/lib/ga'
import type { TrailDetour } from '@/lib/roams/queries'

const DetourMap = dynamic(() => import('./DetourMap'), { ssr: false })

/** Google Maps bike directions through the detour's turns, in order. */
export function detourMapsUrl(waypoints: [number, number][]): string | null {
  if (waypoints.length < 2) return null
  const f = (p: [number, number]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`
  const params = new URLSearchParams({
    api: '1',
    origin: f(waypoints[0]),
    destination: f(waypoints[waypoints.length - 1]),
    travelmode: 'bicycling',
  })
  const mid = waypoints.slice(1, -1).slice(0, 8)
  if (mid.length) params.set('waypoints', mid.map(f).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * The detour, opened on tap: numbered turns, a small map (detour in blue,
 * closed stretch in red), and a button that opens the same turns in Google
 * Maps so the phone can guide the rider through them.
 */
export default function DetourPanel({
  id,
  detours,
  closed,
  bare = false,
}: {
  id: string
  detours: TrailDetour[]
  /** [lng, lat][] */
  closed: [number, number][] | null
  /** Already inside an opened notice: show the detour with no toggle of its own. */
  bare?: boolean
}) {
  const [toggled, setOpen] = useState(false)
  const open = bare || toggled
  const [dir, setDir] = useState(0)
  const d = detours[dir] ?? detours[0]
  const label = d?.label ?? null
  const steps = d?.steps ?? []
  const geometry = d?.geometry ?? null
  const note = d?.note ?? null
  const mapsUrl = d?.waypoints ? detourMapsUrl(d.waypoints) : null

  return (
    <div className="mt-1">
      {!bare && (
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`detour-${id}`}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) gaEvent('roam_detour_opened', { disruption: id })
        }}
        className="inline-flex min-h-[44px] items-center gap-1 text-[0.9375rem] font-semibold text-[#9A3412] underline underline-offset-4"
      >
        {open ? 'Hide the detour' : 'Show the detour'}
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      )}

      {open && (
        <div id={`detour-${id}`} className={`${bare ? "mt-3" : "mt-1"} grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`}>
          <div className="min-w-0">
            {detours.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Direction">
                {detours.map((x, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={i === dir}
                    onClick={() => setDir(i)}
                    className={`min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-semibold ${i === dir ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}
                  >
                    {x.label ?? `Direction ${i + 1}`}
                  </button>
                ))}
              </div>
            ) : (
              label && <p className="text-[0.875rem] font-semibold text-navy">{label}</p>
            )}
            <ol className="mt-2 space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[0.9375rem] leading-snug text-navy">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2966E5] text-[0.75rem] font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            {note && <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-soft">{note}</p>}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => gaEvent('roam_detour_maps_opened', { disruption: id })}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-navy px-4 text-[0.9375rem] font-semibold text-white hover:bg-navy/90"
              >
                <Navigation size={15} aria-hidden /> Open the detour in Google Maps
              </a>
            )}
          </div>
          {geometry && geometry.length >= 2 && (
            <div>
              <div className="h-[240px] overflow-hidden rounded-[12px] border border-navy/10">
                <DetourMap detour={geometry} closed={closed} />
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 text-[0.8125rem] text-ink-soft">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-4 rounded bg-[#2966E5]" aria-hidden /> Detour</span>
                {closed && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-4 rounded bg-[#B91C1C]" aria-hidden /> Closed</span>}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
