import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Award, Bike, Bus, Footprints, Shuffle, MapPin, ArrowRight, Train, Info, Navigation, MapPinned, BadgeCheck } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import RoamMap from '@/components/roams/RoamMap'
import { roamMetaLine } from '@/components/roams/RoamCard'
import { withUtm } from '@/lib/utm'
import { getRoamDetail, type RoamLeg, type RoamCheckpoint } from '@/lib/roams/queries'

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
  protected: { bg: 'bg-[#BAF14D]/15', text: 'text-[#BAF14D]', label: 'Protected path' },
  bike_lane: { bg: 'bg-[#60A5FA]/15', text: 'text-[#60A5FA]', label: 'Bike lane' },
  shared_road: { bg: 'bg-[#F59E0B]/15', text: 'text-[#F59E0B]', label: 'Shared road' },
  mixed: { bg: 'bg-white/10', text: 'text-white/75', label: 'Mixed' },
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const roam = await getRoamDetail(decodeURIComponent(id))
  if (!roam) return { title: 'Roam not found' }
  const title = `${roam.name} — a guided ${roam.mode === 'multi' ? '' : `${roam.mode} `}route${roam.region ? ` in ${roam.region}` : ''} | Shift Roams`
  const description =
    roam.hook ??
    (roam.description ? truncateAtSentence(roam.description, 160) : null) ??
    `A guided ${roam.distance_miles ?? ''} mile route with ${roam.checkpoints.filter((c) => c.required).length} stops.`
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
    <div className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
      {(transit.board_stop_name || transit.alight_stop_name) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
          <Train size={13} style={{ color: '#BAF14D' }} />
          {transit.route_name && (
            <span className="rounded bg-[#BAF14D]/15 px-1.5 py-0.5 text-xs font-semibold text-[#BAF14D]">
              {transit.route_name}
            </span>
          )}
          {transit.board_stop_name && (
            <span className="text-white/90">Board at <span className="font-semibold text-white">{transit.board_stop_name}</span></span>
          )}
          {transit.alight_stop_name && (
            <>
              <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <span className="text-white/90">{transit.alight_stop_name}</span>
            </>
          )}
          {transit.num_stops != null && transit.num_stops > 0 && (
            <span className="text-white/60">({transit.num_stops} {transit.num_stops === 1 ? 'stop' : 'stops'}{transit.direction ? `, ${transit.direction}` : ''})</span>
          )}
        </div>
      )}
      {transit.fare_note && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Fare:</span> {transit.fare_note}</p>
      )}
      {transit.transfer_note && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Transfers:</span> {transit.transfer_note}</p>
      )}
      {transit.boarding_tip && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Tip:</span> {transit.boarding_tip}</p>
      )}
    </div>
  )
}

function BikeDetail({ bike }: { bike: NonNullable<RoamLeg['bike']> }) {
  const comfort = bike.comfort_rating ? COMFORT_COLORS[bike.comfort_rating] ?? COMFORT_COLORS.mixed : null
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
      {comfort && (
        <span className={`inline-block rounded-full ${comfort.bg} px-2.5 py-1 text-xs font-semibold ${comfort.text}`}>
          {comfort.label}
        </span>
      )}
      {bike.comfort_summary && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Route:</span> {bike.comfort_summary}</p>
      )}
      {bike.elevation_summary && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Elevation:</span> {bike.elevation_summary}</p>
      )}
      {bike.bike_parking_note && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Parking:</span> {bike.bike_parking_note}</p>
      )}
    </div>
  )
}

function WalkDetail({ walk }: { walk: NonNullable<RoamLeg['walk']> }) {
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
      {walk.terrain_note && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Terrain:</span> {walk.terrain_note}</p>
      )}
      {walk.waypoint_note && (
        <p className="text-[0.8125rem] text-white/75"><span className="text-white/50">Along the way:</span> {walk.waypoint_note}</p>
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-xs font-extrabold text-[#BAF14D]">
          {stopNumber}
        </span>
        {!isFinal && <div className="mt-1 w-px flex-1 bg-white/[0.08]" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <p className="text-sm font-semibold text-white">{stop.label}</p>
        {(isStart || isFinal) && (
          <p className="text-xs text-white/50">{isStart ? 'Starting point' : 'Final stop'}</p>
        )}
        {stop.description && (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/75">{stop.description}</p>
        )}
        {stop.external_url && (
          <a
            href={stop.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#BAF14D]"
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
        <div className="w-px flex-1 bg-white/[0.08]" />
      </div>
      <div className="min-w-0 flex-1 py-2">
        <div className={`rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3.5 py-3${hasDetail ? '' : ' py-2.5'}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Icon size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="text-xs font-semibold capitalize text-white/75">{leg.leg_type}</span>
            {meta && <span className="text-xs text-white/50">{meta}</span>}
          </div>
          {leg.narrative_snippet && (
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-white/75">{leg.narrative_snippet}</p>
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
    ? `Visit ${thresholdStops} of ${requiredCount} stops to complete this roam`
    : requiredCount > 0
      ? `Visit all ${requiredCount} stops to complete this roam`
      : null

  const timeline = buildTimeline(requiredStops, roam.legs)
  const hasRouteContent = timeline.length > 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: roam.name,
    url: `${SITE_URL}/shift/roams/${roam.id}`,
    description: roam.hook ?? roam.description ?? undefined,
    ...(roam.hero_image_url ? { image: roam.hero_image_url } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
  }

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-[#191A2E]">
        {/* Hero image */}
        {roam.hero_image_url && (
          <div className="relative mx-auto max-w-[1120px] px-8 pt-8">
            <div className="relative overflow-hidden rounded-[20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={roam.hero_image_url} alt={roam.name} className="h-[260px] w-full object-cover md:h-[360px]" />
              {roam.hero_image_attribution && (
                <span className="absolute bottom-2 right-3 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/75">
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
        <section className="px-8 pt-8">
          <div className="mx-auto max-w-[860px]">
            <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.15em] text-[#BAF14D]">
              <Link href="/shift/roams" className="hover:text-white">Shift Roams</Link>
            </p>
            <h1 className="mb-3 font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {roam.name}
            </h1>
            {roam.tagline && (
              <p className="mb-3 text-lg font-medium leading-[1.5] text-white/80">{roam.tagline}</p>
            )}
            {roam.hook && <p className="mb-4 text-lg leading-[1.6] text-white/90">{roam.hook}</p>}
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-white/[0.1] bg-white/[0.05] px-3.5 py-1.5 font-semibold text-white">
                {roamMetaLine(roam)}
              </span>
              {roam.badge_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EDB93C]/30 bg-[#EDB93C]/10 px-3.5 py-1.5 font-semibold text-[#EDB93C]">
                  <Award size={14} />
                  Earn the {roam.badge_name} badge
                  {roam.xp_bonus ? ` · +${roam.xp_bonus} XP` : ''}
                </span>
              )}
            </div>

            {/* Social proof + collection */}
            {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && (
              <p className="mb-4 flex items-center gap-1.5 text-sm text-white/60">
                <MapPin size={13} />
                {roam.completion_count} people have completed this route
              </p>
            )}

            {roam.collection && (
              <div className="mb-5 rounded-[10px] border border-[#BAF14D]/20 bg-[#BAF14D]/[0.06] px-4 py-3">
                <p className="text-sm font-semibold text-[#BAF14D]">
                  Part of the {roam.collection.name}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-white/75">
                  {roam.collection.description} Complete all {roam.collection.item_count} routes to earn the {roam.collection.badge_name} badge.
                </p>
              </div>
            )}

            {roam.description && (
              <p className="max-w-[720px] text-[0.9875rem] leading-[1.7] text-white/85">{roam.description}</p>
            )}
            {roam.route_url && (
              <p className="mt-3">
                <a
                  href={roam.route_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#BAF14D]"
                >
                  Learn more about this trail &rarr;
                </a>
              </p>
            )}
          </div>
        </section>

        {/* Map */}
        {(roam.route_coordinates || roam.checkpoints.length > 0) && (
          <section className="px-8 pt-10">
            <div className="mx-auto max-w-[860px]">
              <div className="h-[380px] overflow-hidden rounded-[18px] border border-white/[0.08] md:h-[460px]">
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
              <p className="mt-2 text-[11px] text-white/70">
                Numbered pins are the roam&apos;s stops; gold rings are bonus stops. Check in at each
                stop in the Shift app to complete the roam.
              </p>
            </div>
          </section>
        )}

        {/* The route — unified timeline of stops + legs */}
        {hasRouteContent && (
          <section className="px-8 pt-12">
            <div className="mx-auto max-w-[860px]">
              <h2 className="mb-1 font-display text-2xl font-bold tracking-tight text-white">
                The route
              </h2>
              {completionHint && (
                <p className="mb-5 text-sm text-white/60">{completionHint}</p>
              )}
              <div>
                {timeline.map((entry, i) =>
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
          <section className="px-8 pt-12">
            <div className="mx-auto max-w-[860px]">
              <h2 className="mb-1 font-display text-xl font-bold tracking-tight text-white">
                Bonus stops nearby
              </h2>
              <p className="mb-4 text-sm text-white/75">
                Optional detours worth the extra steps.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {bonusStops.map((c) => (
                  <div key={c.id} className="rounded-[12px] border border-[#EDB93C]/20 bg-white/[0.03] px-4 py-3.5">
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    {c.description && (
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/75">{c.description}</p>
                    )}
                    {c.external_url && (
                      <a
                        href={c.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#BAF14D]"
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
        <section className="px-8 py-20">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-3 text-center font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              How it works
            </h2>
            <p className="mx-auto mb-10 max-w-[520px] text-center text-[0.9375rem] leading-relaxed text-white/75">
              A roam is a guided, self-paced adventure you follow in the free Shift app.
            </p>
            <div className="mb-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15">
                  <Navigation size={18} style={{ color: '#BAF14D' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-white">Follow the route</p>
                <p className="text-[0.8125rem] leading-relaxed text-white/75">
                  Open this roam in the Shift app and follow the turn-by-turn route at your own pace.
                </p>
              </div>
              <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D]/15">
                  <MapPinned size={18} style={{ color: '#BAF14D' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-white">Check in at each stop</p>
                <p className="text-[0.8125rem] leading-relaxed text-white/75">
                  The app detects when you arrive and checks you in automatically. No scanning, no codes.
                </p>
              </div>
              <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EDB93C]/15">
                  <BadgeCheck size={18} style={{ color: '#EDB93C' }} />
                </div>
                <p className="mb-1.5 text-sm font-semibold text-white">
                  {roam.badge_name ? `Earn the ${roam.badge_name} badge` : 'Earn a badge'}
                </p>
                <p className="text-[0.8125rem] leading-relaxed text-white/75">
                  Complete the roam to earn {roam.badge_name ? `the ${roam.badge_name} badge` : 'a badge'}
                  {roam.xp_bonus ? ` and ${roam.xp_bonus} XP` : ''}.
                  {roam.collection
                    ? ` Finish all ${roam.collection.item_count} routes in the ${roam.collection.name} for a bonus badge.`
                    : ''}
                </p>
              </div>
            </div>
            <div className="text-center">
              <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="justify-center" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
