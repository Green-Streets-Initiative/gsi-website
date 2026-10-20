import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Award, MapPin, Navigation, MapPinned, BadgeCheck, Ruler, Clock, Flag, Bike, ExternalLink, Users, ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import RoamMap from '@/components/roams/RoamMap'
import { parseVideoEmbed } from '@/components/roams/CreatorVideo'
import RoamHeroMedia from '@/components/roams/RoamHeroMedia'
import TrainsHome from '@/components/roams/TrainsHome'
import { withUtm } from '@/lib/utm'
import { getRoamDetail, getNextRoamEvent, getRoamTrailInfo, getRoamKeepGoing, type RoamDetail } from '@/lib/roams/queries'
import RoamKeepGoing from '@/components/roams/RoamKeepGoing'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import RoamDisruptions from '@/components/roams/RoamDisruptions'
import RoamSectionNav from '@/components/roams/RoamSectionNav'
import RoamStopList from '@/components/roams/RoamStopList'
import RoamGroupEventCard from '@/components/roams/RoamGroupEventCard'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

const MIN_COMPLETIONS_TO_SHOW = 10

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

/** "Thu, Oct 22 · 10 AM" for the group ride row. */
function shortWhen(date: string, time: string | null): string {
  const d = new Date(`${date}T12:00:00-05:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
  if (!time) return d
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return `${d} · ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

/* ── Page ── */

/** The visitor's first questions as three tiles: how long, how long it takes,
 *  how many stops. Where it starts and ends reads as one line under them
 *  (Keith 2026-10-20: same shape as the app; four tiles wrapped awkwardly). */
function glance(roam: RoamDetail, isLoop: boolean, stops: number, bonus: number) {
  const tiles: Array<{ icon: typeof Ruler; label: string; value: string; sub: string | null }> = []
  if (roam.distance_miles && roam.distance_miles > 0) {
    tiles.push({
      icon: Ruler,
      label: 'Length',
      value: `${miles(roam.distance_miles)} mi`,
      sub:
        roam.full_trail_miles && roam.full_trail_miles > roam.distance_miles + 0.2
          ? `of ${miles(roam.full_trail_miles)} miles`
          : isLoop
            ? 'loop'
            : null,
    })
  }
  if (roam.estimated_minutes) {
    tiles.push({
      icon: Clock,
      label: 'Time',
      value: duration(roam.estimated_minutes).replace(/^about /, ''),
      sub: roam.mode === 'bike' ? 'by bike' : roam.mode === 'walk' ? 'on foot' : 'stops included',
    })
  }
  if (stops > 0) {
    tiles.push({
      icon: MapPin,
      label: 'Stops',
      value: `${stops} ${stops === 1 ? 'stop' : 'stops'}`,
      sub: bonus > 0 ? `plus ${bonus} bonus` : null,
    })
  }
  return tiles
}

export default async function RoamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const roam = await getRoamDetail(decodeURIComponent(id))
  if (!roam) notFound()

  const requiredStops = roam.checkpoints.filter((c) => c.required)
  const bonusStops = roam.checkpoints.filter((c) => !c.required)
  const first = requiredStops[0] ?? roam.checkpoints[0] ?? null

  const [groupEvent, trailInfo, docks, keepGoing] = await Promise.all([
    getNextRoamEvent(roam.id),
    getRoamTrailInfo(roam.id),
    first ? getBluebikesDocks(first.lat, first.lng, 600).catch(() => []) : Promise.resolve([]),
    getRoamKeepGoing(roam.id),
  ])

  const disruptions = trailInfo.disruptions
  const trailsUsed = trailInfo.trails.filter((x) => x.relation === 'uses')
  const trailsConnect = trailInfo.trails.filter((x) => x.relation === 'connects')
  const utm = { source: 'web_town', medium: 'roam_page', campaign: roam.id }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const requiredCount = requiredStops.length
  const thresholdStops = roam.completion_threshold < 1.0 ? Math.ceil(requiredCount * roam.completion_threshold) : requiredCount
  const completionHint =
    roam.completion_threshold < 1.0
      ? `Visit ${thresholdStops} of the ${requiredCount} stops and the roam is complete.`
      : requiredCount > 0
        ? `Visit ${requiredCount === 2 ? 'both' : `all ${requiredCount}`} stops and the roam is complete.`
        : null

  const startLabel = requiredStops[0]?.label ?? null
  const last = requiredStops.length > 1 ? requiredStops[requiredStops.length - 1] : null
  const isLoop = !!(last && first && Math.abs(last.lat - first.lat) < 0.0005 && Math.abs(last.lng - first.lng) < 0.0005)
  const endLabel = last && !isLoop ? last.label : null
  const tiles = glance(roam, isLoop, isLoop ? requiredCount - 1 : requiredCount, bonusStops.length)
  const startLine = startLabel
    ? isLoop
      ? `Starts and ends at ${startLabel}`
      : endLabel
        ? `Starts at ${startLabel}, ends at ${endLabel}`
        : `Starts at ${startLabel}`
    : null
  const video = parseVideoEmbed(roam.hero_video_url)
  const verb = roam.mode === 'walk' ? 'Walk' : roam.mode === 'bike' ? 'Ride' : 'Follow'
  const groupWhen = groupEvent ? shortWhen(groupEvent.event_date, groupEvent.event_time) : null

  // Live Bluebikes near the start, for the first stop card and Getting there.
  const nearDocks = docks.slice(0, 2)
  const walkMinTo = (m: number) => Math.max(1, Math.round(m / 80))
  // Suggest the nearest station that has a bike right now.
  const dockWithBikes = nearDocks.find((d) => d.num_bikes_available > 0) ?? null
  const startDockLine = dockWithBikes
    ? `Bluebikes: ${dockWithBikes.name}, ${dockWithBikes.num_bikes_available} ${dockWithBikes.num_bikes_available === 1 ? 'bike' : 'bikes'} there now, ${walkMinTo(dockWithBikes.distance_meters)} min walk.`
    : null

  const hasRoute = requiredStops.length > 0
  const hasGettingThere = !!(first || roam.access_note || roam.parking_note || roam.rail_home || nearDocks.length > 0 || roam.surface)
  const sections = [
    hasRoute ? { id: 'route', label: 'Route' } : null,
    keepGoing.length > 0 ? { id: 'keep-going', label: 'Keep going' } : null,
    hasGettingThere ? { id: 'getting-there', label: 'Get there' } : null,
    // On phones the summary's group ride row links here, so the bar keeps to one line.
    groupEvent ? { id: 'group-ride-section', label: 'Group ride', phoneHidden: keepGoing.length > 0 } : null,
    { id: 'about', label: 'About' },
  ].filter((x): x is { id: string; label: string; phoneHidden?: boolean } => !!x)

  // Answer-engine markup. The visible page already states the distance, the time
  // and the stops; this says the same things in a form a machine can quote.
  const routeFacts = [
    roam.distance_miles != null && roam.distance_miles > 0
      ? { '@type': 'PropertyValue', name: 'Distance', value: roam.distance_miles, unitCode: 'SMI' }
      : null,
    roam.estimated_minutes != null && roam.estimated_minutes > 0
      ? { '@type': 'PropertyValue', name: 'Estimated time', value: roam.estimated_minutes, unitCode: 'MIN' }
      : null,
    requiredCount > 0 ? { '@type': 'PropertyValue', name: 'Stops', value: requiredCount } : null,
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

  const appBox = (
    <div className="flex flex-col gap-4 rounded-[14px] border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
      <div className="max-w-[46ch]">
        <p className="text-[0.9375rem] font-semibold text-navy">{verb} it with Shift, free</p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
          A map of the route, directions to each stop in your maps app, and automatic check-in when you arrive
          {roam.badge_name ? `. Finish to unlock the ${roam.badge_name} badge.` : '.'}
        </p>
      </div>
      <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_after_map" tone="light" className="shrink-0 [&>a]:max-[420px]:basis-full" />
    </div>
  )

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        {/* ── Overview: everything a visitor needs to decide, on the first screen,
            at phone and desktop width (Keith 2026-10-20: the app's shape). ── */}
        <section className="px-6 pt-5 lg:px-8 lg:pt-10">
          <div className={`mx-auto grid max-w-[1120px] gap-5 ${roam.hero_image_url || video ? 'lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-12' : ''}`}>
            {(roam.hero_image_url || video) && (
              <div className="lg:order-last">
                <RoamHeroMedia
                  roamId={roam.id}
                  name={roam.name}
                  photoUrl={roam.hero_image_url}
                  photoCredit={roam.hero_image_attribution}
                  photoCreditUrl={roam.hero_image_attribution_url}
                  videoUrl={roam.hero_video_url}
                  videoCredit={roam.hero_video_credit}
                  videoCreditUrl={roam.hero_video_credit_url}
                />
              </div>
            )}
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="text-[0.875rem] text-ink-soft">
                <Link href="/shift/roams" className="font-semibold text-forest underline-offset-4 hover:underline">Roams</Link>
                {roam.region ? <span> · {roam.region}</span> : null}
              </nav>
              <h1 className="mt-1.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">
                {roam.name}
              </h1>
              {roam.hook && <p className="mt-2.5 max-w-[56ch] text-[1.0625rem] leading-[1.55] text-ink-soft">{roam.hook}</p>}

              {tiles.length > 0 && (
                <dl className={`mt-5 grid divide-x divide-navy/[0.08] rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] ${tiles.length === 3 ? 'grid-cols-3' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {tiles.map((tile) => (
                    <div key={tile.label} className="min-w-0 px-3.5 py-3 sm:px-5 sm:py-4">
                      <dt className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-soft">
                        <tile.icon size={13} aria-hidden /> {tile.label}
                      </dt>
                      <dd className="m-0 mt-1 text-[1.125rem] font-semibold leading-tight tabular-nums text-navy sm:text-[1.3125rem]">{tile.value}</dd>
                      {tile.sub && <dd className="m-0 mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">{tile.sub}</dd>}
                    </div>
                  ))}
                </dl>
              )}
              {startLine && (
                <p className="mt-3 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  <Flag size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden /> {startLine}
                </p>
              )}

              {roam.badge_name && (
                <p className="mt-2.5 flex items-center gap-2 text-[0.9375rem] text-navy">
                  <Award size={15} className="shrink-0 text-[#8A6D1F]" aria-hidden />
                  <span>
                    Unlock the <span className="font-semibold">{roam.badge_name}</span> badge
                  </span>
                </p>
              )}

              {(disruptions.length > 0 || groupEvent) && (
                <div className="mt-4 space-y-2.5">
                  <RoamDisruptions items={disruptions} />
                  {groupEvent && groupWhen && (
                    <a
                      href="#group-ride-section"
                      className="group flex min-h-[48px] items-center gap-3 rounded-[14px] bg-forest/[0.07] px-4 py-2.5 text-[0.9375rem] text-navy transition-colors hover:bg-forest/[0.11]"
                    >
                      <Users size={17} className="shrink-0 text-forest" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">Group ride</span> <span className="text-ink-soft">· {groupWhen}</span>
                      </span>
                      <ArrowRight size={16} className="shrink-0 text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sticky: a direct child of <main> so it stays pinned the whole page. */}
        <RoamSectionNav sections={sections} />

        {/* ── The route: map fixed beside the stop list on wide screens ── */}
        {hasRoute && (
          <section id="route" aria-labelledby="route-h" className="scroll-mt-28 px-6 pt-8 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="route-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                The route, stop by stop
              </h2>
              {trailsUsed.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.875rem]">
                  <span className="text-ink-soft">On this route:</span>
                  {trailsUsed.map((x) => (
                    <span key={x.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${x.closed ? 'bg-[#FFF4EC] text-[#9A3412]' : 'bg-forest/[0.08] text-forest'}`}>
                      {x.name}
                      {x.miles != null ? <span className="font-medium opacity-80">· {miles(Number(x.miles))} mi</span> : null}
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                <div className="space-y-4 lg:sticky lg:top-[124px]">
                  {(roam.route_coordinates || roam.checkpoints.length > 0) && (
                    <div>
                      <div className="h-[320px] overflow-hidden rounded-[18px] border border-navy/10 sm:h-[400px] lg:h-[min(520px,calc(100vh-300px))]">
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
                        Numbered pins are the stops{bonusStops.length > 0 ? '; gold rings are optional detours' : ''}.
                      </p>
                    </div>
                  )}
                  {/* The app box follows the map, as it has since 2026-10-15 (exp-2026-09-7). */}
                  {appBox}
                </div>
                <RoamStopList stops={requiredStops} bonus={bonusStops} legs={roam.legs} startDockLine={startDockLine} />
              </div>
            </div>
          </section>
        )}

        {/* ── Keep going: where you can ride on from either end (Shift 01289) ── */}
        {keepGoing.length > 0 && (
          <section id="keep-going" aria-labelledby="keep-going-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="keep-going-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                Keep going
              </h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                The {roam.name} is one piece of a bigger network. From either end you can keep riding on paths and protected bike lanes. Pick a direction to see it on the map.
              </p>
              <RoamKeepGoing
                roamId={roam.id}
                roamName={roam.name}
                route={roam.route_coordinates}
                rows={keepGoing}
                closed={disruptions.map((d) => d.closed_geometry).filter((g): g is [number, number][] => !!g && g.length > 1)}
              />
            </div>
          </section>
        )}

        {/* ── Getting there ── */}
        {hasGettingThere && (
          <section id="getting-there" aria-labelledby="getting-there-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="getting-there-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                Getting there
              </h2>
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0">
                  {first && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${first.lat},${first.lng}&travelmode=${roam.mode === 'bike' ? 'bicycling' : roam.mode === 'walk' ? 'walking' : 'transit'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-navy px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-navy/90 sm:w-auto"
                    >
                      <Navigation size={16} aria-hidden /> Directions to {first.label}
                    </a>
                  )}
                  {trailsConnect.length > 0 && (
                    <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.875rem]">
                      <span className="text-ink-soft">Connects to:</span>
                      {trailsConnect.map((x) => (
                        <span key={x.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${x.closed ? 'bg-[#FFF4EC] text-[#9A3412]' : 'bg-forest/[0.08] text-forest'}`}>
                          {x.name}
                          {x.closed ? <span className="font-medium">· closed</span> : null}
                        </span>
                      ))}
                    </p>
                  )}
                  <dl className="mt-5 divide-y divide-navy/[0.07] rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
                    {roam.access_note && (
                      <div className="px-5 py-4">
                        <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Navigation size={15} className="text-forest" aria-hidden /> By transit, bike or on foot</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.access_note}</dd>
                      </div>
                    )}
                    {nearDocks.length > 0 && (
                      <div className="px-5 py-4">
                        <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Bike size={15} className="text-forest" aria-hidden /> Bluebikes near the start, right now</dt>
                        <dd className="m-0 mt-1.5">
                          <ul className="space-y-2">
                            {nearDocks.map((d) => (
                              <li key={d.station_id} className="text-[0.9375rem] leading-snug">
                                <span className="text-navy">{d.name}</span>
                                <span className="block tabular-nums text-ink-soft">
                                  {walkMinTo(d.distance_meters)} min walk · {d.num_bikes_available === 0 ? 'no bikes right now' : `${d.num_bikes_available} ${d.num_bikes_available === 1 ? 'bike' : 'bikes'}`} · {d.num_docks_available} {d.num_docks_available === 1 ? 'dock' : 'docks'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {roam.parking_note && (
                      <div className="px-5 py-4">
                        <dt className="text-[0.9375rem] font-semibold text-navy">Parking</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.parking_note}</dd>
                      </div>
                    )}
                    {roam.surface && (
                      <div className="px-5 py-4">
                        <dt className="text-[0.9375rem] font-semibold text-navy">Surface</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.surface}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="min-w-0">
                  {roam.rail_home && (
                    <TrainsHome stopId={roam.rail_home.stop_id} routeId={roam.rail_home.route_id} directionId={roam.rail_home.direction_id} />
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Group ride (Shift 01229), 14 days out until it ends ── */}
        {groupEvent && (
          <section id="group-ride-section" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <RoamGroupEventCard event={groupEvent} bare />
            </div>
          </section>
        )}

        {/* ── About: the description, who made it, and how a roam works ── */}
        <section id="about" aria-labelledby="about-h" className="scroll-mt-28 px-6 pb-20 pt-14 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="about-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
              About this roam
            </h2>
            <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
              <div className="min-w-0">
                {roam.description && <p className="max-w-[64ch] text-[1.0625rem] leading-[1.7] text-ink-soft">{roam.description}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem]">
                  {roam.credit_role && roam.credit_name && (
                    <span className="text-ink-soft">{roam.credit_role === 'suggested' ? 'Suggested by' : 'Designed by'} {roam.credit_name}</span>
                  )}
                  {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && (
                    <span className="text-ink-soft">{roam.completion_count} people have completed it</span>
                  )}
                  {roam.route_url && (
                    <a href={roam.route_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                      About this trail <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                </div>
                {roam.collection && (
                  <p className="mt-3 text-[0.9375rem] text-ink-soft">
                    <span className="font-semibold text-forest">Part of the {roam.collection.name}.</span> Finish all {roam.collection.item_count} routes to unlock the {roam.collection.badge_name} badge.
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-[1.0625rem] font-semibold text-navy">How it works</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
                  A roam is a self-guided route you follow at your own pace in the free Shift app.
                </p>
                <ol className="mt-4 space-y-4">
                  {[
                    { icon: Navigation, title: 'Follow the route', body: 'Open this roam in the Shift app and follow it at your own pace.' },
                    { icon: MapPinned, title: 'Check in at each stop', body: `The app checks you in when you arrive. No scanning, no codes.${completionHint ? ` ${completionHint}` : ''}` },
                    {
                      icon: BadgeCheck,
                      title: roam.badge_name ? `Unlock the ${roam.badge_name} badge` : 'Unlock a badge',
                      body: `Finish the roam and ${roam.badge_name ? `the ${roam.badge_name} badge` : 'a badge'} is yours.${roam.collection ? ` Finish all ${roam.collection.item_count} routes in the ${roam.collection.name} for a bonus badge.` : ''}`,
                    },
                  ].map((step, i) => (
                    <li key={step.title} className="flex gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest/[0.1] text-[0.8125rem] font-bold text-forest" aria-hidden>{i + 1}</span>
                      <div>
                        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy">
                          <step.icon size={15} className="text-forest" aria-hidden /> {step.title}
                        </p>
                        <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink-soft">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_bottom" tone="light" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
