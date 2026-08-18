import type { Metadata, Viewport } from 'next'
import QRCode from 'qrcode'
import { parseSnapshotParams, buildShareUrl, stickyParams, isOutsideArea } from '@/lib/nearby/share'
import { splitPlaceLabel } from '@/lib/nearby/neighborhood'
import { fetchPopularBikeStreets } from '@/lib/nearby/popularity'
import { parsePartnerSlug, fetchPartner } from '@/lib/nearby/partner'
import { canonicalStreetKey } from '@/lib/nearby/street-names'
import { getStopTopology } from '@/lib/server/mbta-topology'
import { getCorridorMeta, type CorridorMetaResult } from '@/lib/server/corridor-meta'
import { getReach } from '@/lib/server/reach'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import { getBikeNetwork } from '@/lib/server/bike-network'
import { corridorsFromTopology, buildBikeCorridors, SNAPSHOT_RAIL_TYPES, SNAPSHOT_MAX_STOPS, SNAPSHOT_RAIL_MAX_STATIONS } from '@/lib/nearby/corridors'
import { protectionLabel } from '@/lib/nearby/bike-labels'
import { modeOptions } from '@/lib/nearby/reach-ui'
import { bikeTimeMinutes } from '@/lib/geo/measure'
import { decodePolyline } from '@/lib/geo/polyline'
import { buildPrintStations, shortFrequencyLabel } from '@/lib/nearby/print-model'
import PrintMap, { PrintMarkerIcon, type PrintLine, type PrintMarker } from './PrintMap'
import PrintButton from './PrintButton'
import SheetViewport from './SheetViewport'

/**
 * The static print snapshot — the master for mailers, brochures, and
 * onboarding-packet one-pagers. One letter page per neighborhood: static
 * map, stations with weekday frequencies (never live arrivals — stale the
 * moment it leaves the printer), honest bike-route labels, Bluebikes docks,
 * destination times, and a QR code to the live interactive page. Fully
 * server-rendered from the same shared libs the interactive page uses;
 * the only client JS is the print button.
 */

const SITE_URL = 'https://gogreenstreets.org'
// The real GSI wordmark (brand-assets bucket, same file the employer PDFs
// use) — printed pieces must carry the actual mark, not styled text
const GSI_WORDMARK = 'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/gsi-wordmark.png'
// Sized so header + map + legend + columns + destinations + QR footer land
// on ONE letter page (10.2in printable ≈ 980 CSS px) — check the PDF after
// growing anything here
const MAP_W = 720
const MAP_H = 264
const MAX_PRINT_TRANSIT = 8
// The bike column runs shorter than the transit column, so a fifth route is
// vertically free
const MAX_PRINT_BIKE = 5
const MAX_PRINT_DOCKS = 3
const MAX_PRINT_DESTINATIONS = 6

export const metadata: Metadata = {
  title: 'Print your neighborhood snapshot — Green Streets Initiative',
  robots: { index: false },
}

// The page is a fixed letter-sheet layout — on phones it should render
// scaled to fit (pinch-zoomable), not reflow into a cramped column. The
// SheetViewport client component enforces this; see its comment for why
// the declarative export doesn't fire on this route.
export const viewport: Viewport = {
  width: 800,
}

export const maxDuration = 60

const MODE_LABEL: Record<string, string> = { walk: 'Walk', bike: 'Bike', transit: 'T & bus' }

export default async function NearbyPrintPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') params.set(k, v)
  }
  const loc = parseSnapshotParams(params)

  if (!loc) return <PrintGate />

  const outside = isOutsideArea(loc.lat, loc.lng)
  const label = loc.label || 'your neighborhood'
  // The QR keeps the partner/utm params, so a scanned print lands on the
  // co-branded interactive page and the visit still attributes
  const shareUrl = `${SITE_URL}${buildShareUrl(loc.lat, loc.lng, loc.label, stickyParams(params.toString()))}`
  const shortUrl = shareUrl.replace(/^https:\/\//, '')

  const [busTopo, railTopo, reach, docks, network, qrSvg, popularStreetKeys, partner] = await Promise.all([
    getStopTopology(loc.lat, loc.lng, { routeTypes: '3', radiusDeg: 0.01, nameStyle: 'short', maxStops: SNAPSHOT_MAX_STOPS }).catch(() => []),
    getStopTopology(loc.lat, loc.lng, { routeTypes: SNAPSHOT_RAIL_TYPES, radiusDeg: 0.02, nameStyle: 'long', maxStops: SNAPSHOT_RAIL_MAX_STATIONS, perStation: true }).catch(() => []),
    getReach(loc.lat, loc.lng).catch(() => ({ destinations: [] })),
    getBluebikesDocks(loc.lat, loc.lng),
    getBikeNetwork(loc.lat, loc.lng, 1.5).catch(() => null),
    QRCode.toString(shareUrl, { type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' } }),
    // "Popular with Shift riders" markers — the label param carries
    // "Neighborhood, Town", and the lookup fails soft to an empty set
    fetchPopularBikeStreets(splitPlaceLabel(loc.label ?? '').town),
    // Partner co-brand for outreach prints; null (default header) on any miss
    fetchPartner(parsePartnerSlug(params)),
  ])

  // Shapes + weekday frequency per transit corridor; failures degrade to
  // "see live schedule online" per line rather than failing the page.
  // Rail first: the topology sorts by walk distance, and in bus-dense areas
  // every bus route is closer than the T — which silently dropped the T
  // lines' shapes (no rail on the printed map) and their frequencies.
  const allCorridors = corridorsFromTopology(railTopo, busTopo)
  const corridors = [
    ...allCorridors.filter(c => c.kind !== 'bus'),
    ...allCorridors.filter(c => c.kind === 'bus'),
  ].slice(0, MAX_PRINT_TRANSIT)
  const metaByRoute = new Map<string, CorridorMetaResult>()
  await Promise.allSettled(corridors.map(async c => {
    metaByRoute.set(c.routeId, await getCorridorMeta(c.routeId, c.access.stopId))
  }))

  const freqByRoute = new Map<string, string | null>()
  for (const [routeId, meta] of metaByRoute) freqByRoute.set(routeId, shortFrequencyLabel(meta.frequency))

  const stations = buildPrintStations(railTopo, busTopo, freqByRoute)

  const bikeBuild = network ? buildBikeCorridors(network.geojson, loc.lat, loc.lng) : { corridors: [] }
  const bikeCorridors = bikeBuild.corridors.slice(0, MAX_PRINT_BIKE)

  const destinations = reach.destinations.slice(0, MAX_PRINT_DESTINATIONS)
  const printDocks = docks.slice(0, MAX_PRINT_DOCKS)

  // Map layers, bottom to top: full lane network (thin) → named bike
  // corridors → bus shapes → rail shapes, so the highest-signal lines stay
  // on top
  const lines: PrintLine[] = []

  // EVERY mapped lane draws as a thin background line, exactly like the
  // interactive map — only bolding the top corridors made whole streets of
  // real infrastructure (Somerville Ave's painted lanes) vanish from paper.
  // The bold corridors re-draw over their own thin twins, so no dedupe
  // bookkeeping is needed. Bounds-filtered to what the ~1 mi viewport can
  // show; the network load radius (1.5 mi) is wider than the map.
  const QUALITY_COLOR: Record<string, string> = { path: '#BAF14D', protected: '#2DD4BF', painted: '#7FB5FF' }
  const drawnTiers = new Set<string>()
  const inMapBox = (coords: [number, number][]) =>
    coords.some(([x, y]) => Math.abs(y - loc.lat) < 0.011 && Math.abs(x - loc.lng) < 0.03)
  if (network) {
    for (const f of network.geojson.features) {
      if (f.geometry.type !== 'LineString') continue
      const coords = f.geometry.coordinates as [number, number][]
      if (!inMapBox(coords)) continue
      const quality = (f.properties as { quality?: string })?.quality ?? 'painted'
      drawnTiers.add(quality)
      lines.push({
        coords,
        color: QUALITY_COLOR[quality] ?? '#7FB5FF',
        dashed: quality === 'painted',
        thin: true,
      })
    }
  }

  const bikeByTier = [...bikeCorridors].sort((a, b) =>
    (a.protection === 'painted' ? 0 : 1) - (b.protection === 'painted' ? 0 : 1))
  for (const c of bikeByTier) {
    drawnTiers.add(c.protection === 'path' ? 'path' : c.protection === 'painted' ? 'painted' : 'protected')
    for (const f of c.geojson.features) {
      if (f.geometry.type !== 'LineString') continue
      lines.push({
        coords: f.geometry.coordinates as [number, number][],
        color: (f.properties as { color?: string })?.color ?? '#2DD4BF',
        dashed: c.protection === 'painted',
      })
    }
  }
  const transitByKind = [...corridors].sort((a, b) =>
    (a.kind === 'bus' ? 0 : 1) - (b.kind === 'bus' ? 0 : 1))
  for (const c of transitByKind) {
    const meta = metaByRoute.get(c.routeId)
    for (const encoded of (meta?.polylines ?? []).slice(0, 2)) {
      lines.push({
        coords: decodePolyline(encoded).map(([plat, plng]) => [plng, plat] as [number, number]),
        color: c.color,
      })
    }
  }

  // Every listed station gets a name label (the dedupe caps this at ~8);
  // markers carry the same Phosphor glyphs as the interactive map's pins
  const markers: PrintMarker[] = [
    ...stations.map(s => ({
      lat: s.lat, lng: s.lng, kind: s.isRail ? ('rail' as const) : ('bus' as const),
      color: s.lines[0]?.color ?? '#191A2E',
      label: s.name,
    })),
    ...printDocks.map(d => ({ lat: d.lat, lng: d.lng, kind: 'dock' as const })),
  ]

  const legend: { swatch: React.ReactNode; label: string }[] = []
  if (railTopo.length > 0) legend.push({ swatch: <LegendLine color="#DA291C" />, label: 'T lines (line colors)' })
  if (busTopo.length > 0) legend.push({ swatch: <LegendLine color="#FFC72C" />, label: 'Bus routes' })
  if (drawnTiers.has('path')) legend.push({ swatch: <LegendLine color="#BAF14D" />, label: 'Multi-use path' })
  if (drawnTiers.has('protected')) legend.push({ swatch: <LegendLine color="#2DD4BF" />, label: 'Separated bike lane' })
  if (drawnTiers.has('painted')) legend.push({ swatch: <LegendLine color="#7FB5FF" dashed />, label: 'Painted bike lane' })
  if (stations.some(s => s.isRail)) legend.push({ swatch: <PrintMarkerIcon kind="rail" color="#DA291C" size={13} />, label: 'T station' })
  if (stations.some(s => !s.isRail)) legend.push({ swatch: <PrintMarkerIcon kind="bus" size={13} />, label: 'Bus stop' })
  if (printDocks.length > 0) legend.push({ swatch: <PrintMarkerIcon kind="dock" size={13} />, label: 'Bluebikes dock' })

  return (
    <main className="print-root min-h-screen bg-white text-[#191A2E]">
      <SheetViewport />
      <style>{`
        @page { size: letter; margin: 0.4in 0.5in; }
        @media print {
          body { background: white !important; }
          .print-no-print { display: none !important; }
          .print-root { background: white !important; min-height: 0 !important; }
          body > :not(.print-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .print-article { padding: 0 !important; max-width: none !important; }
          .print-card { break-inside: avoid; }
        }
        .print-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen toolbar — hidden in print */}
      <div className="print-no-print flex items-center justify-between gap-4 bg-[#191A2E] px-6 py-3">
        <p className="text-sm text-white/80">
          Sized for letter paper — on a computer, Chrome gives the most faithful print. On a phone, the button opens your
          system&apos;s print sheet, where you can also save a PDF to share.
        </p>
        <PrintButton />
      </div>

      <article className="print-article mx-auto max-w-[760px] px-5 py-5">
        {/* Header. The right block always leads with the real GSI wordmark —
            printed pieces are our brand's face, so the mark itself must be on
            paper, not just green text (the eyebrow drops the org name so it
            doesn't say it twice). Partnered prints stack "In partnership
            with" + the partner's logo beneath it: both marks, ours first. */}
        <header className="mb-2.5 flex items-end justify-between gap-4">
          <div>
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#4A7729]">
              Your neighborhood snapshot
            </div>
            <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">
              Getting around {label}
            </h1>
          </div>
          <div className="flex max-w-[260px] flex-col items-end gap-1 text-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GSI_WORDMARK} alt="Green Streets Initiative" className="max-h-[26px] w-auto" />
            {partner ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[0.7rem] leading-snug text-[#191A2E]/80">
                  In partnership with{partner.logoUrl ? '' : <> <span className="font-semibold text-[#191A2E]">{partner.name}</span></>}
                </span>
                {partner.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={partner.logoUrl} alt={partner.name} className="max-h-[24px] w-auto" />
                )}
              </div>
            ) : (
              <p className="text-[0.7rem] leading-snug text-[#191A2E]/70">
                The trains, buses, bike routes, and Bluebikes within reach of your new home.
              </p>
            )}
          </div>
        </header>

        {outside && (
          <p className="print-card mb-3 rounded-lg border border-[#B7791F]/40 bg-[#FEF6E7] px-4 py-2.5 text-[0.8rem] leading-snug">
            This spot is outside Greater Boston, where our transit and Bluebikes data lives — parts of this page may be sparse. Bike-path data covers all of Massachusetts.
          </p>
        )}

        {/* Map + legend */}
        <div className="print-card overflow-hidden rounded-xl border border-[#191A2E]/15">
          <PrintMap center={loc} lines={lines} markers={markers} width={MAP_W} height={MAP_H} />
        </div>
        {legend.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-[#191A2E]/80">
            {legend.map((l, i) => (
              <span key={i} className="flex items-center gap-1.5">{l.swatch}{l.label}</span>
            ))}
          </div>
        )}

        {/* Two columns: transit | bike + docks */}
        <div className="mt-2.5 grid grid-cols-2 gap-5">
          <section className="print-card">
            <h2 className="mb-2 text-[0.72rem] font-bold uppercase tracking-wider text-[#191A2E]/70">
              Trains &amp; buses near you
            </h2>
            {stations.length === 0 && (
              <p className="text-[0.8rem] text-[#191A2E]/70">No MBTA stations within a short walk of this spot.</p>
            )}
            <div className="space-y-2">
              {stations.map(s => (
                <div key={s.name}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.85rem] font-bold">{s.name}</span>
                    <span className="shrink-0 text-[0.72rem] text-[#191A2E]/70">{s.walkMin} min walk</span>
                  </div>
                  {s.lines.map(l => (
                    <div key={l.routeId} className="mt-0.5 flex items-baseline gap-1.5">
                      <span
                        className="shrink-0 rounded px-1.5 py-px text-[0.62rem] font-bold"
                        style={{ backgroundColor: l.color, color: l.textColor }}
                      >
                        {l.label}
                      </span>
                      <span className="min-w-0 text-[0.68rem] leading-snug text-[#191A2E]/80">
                        {l.endpoints && <span className="font-semibold text-[#191A2E]/90">{l.endpoints}</span>}
                        {l.endpoints && l.frequencyLabel && ' · '}
                        {l.frequencyLabel ?? (l.endpoints ? '' : 'see live schedule online')}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {stations.length > 0 && (
              <p className="mt-1.5 text-[0.65rem] text-[#191A2E]/60">
                Weekday daytime frequencies — scan the code for live arrivals.
              </p>
            )}
          </section>

          <section className="print-card">
            <h2 className="mb-2 text-[0.72rem] font-bold uppercase tracking-wider text-[#191A2E]/70">
              Comfortable bike routes
            </h2>
            {bikeCorridors.length === 0 && (
              <p className="text-[0.8rem] text-[#191A2E]/70">No mapped bike routes within riding distance yet.</p>
            )}
            <div className="space-y-1.5">
              {bikeCorridors.map(c => (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.85rem] font-bold">{c.name}</span>
                    <span className="shrink-0 text-[0.72rem] text-[#191A2E]/70">
                      {bikeTimeMinutes(c.accessDistanceMeters)} min ride away
                    </span>
                  </div>
                  <div className="text-[0.7rem] text-[#191A2E]/80">
                    {protectionLabel(c.protection, c.onewayOnly).text} · {c.lengthMiles} mi through the area
                    {popularStreetKeys.has(canonicalStreetKey(c.name)) && (
                      <span className="font-semibold text-[#4A7729]"> · Popular with Shift riders</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {printDocks.length > 0 && (
              <>
                <h2 className="mb-1 mt-3 text-[0.72rem] font-bold uppercase tracking-wider text-[#191A2E]/70">
                  Bluebikes docks
                </h2>
                <p className="text-[0.75rem] leading-snug text-[#191A2E]/85">
                  {printDocks.map((d, i) => (
                    <span key={d.station_id}>
                      {i > 0 && ' · '}
                      <span className="font-semibold text-[#191A2E]">{d.name}</span>
                      {` (${Math.round(d.distance_meters / 80)} min walk)`}
                    </span>
                  ))}
                </p>
              </>
            )}

            {/* QR rides in this column's slack (the transit column nearly
                always runs longer) instead of costing page height below */}
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#191A2E]/15 p-2.5">
              <div className="h-[70px] w-[70px] shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div className="min-w-0">
                <p className="text-[0.78rem] font-bold leading-snug">
                  Scan for the live version — real-time arrivals on a tappable map.
                </p>
                <p className="mt-0.5 break-all text-[0.68rem] font-semibold text-[#4A7729]">{shortUrl}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Destinations */}
        {destinations.length > 0 && (
          <section className="print-card mt-2.5">
            <h2 className="mb-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-[#191A2E]/70">
              Where can you get from here?
            </h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {destinations.map(row => (
                <div key={row.id} className="flex items-baseline justify-between gap-2 border-b border-[#191A2E]/10 pb-0.5">
                  <span className="min-w-0 truncate text-[0.78rem] font-semibold">{row.name}</span>
                  <span className="shrink-0 text-[0.68rem] tabular-nums text-[#191A2E]/80">
                    {modeOptions(row).map(o => `${MODE_LABEL[o.key] ?? o.key} ${o.estimate ? '~' : ''}${o.minutes}`).join(' · ')} min
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[0.62rem] text-[#191A2E]/60">
              Times assume a weekday morning; ~ marks an estimate.
            </p>
          </section>
        )}

        {/* Footer: attribution only — the QR lives up in the bike column */}
        <footer className="print-card mt-2.5 border-t border-[#191A2E]/15 pt-1.5">
          <p className="text-[0.62rem] leading-snug text-[#191A2E]/60">
            Green Streets Initiative, a 501(c)(3) · gogreenstreets.org · Data: MBTA · MAPC TrailMap · MassDOT ·
            Bluebikes · OpenStreetMap contributors · Map © OpenStreetMap contributors © CARTO
          </p>
        </footer>
      </article>
    </main>
  )
}

function LegendLine({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      className="inline-block h-[3px] w-6 rounded"
      style={dashed
        ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 9px)` }
        : { backgroundColor: color }}
    />
  )
}

/** No-coordinates visit: point at the interactive page instead of erroring. */
async function PrintGate() {
  const qrSvg = await QRCode.toString(`${SITE_URL}/nearby`, {
    type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' },
  })
  return (
    <main className="print-root flex min-h-screen items-center justify-center bg-white px-6 text-[#191A2E]">
      <div className="max-w-[420px] rounded-2xl border border-[#191A2E]/15 p-8 text-center">
        <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#4A7729]">
          Green Streets Initiative
        </div>
        <h1 className="mt-1 font-display text-[1.4rem] font-extrabold tracking-tight">
          Print a neighborhood snapshot
        </h1>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-[#191A2E]/80">
          Open <strong>gogreenstreets.org/nearby</strong>, pick a location, and follow the print link there — this page needs a neighborhood to draw.
        </p>
        <div className="mx-auto mt-4 h-[110px] w-[110px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
    </main>
  )
}
