import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Award, Bike, Bus, Footprints, Shuffle, MapPin, ArrowRight, Train, Info, Navigation, MapPinned, BadgeCheck } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import RoamMap from '@/components/roams/RoamMap'
import CreatorVideo, { parseVideoEmbed } from '@/components/roams/CreatorVideo'
import TrainsHome from '@/components/roams/TrainsHome'
import { roamMetaLine } from '@/components/roams/RoamCard'
import { withUtm } from '@/lib/utm'
import { PRICES } from '@/lib/facts/prices'
import { getRoamDetail, type RoamLeg, type RoamCheckpoint, type RoamDetail } from '@/lib/roams/queries'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

const MODE_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  bike: Bike,
  walk: Footprints,
  transit: Bus,
  ferry: Bus,
  multi: Shuffle,
}

const MIN_COMPLETIONS_TO_SHOW = 10

const COMFORT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  protected: { bg: 'bg-forest/10', text: 'text-forest', label: 'Protected path' },
  bike_lane: { bg: 'bg-blue/10', text: 'text-blue', label: 'Bike lane' },
  shared_road: { bg: 'bg-[#EDB93C]/15', text: 'text-[#8A6D1F]', label: 'Shared road' },
  mixed: { bg: 'bg-navy/[0.06]', text: 'text-ink-soft', label: 'Mixed' },
}

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const truncated = text.slice(0, maxLen)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastExcl = truncated.lastIndexOf('!')
  const lastQ = truncated.lastIndexOf('?')
  const best = Math.max(lastPeriod, lastExcl, lastQ)
  if (best > maxLen * 0.4) return text.slice(0, best + 1)
  return truncated.trimEnd() + '…'
}

/**
 * "How long is the Fresh Pond loop?" is the query these pages actually rank for,
 * so the distance leads both the title and the description. Same discipline as the
 * campus titles: answer the question the searcher typed, then invite them in.
 * Falls back to the previous wording whenever distance_miles is missing.
 */
function distancePhrase(miles: number | null): string | null {
  if (miles == null || !Number.isFinite(miles) || miles <= 0) return null
  // 2 -> "2", 2.25 -> "2.3" — one decimal is as precise as a route distance gets.
  const rounded = Math.round(miles * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}-mile`
}

/** 2 -> "2", 6.39 -> "6.4" */
function miles(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** 110 -> "about 1 hr 50 min", 42 -> "about 42 min" */
function duration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `about ${m} min`
  const h = Math.floor(m / 60)
  const rest = Math.round((m % 60) / 5) * 5
  return rest ? `about ${h} hr ${rest} min` : `about ${h} hr`
}

/**
 * The trail facts a searcher came for, as label/value rows. Only rows with
 * data render, so a roam with none of the new columns shows length and time
 * from what it already had. Start and end come from the required stops.
 */
function trailFacts(roam: RoamDetail, start: string | null, end: string | null): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const span = start && end && start !== end ? `${start} to ${end}` : null
  const section = roam.distance_miles != null && roam.distance_miles > 0 ? miles(roam.distance_miles) : null
  if (roam.full_trail_miles && section && roam.full_trail_miles > roam.distance_miles! + 0.2) {
    rows.push({
      label: 'Length',
      value: `${miles(roam.full_trail_miles)} miles end to end. This roam covers ${section} miles${span ? `, ${span}` : ''}.`,
    })
  } else if (section) {
    rows.push({ label: 'Length', value: `${section} miles${span ? `, ${span}` : ''}.` })
  } else if (span) {
    rows.push({ label: 'Route', value: `${span}.` })
  }

  const walkMin = roam.distance_miles ? (roam.distance_miles / PRICES.effort.walkMph) * 60 : null
  if (roam.mode === 'bike' && roam.estimated_minutes) {
    rows.push({
      label: 'Time',
      value: `${duration(roam.estimated_minutes)} by bike${walkMin ? `, ${duration(walkMin)} on foot` : ''}.`,
    })
  } else if (roam.mode === 'walk' && (roam.estimated_minutes || walkMin)) {
    rows.push({ label: 'Time', value: `${duration(roam.estimated_minutes ?? walkMin!)} on foot.` })
  } else if (roam.estimated_minutes) {
    rows.push({ label: 'Time', value: `${duration(roam.estimated_minutes)}, stops included.` })
  }

  if (roam.surface) rows.push({ label: 'Surface', value: roam.surface })
  if (roam.access_note) rows.push({ label: 'Get there', value: roam.access_note })
  if (roam.parking_note) rows.push({ label: 'Parking', value: roam.parking_note })
  // Each value is a sentence: "about 42 min" becomes "About 42 min".
  return rows.map((r) => ({ ...r, value: r.value.charAt(0).toUpperCase() + r.value.slice(1) }))
}

/**
 * Leg route summaries come from the route scorer as "Name — type (d mi)" lists,
 * where an unnamed segment is literally "Route". "Route — shared road (0.1 mi)"
 * means nothing to a reader, so it becomes "a short shared road link (0.1 mi)".
 */
function readableSegments(summary: string): string {
  return summary
    .split(/,\s+(?=[^()]*(?:\(|$))/)
    .map((seg) => seg.replace(/^Route\s+—\s+(.+?)\s+\(([^)]+)\)$/, 'a short $1 link ($2)').replace(/^LOVEJOY WHARF/, 'Lovejoy Wharf'))
    .join(', ')
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const roam = await getRoamDetail(decodeURIComponent(id))
  if (!roam) return { title: 'Roam not found' }
  const dist = distancePhrase(roam.distance_miles)
  // A trail page answers the search: length, where it starts, how to get there.
  const title = roam.full_trail_miles
    ? `${roam.name}: ${miles(roam.full_trail_miles)} miles, where to start, how to get there by T | Shift Roams`
    : `${roam.name} — a ${dist ? `${dist} ` : ''}guided ${roam.mode === 'multi' ? '' : `${roam.mode} `}route${roam.region ? ` in ${roam.region}` : ''} | Shift Roams`
  const editorial =
    roam.hook ??
    (roam.description ? truncateAtSentence(roam.description, 160) : null) ??
    `A guided ${roam.mode === 'multi' ? '' : `${roam.mode} `}route with ${roam.checkpoints.filter((c) => c.required).length} stops.`
  // Lead the snippet with the facts the query asked for, then the editorial hook.
  const facts = [
    dist ? dist.replace('-mile', ' miles') : null,
    roam.estimated_minutes ? `about ${roam.estimated_minutes} min` : null,
  ].filter(Boolean).join(' · ')
  const description = facts ? truncateAtSentence(`${facts} — ${editorial}`, 160) : editorial
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/shift/roams/${roam.id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/shift/roams/${roam.id}`,
      siteName: 'Green Streets Initiative',
      type: 'website',
      ...(roam.hero_image_url ? { images: [{ url: roam.hero_image_url }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/* ── Mode-specific detail sub-components ── */

function TransitDetail({ transit }: { transit: NonNullable<RoamLeg['transit']> }) {
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-navy/10 pt-2.5">
      {(transit.board_stop_name || transit.alight_stop_name) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
          <Train size={13} style={{ color: '#2D6A4F' }} />
          {transit.route_name && (
            <span className="rounded bg-forest/10 px-1.5 py-0.5 text-xs font-semibold text-forest">
              {transit.route_name}
            </span>
          )}
          {transit.board_stop_name && (
            <span className="text-ink-soft">Board at <span className="font-semibold text-navy">{transit.board_stop_name}</span></span>
          )}
          {transit.alight_stop_name && (
            <>
              <ArrowRight size={12} style={{ color: '#4A4D68' }} />
              <span className="text-ink-soft">{transit.alight_stop_name}</span>
            </>
          )}
          {transit.num_stops != null && transit.num_stops > 0 && (
            <span className="text-ink-soft">({transit.num_stops} {transit.num_stops === 1 ? 'stop' : 'stops'}{transit.direction ? `, ${transit.direction}` : ''})</span>
          )}
        </div>
      )}
      {transit.fare_note && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Fare:</span> {transit.fare_note}</p>
      )}
      {transit.transfer_note && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Transfers:</span> {transit.transfer_note}</p>
      )}
      {transit.boarding_tip && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Tip:</span> {transit.boarding_tip}</p>
      )}
    </div>
  )
}

function BikeDetail({ bike }: { bike: NonNullable<RoamLeg['bike']> }) {
  const comfort = bike.comfort_rating ? COMFORT_COLORS[bike.comfort_rating] ?? COMFORT_COLORS.mixed : null
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-navy/10 pt-2.5">
      {comfort && (
        <span className={`inline-block rounded-full ${comfort.bg} px-2.5 py-1 text-xs font-semibold ${comfort.text}`}>
          {comfort.label}
        </span>
      )}
      {bike.comfort_summary && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Along the way:</span> {readableSegments(bike.comfort_summary)}</p>
      )}
      {bike.elevation_summary && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Elevation:</span> {bike.elevation_summary}</p>
      )}
      {bike.bike_parking_note && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Parking:</span> {bike.bike_parking_note}</p>
      )}
    </div>
  )
}

function WalkDetail({ walk }: { walk: NonNullable<RoamLeg['walk']> }) {
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-navy/10 pt-2.5">
      {walk.terrain_note && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Terrain:</span> {walk.terrain_note}</p>
      )}
      {walk.waypoint_note && (
        <p className="text-[0.8125rem] text-ink-soft"><span className="text-ink-soft">Along the way:</span> {walk.waypoint_note}</p>
      )}
    </div>
  )
}

/* ── Timeline building ── */

type TimelineEntry =
  | { type: 'stop'; stop: RoamCheckpoint; stopNumber: number; isStart: boolean; isFinal: boolean }
  | { type: 'leg'; leg: RoamLeg }

function buildTimeline(stops: RoamCheckpoint[], legs: RoamLeg[]): TimelineEntry[] {
  if (legs.length === 0) {
    return stops.map((s, i) => ({
      type: 'stop' as const,
      stop: s,
      stopNumber: i + 1,
      isStart: i === 0,
      isFinal: i === stops.length - 1,
    }))
  }

  const entries: TimelineEntry[] = []
  const renderedStopIds = new Set<string>()

  const firstLeg = legs[0]
  const startStop = firstLeg.from_checkpoint_id
    ? stops.find((s) => s.id === firstLeg.from_checkpoint_id)
    : stops[0]

  let stopCounter = 0
  if (startStop) {
    stopCounter++
    entries.push({ type: 'stop', stop: startStop, stopNumber: stopCounter, isStart: true, isFinal: false })
    renderedStopIds.add(startStop.id)
  }

  for (const leg of legs) {
    entries.push({ type: 'leg', leg })

    if (leg.to_checkpoint_id) {
      const destStop = stops.find((s) => s.id === leg.to_checkpoint_id)
      if (destStop && !renderedStopIds.has(destStop.id)) {
        stopCounter++
        renderedStopIds.add(destStop.id)
        entries.push({ type: 'stop', stop: destStop, stopNumber: stopCounter, isStart: false, isFinal: false })
      }
    }
  }

  for (const s of stops) {
    if (!renderedStopIds.has(s.id)) {
      stopCounter++
      entries.push({ type: 'stop', stop: s, stopNumber: stopCounter, isStart: false, isFinal: false })
    }
  }

  const lastStopIdx = entries.findLastIndex((e) => e.type === 'stop')
  if (lastStopIdx >= 0) {
    (entries[lastStopIdx] as { type: 'stop'; isFinal: boolean }).isFinal = true
  }

  return entries
}

function StopRow({ stop, stopNumber, isStart, isFinal }: { stop: RoamCheckpoint; stopNumber: number; isStart: boolean; isFinal: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex w-8 flex-col items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-xs font-bold text-forest">
          {stopNumber}
        </span>
        {!isFinal && <div className="mt-1 w-px flex-1 bg-navy/15" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="text-sm font-semibold text-navy">{stop.label}</p>
        {(isStart || isFinal) && (
          <p className="text-xs text-ink-soft">{isStart ? 'Starting point' : 'Final stop'}</p>
        )}
        {stop.description && (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{stop.description}</p>
        )}
        {stop.external_url && (
          <a
            href={stop.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-forest"
          >
            <Info size={11} />
            Learn more &rarr;
          </a>
        )}
      </div>
    </div>
  )
}

function LegRow({ leg }: { leg: RoamLeg }) {
  const Icon = MODE_ICON[leg.leg_type] ?? Footprints
  const meta = [
    leg.distance_miles != null ? `${leg.distance_miles} mi` : null,
    leg.estimated_minutes != null ? `~${leg.estimated_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const hasDetail = !!(leg.narrative_snippet || leg.transit || leg.bike || leg.walk)

  return (
    <div className="flex gap-4">
      <div className="flex w-8 flex-col items-center">
        <div className="w-px flex-1 bg-navy/15" />
      </div>
      <div className="min-w-0 flex-1 py-2">
        <div className={`rounded-[12px] border border-navy/10 bg-white px-3.5 py-3${hasDetail ? '' : ' py-2.5'}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Icon size={13} style={{ color: '#4A4D68' }} />
            <span className="text-xs font-semibold capitalize text-ink-soft">{leg.leg_type}</span>
            {meta && <span className="text-xs text-ink-soft">{meta}</span>}
          </div>
          {leg.narrative_snippet && (
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">{leg.narrative_snippet}</p>
          )}
          {leg.transit && <TransitDetail transit={leg.transit} />}
          {leg.bike && <BikeDetail bike={leg.bike} />}
          {leg.walk && <WalkDetail walk={leg.walk} />}
        </div>
      </div>
    </div>
  )
}

/* ── Page component ── */

export default async function RoamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const roam = await getRoamDetail(decodeURIComponent(id))
  if (!roam) notFound()

  const requiredStops = roam.checkpoints.filter((c) => c.required)
  const bonusStops = roam.checkpoints.filter((c) => !c.required)
  const utm = { source: 'web_town', medium: 'roam_page', campaign: roam.id }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const requiredCount = requiredStops.length
  const thresholdStops = roam.completion_threshold < 1.0
    ? Math.ceil(requiredCount * roam.completion_threshold)
    : requiredCount
  const completionHint = roam.completion_threshold < 1.0
    ? `Visit ${thresholdStops} of the ${requiredCount} stops and the roam is complete.`
    : requiredCount > 0
      ? `Visit all ${requiredCount} stops and the roam is complete.`
      : null

  const timeline = buildTimeline(requiredStops, roam.legs)
  const hasRouteContent = timeline.length > 0

  // Trail facts, the searcher's first question. Start and end are the first and
  // last required stops in route order.
  const startLabel = requiredStops[0]?.label ?? null
  const endLabel = requiredStops.length > 1 ? requiredStops[requiredStops.length - 1].label : null
  const facts = trailFacts(roam, startLabel, endLabel)
  const video = parseVideoEmbed(roam.hero_video_url)
  const verb = roam.mode === 'walk' ? 'Walk' : roam.mode === 'bike' ? 'Ride' : 'Follow'

  // Answer-engine markup. The visible page already states the distance, the time
  // and the stops; this says the same things in a form a machine can quote.
  const routeFacts = [
    roam.distance_miles != null && roam.distance_miles > 0
      ? { '@type': 'PropertyValue', name: 'Distance', value: roam.distance_miles, unitCode: 'SMI' }
      : null,
    roam.estimated_minutes != null && roam.estimated_minutes > 0
      ? { '@type': 'PropertyValue', name: 'Estimated time', value: roam.estimated_minutes, unitCode: 'MIN' }
      : null,
    requiredCount > 0
      ? { '@type': 'PropertyValue', name: 'Stops', value: requiredCount }
      : null,
  ].filter(Boolean)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: roam.name,
    url: `${SITE_URL}/shift/roams/${roam.id}`,
    description: roam.hook ?? roam.description ?? undefined,
    ...(roam.hero_image_url ? { image: roam.hero_image_url } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
    ...(routeFacts.length > 0 ? { additionalProperty: routeFacts } : {}),
    ...(requiredStops.length > 0
      ? {
          mainEntity: {
            '@type': 'TouristTrip',
            name: roam.name,
            description: roam.hook ?? roam.description ?? undefined,
            ...(routeFacts.length > 0 ? { additionalProperty: routeFacts } : {}),
            itinerary: {
              '@type': 'ItemList',
              numberOfItems: requiredStops.length,
              itemListElement: requiredStops.map((stop, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'Place',
                  name: stop.label,
                  ...(stop.description ? { description: stop.description } : {}),
                  geo: { '@type': 'GeoCoordinates', latitude: stop.lat, longitude: stop.lng },
                },
              })),
            },
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Shift', item: `${SITE_URL}/shift` },
      { '@type': 'ListItem', position: 2, name: 'Roams', item: `${SITE_URL}/shift/roams` },
      { '@type': 'ListItem', position: 3, name: roam.name, item: `${SITE_URL}/shift/roams/${roam.id}` },
    ],
  }

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        {/* Hero image, unless a creator's video takes its place below the title. */}
        {roam.hero_image_url && !video && (
          <div className="relative mx-auto max-w-[1120px] px-6 pt-8 lg:px-8">
            <div className="relative overflow-hidden rounded-[20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={roam.hero_image_url} alt={roam.name} className="h-[260px] w-full object-cover md:h-[360px]" />
              {roam.hero_image_attribution && (
                <span className="absolute bottom-2 right-3 rounded bg-navy/70 px-2 py-0.5 text-[10px] text-white">
                  {roam.hero_image_attribution_url ? (
                    <a href={roam.hero_image_attribution_url} target="_blank" rel="noopener noreferrer">
                      {roam.hero_image_attribution}
                    </a>
                  ) : (
                    roam.hero_image_attribution
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Title + meta */}
        <section className="px-6 pt-8 lg:px-8">
          <div className="mx-auto max-w-[860px]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              <Link href="/shift/roams" className="underline-offset-4 hover:underline">Shift Roams</Link>
            </p>
            <h1 className="mb-4 font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {roam.name}
            </h1>
            {roam.tagline && (
              <p className="mb-3 text-lg font-medium leading-[1.5] text-navy">{roam.tagline}</p>
            )}
            {roam.hook && <p className="mb-4 text-lg leading-[1.6] text-ink-soft">{roam.hook}</p>}

            {/* Know before you go: the facts a trail search is asking for, before
                anything is asked of the visitor. A creator's video sits beside
                them when one is set (GSI features their reels, with credit,
                rather than making its own). */}
            {(facts.length > 0 || video) && (
              <div className={`mb-5 grid gap-5 ${video ? 'md:grid-cols-[1fr_320px] md:items-start' : ''}`}>
                {facts.length > 0 && (
                  <section aria-labelledby="know-before" className="min-w-0 rounded-[14px] border border-navy/10 bg-white px-5 py-1">
                    <h2 id="know-before" className="pt-4 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-forest">
                      Know before you go
                    </h2>
                    <dl className="divide-y divide-navy/10">
                      {facts.map((f) => (
                        <div key={f.label} className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[6.5rem_1fr]">
                          <dt className="text-[0.9375rem] font-semibold leading-snug text-navy">{f.label}</dt>
                          <dd className="m-0 text-[0.9375rem] leading-relaxed text-navy">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {video && (
                  <CreatorVideo
                    url={roam.hero_video_url}
                    credit={roam.hero_video_credit}
                    creditUrl={roam.hero_video_credit_url}
                    trailName={roam.name}
                  />
                )}
              </div>
            )}

            {roam.rail_home && (
              <TrainsHome
                stopId={roam.rail_home.stop_id}
                routeId={roam.rail_home.route_id}
                directionId={roam.rail_home.direction_id}
              />
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-navy/10 bg-white px-3.5 py-1.5 font-semibold text-navy">
                {roamMetaLine(roam)}
              </span>
              {roam.badge_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EDB93C]/40 bg-[#EDB93C]/10 px-3.5 py-1.5 font-semibold text-[#8A6D1F]">
                  <Award size={14} />
                  Unlock the {roam.badge_name} badge in the Shift app
                </span>
              )}
            </div>

            {/* Social proof + collection */}
            {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && (
              <p className="mb-4 flex items-center gap-1.5 text-sm text-ink-soft">
                <MapPin size={13} />
                {roam.completion_count} people have completed this route
              </p>
            )}

            {roam.collection && (
              <div className="mb-5 rounded-[12px] border border-forest/30 bg-forest/[0.06] px-4 py-3">
                <p className="text-sm font-semibold text-forest">
                  Part of the {roam.collection.name}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
                  {roam.collection.description} Complete all {roam.collection.item_count} routes to unlock the {roam.collection.badge_name} badge.
                </p>
              </div>
            )}

            {roam.description && (
              <p className="max-w-[720px] text-[1.0625rem] leading-[1.65] text-ink-soft">{roam.description}</p>
            )}
            {roam.credit_role && roam.credit_name && (
              <p className="mt-2 text-[0.9375rem] text-ink-soft">
                {roam.credit_role === 'suggested' ? 'Suggested by' : 'Designed by'} {roam.credit_name}
              </p>
            )}
            {roam.route_url && (
              <p className="mt-3">
                <a
                  href={roam.route_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                >
                  Learn more about this trail &rarr;
                </a>
              </p>
            )}
          </div>
        </section>

        {/* Map */}
        {(roam.route_coordinates || roam.checkpoints.length > 0) && (
          <section className="px-6 pt-10 lg:px-8">
            <div className="mx-auto max-w-[860px]">
              <div className="h-[380px] overflow-hidden rounded-[18px] border border-navy/10 md:h-[460px]">
                <RoamMap
                  routeCoordinates={roam.route_coordinates}
                  checkpoints={roam.checkpoints.map((c) => ({
                    label: c.label,
                    lat: c.lat,
                    lng: c.lng,
                    required: c.required,
                    sequence_order: c.sequence_order,
                  }))}
                />
              </div>
              <p className="mt-2 text-[0.8125rem] text-ink-soft">
                {startLabel && endLabel ? `Start: ${startLabel}. End: ${endLabel}. ` : startLabel ? `Start: ${startLabel}. ` : ''}
                Numbered pins are the stops{bonusStops.length > 0 ? '; gold rings are optional detours' : ''}.
              </p>
            </div>
          </section>
        )}

        {/* The ask, after the answer and the map. Search visitors land here asking
            how long the route is; until 2026-09 the only app buttons sat below
            the full route and 0 of 23 organic visits reached them (exp-2026-09-7).
            Since 2026-10-15 the facts box comes first and this box follows the
            map, so the visitor has what they came for before being asked. */}
        <section className="px-6 pt-8 lg:px-8">
          <div className="mx-auto max-w-[860px]">
            <div className="flex flex-col gap-4 rounded-[14px] border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-[46ch]">
                <p className="text-[0.9375rem] font-semibold text-navy">{verb} it with Shift, free</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
                  Turn-by-turn guidance along this route, automatic check-in at each stop
                  {roam.badge_name ? `, and the ${roam.badge_name} badge when you finish.` : ', and the roam marked complete when you finish.'}
                </p>
              </div>
              <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_after_map" tone="light" className="shrink-0 [&>a]:max-[420px]:basis-full" />
            </div>
          </div>
        </section>

        {/* The route — unified timeline of stops + legs */}
        {hasRouteContent && (
          <section className="px-6 pt-10 lg:px-8">
            <div className="mx-auto max-w-[860px]">
              <h2 className="mb-5 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                The route, stop by stop
              </h2>
              <div>
                {timeline.map((entry) =>
                  entry.type === 'stop' ? (
                    <StopRow
                      key={`stop-${entry.stop.id}`}
                      stop={entry.stop}
                      stopNumber={entry.stopNumber}
                      isStart={entry.isStart}
                      isFinal={entry.isFinal}
                    />
                  ) : (
                    <LegRow key={`leg-${entry.leg.id}`} leg={entry.leg} />
                  ),
                )}
              </div>
            </div>
          </section>
        )}

        {/* Bonus stops */}
        {bonusStops.length > 0 && (
          <section className="px-6 pt-10 lg:px-8">
            <div className="mx-auto max-w-[860px]">
              <h2 className="mb-1 font-serif text-[1.375rem] leading-tight text-navy">
                Bonus stops nearby
              </h2>
              <p className="mb-4 text-sm text-ink-soft">
                Optional detours worth the extra steps.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {bonusStops.map((c) => (
                  <div key={c.id} className="rounded-[12px] border border-[#EDB93C]/40 bg-white px-4 py-3.5">
                    <p className="text-sm font-semibold text-navy">{c.label}</p>
                    {c.description && (
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{c.description}</p>
                    )}
                    {c.external_url && (
                      <a
                        href={c.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-forest"
                      >
                        <Info size={11} />
                        Learn more &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* How it works + CTA */}
        <section className="px-6 pb-20 pt-12 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-3 text-center font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              How it works
            </h2>
            <p className="mx-auto mb-10 max-w-[520px] text-center text-[0.9375rem] leading-relaxed text-ink-soft">
              A roam is a guided, self-paced adventure you follow in the free Shift app.
            </p>
            <div className="mb-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-[14px] border border-navy/10 bg-white px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-forest/10">
                  <Navigation size={18} style={{ color: '#2D6A4F' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-navy">Follow the route</p>
                <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
                  Open this roam in the Shift app and follow the turn-by-turn route at your own pace.
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-white px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-forest/10">
                  <MapPinned size={18} style={{ color: '#2D6A4F' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-navy">Check in at each stop</p>
                <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
                  The app detects when you arrive and checks you in automatically. No scanning, no codes.
                  {completionHint ? ` ${completionHint}` : ''}
                </p>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-white px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EDB93C]/15">
                  <BadgeCheck size={18} style={{ color: '#8A6D1F' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-navy">
                  {roam.badge_name ? `Unlock the ${roam.badge_name} badge` : 'Unlock a badge'}
                </p>
                <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
                  Finish the roam and {roam.badge_name ? `the ${roam.badge_name} badge` : 'a badge'} is yours.
                  {roam.collection
                    ? ` Finish all ${roam.collection.item_count} routes in the ${roam.collection.name} for a bonus badge.`
                    : ''}
                </p>
              </div>
            </div>
            <div className="text-center">
              <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_bottom" tone="light" className="justify-center" />
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
