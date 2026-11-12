import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getTourTrails } from '@/lib/trails/tours'
import { Award, MapPin, Navigation, MapPinned, BadgeCheck, Ruler, Clock, Flag, Bike, ExternalLink, Users, ArrowRight } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import RoamMap from '@/components/roams/RoamMap'
import RoamNotes from '@/components/notes/RoamNotes'
import { parseVideoEmbed } from '@/components/roams/CreatorVideo'
import RoamHeroMedia from '@/components/roams/RoamHeroMedia'
import TrainsHome from '@/components/roams/TrainsHome'
import { withUtm } from '@/lib/utm'
import { getRoamDetail, getNextRoamEvent, getRoamTrailInfo, getRoamKeepGoing, type RoamDetail } from '@/lib/roams/queries'
import { localizeRoamDetail } from '@/lib/stored-translations'
import RoamKeepGoing from '@/components/roams/RoamKeepGoing'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import RoamDisruptions from '@/components/roams/RoamDisruptions'
import RoamSectionNav from '@/components/roams/RoamSectionNav'
import RoamStopList from '@/components/roams/RoamStopList'
import RoamGroupEventCard from '@/components/roams/RoamGroupEventCard'
import RoamLede from '@/components/roams/RoamLede'
import RoamHills from '@/components/roams/RoamHills'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { resolveSiteLocale, siteDate, siteTime, translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { roamStrings, type RoamKey } from '@/lib/site-strings/roams'

type TT = T<RoamKey>
type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string | string[] }> }

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
function distanceMiles(miles: number | null): string | null {
  if (miles == null || !Number.isFinite(miles) || miles <= 0) return null
  // 2 -> "2", 2.25 -> "2.3" — one decimal is as precise as a route distance gets.
  const rounded = Math.round(miles * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`
}

/** "bike " / "walk " / "transit " for the title and fallback description; a walk-and-transit roam has none. */
function modeWord(mode: string, t: TT, locale: SiteLocale): string {
  if (mode === 'multi') return ''
  if (mode === 'bike') return t('meta.mode_bike')
  if (mode === 'walk') return t('meta.mode_walk')
  if (mode === 'transit') return t('meta.mode_transit')
  return locale === 'en' ? `${mode} ` : ''
}

/** 2 -> "2", 6.39 -> "6.4" */
function miles(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** 110 -> "1 hr 50 min", 42 -> "42 min" */
function duration(min: number, t: TT): string {
  const m = Math.round(min)
  if (m < 60) return t('dur.min', { m })
  const h = Math.floor(m / 60)
  const rest = Math.round((m % 60) / 5) * 5
  return rest ? t('dur.hr_min', { h, m: rest }) : t('dur.hr', { h })
}

/** A roam that tours a whole trail lives on that trail's page now (Keith 2026-11-04). An app link's ?lang= rides along. */
async function forwardTour(id: string, lang?: string | string[]): Promise<void> {
  const trail = (await getTourTrails()).get(decodeURIComponent(id))
  if (trail) permanentRedirect(lang ? withLang(`/trails/${trail}`, resolveSiteLocale(lang)) : `/trails/${trail}`)
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params
  const { lang } = await searchParams
  await forwardTour(id, lang)
  const locale = await siteLocale(lang)
  const tr = translator(roamStrings, locale)
  // The Roam's text and stops in the page's language (translation plan, batch 8).
  const roam = await localizeRoamDetail(await getRoamDetail(decodeURIComponent(id)), locale)
  if (!roam) return { title: tr('meta.not_found') }
  const dist = distanceMiles(roam.distance_miles)
  const mode = modeWord(roam.mode, tr, locale)
  // A trail page answers the search: length, where it starts, how to get there.
  const title = roam.full_trail_miles
    ? tr('meta.title_trail', { name: roam.name, miles: miles(roam.full_trail_miles) })
    : tr('meta.title_route', {
        name: roam.name,
        dist: dist ? tr('meta.dist', { miles: dist }) : '',
        mode,
        region: roam.region ? tr('meta.in_region', { region: roam.region }) : '',
      })
  const editorial =
    roam.hook ??
    (roam.description ? truncateAtSentence(roam.description, 160) : null) ??
    tr('meta.fallback_desc', { mode, count: roam.checkpoints.filter((c) => c.required).length })
  // Lead the snippet with the facts the query asked for, then the editorial hook.
  const facts = [
    dist ? tr('meta.fact_miles', { miles: dist }) : null,
    roam.estimated_minutes ? tr('meta.fact_minutes', { min: roam.estimated_minutes }) : null,
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
function shortWhen(date: string, time: string | null, locale: SiteLocale): string {
  const d = siteDate(locale, `${date}T12:00:00-05:00`, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
  if (!time) return d
  if (locale !== 'en') {
    // The ride's Boston wall-clock time in the page's language (read in UTC so no zone shifts it).
    return `${d} · ${siteTime(locale, `2000-01-01T${time.slice(0, 5)}:00Z`, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })}`
  }
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return `${d} · ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

/** A translated sentence with one slot shown in bold ("Unlock the **Minuteman** badge"). */
function boldSlot(sentence: string, slot: string, value: string): React.ReactNode {
  const [before, after = ''] = sentence.split(slot)
  return (
    <>
      {before}
      <span className="font-semibold">{value}</span>
      {after}
    </>
  )
}

/* ── Page ── */

/** The visitor's first questions as three tiles: how long, how long it takes,
 *  how many stops. Where it starts and ends reads as one line under them
 *  (Keith 2026-10-20: same shape as the app; four tiles wrapped awkwardly). */
function glance(roam: RoamDetail, isLoop: boolean, stops: number, bonus: number, t: TT) {
  const tiles: Array<{ icon: typeof Ruler; label: string; value: string; sub: string | null }> = []
  if (roam.distance_miles && roam.distance_miles > 0) {
    tiles.push({
      icon: Ruler,
      label: t('tile.length'),
      value: t('tile.mi', { mi: miles(roam.distance_miles) }),
      sub:
        roam.full_trail_miles && roam.full_trail_miles > roam.distance_miles + 0.2
          ? t('tile.of_miles', { miles: miles(roam.full_trail_miles) })
          : isLoop
            ? t('tile.loop')
            : null,
    })
  }
  if (roam.estimated_minutes) {
    tiles.push({
      icon: Clock,
      label: t('tile.time'),
      value: duration(roam.estimated_minutes, t),
      sub: roam.mode === 'bike' ? t('tile.by_bike') : roam.mode === 'walk' ? t('tile.on_foot') : t('tile.stops_included'),
    })
  }
  if (stops > 0) {
    tiles.push({
      icon: MapPin,
      label: t('tile.stops'),
      value: t(stops === 1 ? 'tile.stops_one' : 'tile.stops_other', { count: stops }),
      sub: bonus > 0 ? t('tile.plus_bonus', { count: bonus }) : null,
    })
  }
  return tiles
}

export default async function RoamDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { lang } = await searchParams
  await forwardTour(id, lang)
  const locale = await siteLocale(lang)
  const tr = translator(roamStrings, locale)
  // The Roam's text and stops in the page's language (translation plan, batch 8).
  const roam = await localizeRoamDetail(await getRoamDetail(decodeURIComponent(id)), locale)
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
      ? tr('completion.threshold', { n: thresholdStops, total: requiredCount })
      : requiredCount > 0
        ? requiredCount === 2 ? tr('completion.both') : tr('completion.all', { total: requiredCount })
        : null

  const startLabel = requiredStops[0]?.label ?? null
  const last = requiredStops.length > 1 ? requiredStops[requiredStops.length - 1] : null
  const isLoop = !!(last && first && Math.abs(last.lat - first.lat) < 0.0005 && Math.abs(last.lng - first.lng) < 0.0005)
  const endLabel = last && !isLoop ? last.label : null
  const tiles = glance(roam, isLoop, isLoop ? requiredCount - 1 : requiredCount, bonusStops.length, tr)
  const startLine = startLabel
    ? isLoop
      ? tr('start.loop', { start: startLabel })
      : endLabel
        ? tr('start.start_end', { start: startLabel, end: endLabel })
        : tr('start.only', { start: startLabel })
    : null
  const creditLine =
    roam.credit_role && roam.credit_name ? tr(roam.credit_role === 'suggested' ? 'credit.suggested' : 'credit.designed', { name: roam.credit_name }) : null
  const directionsUrl = first
    ? `https://www.google.com/maps/dir/?api=1&destination=${first.lat},${first.lng}&travelmode=${roam.mode === 'bike' ? 'bicycling' : roam.mode === 'walk' ? 'walking' : 'transit'}`
    : null
  const video = parseVideoEmbed(roam.hero_video_url)
  const appTitle = tr(roam.mode === 'walk' ? 'app.title_walk' : roam.mode === 'bike' ? 'app.title_ride' : 'app.title_follow')
  const groupWhen = groupEvent ? shortWhen(groupEvent.event_date, groupEvent.event_time, locale) : null

  // Live Bluebikes near the start, for the first stop card and Getting there.
  const nearDocks = docks.slice(0, 2)
  const walkMinTo = (m: number) => Math.max(1, Math.round(m / 80))
  // Suggest the nearest station that has a bike right now.
  const dockWithBikes = nearDocks.find((d) => d.num_bikes_available > 0) ?? null
  const startDockLine = dockWithBikes
    ? tr(dockWithBikes.num_bikes_available === 1 ? 'stop.bluebikes_one' : 'stop.bluebikes_other', { name: dockWithBikes.name, count: dockWithBikes.num_bikes_available, walk: walkMinTo(dockWithBikes.distance_meters) })
    : null

  const hasRoute = requiredStops.length > 0
  const hasGettingThere = !!(first || roam.access_note || roam.parking_note || roam.rail_home || nearDocks.length > 0 || roam.surface)
  const sections = [
    hasRoute ? { id: 'route', label: tr('section.route') } : null,
    hasGettingThere ? { id: 'getting-there', label: tr('section.get_there') } : null,
    keepGoing.length > 0 ? { id: 'keep-going', label: tr('section.keep_going') } : null,
    // On phones the summary's group ride row links here, so the bar keeps to one line.
    groupEvent ? { id: 'group-ride-section', label: tr('section.group_ride'), phoneHidden: keepGoing.length > 0 } : null,
    { id: 'how-it-works', label: tr('section.how') },
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
        <p className="text-[0.9375rem] font-semibold text-navy">{appTitle}</p>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
          {roam.badge_name ? tr('app.body_badge', { badge: roam.badge_name }) : tr('app.body')}
        </p>
      </div>
      <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_after_map" tone="light" className="shrink-0 [&>a]:max-[420px]:basis-full" />
    </div>
  )

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
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
                  locale={locale}
                />
              </div>
            )}
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="text-[0.875rem] text-ink-soft">
                <Link href={withLang('/shift/roams', locale)} className="font-semibold text-forest underline-offset-4 hover:underline">{tr('crumb.roams')}</Link>
                {roam.region ? <span> · {roam.region}</span> : null}
              </nav>
              <h1 className="mt-1.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">
                {roam.name}
              </h1>
              {/* What this roam is, first (Keith 2026-10-22). */}
              <RoamLede hook={roam.hook} description={roam.description} locale={locale} />
              {(creditLine || roam.route_url || roam.completion_count >= MIN_COMPLETIONS_TO_SHOW) && (
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-ink-soft">
                  {creditLine && <span>{creditLine}</span>}
                  {roam.completion_count >= MIN_COMPLETIONS_TO_SHOW && <span>{tr('overview.completed_by', { count: roam.completion_count })}</span>}
                  {roam.route_url && (
                    <a href={roam.route_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                      {tr('overview.about_trail')} <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                </p>
              )}

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
                  <Flag size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden />
                  <span>
                    {startLine}
                    {first && (
                      <>
                        {' · '}
                        <a href={directionsUrl!} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline-offset-4 hover:underline">
                          {tr('overview.directions')}
                        </a>
                      </>
                    )}
                  </span>
                </p>
              )}

              {roam.elevation && (
                <RoamHills elevation={roam.elevation} isLoop={isLoop} from={startLabel} to={endLabel} locale={locale} />
              )}

              {roam.badge_name && (
                <p className="mt-2.5 flex items-center gap-2 text-[0.9375rem] text-navy">
                  <Award size={15} className="shrink-0 text-[#8A6D1F]" aria-hidden />
                  <span>{boldSlot(tr('overview.unlock_badge'), '{badge}', roam.badge_name)}</span>
                </p>
              )}

              {(disruptions.length > 0 || groupEvent) && (
                <div className="mt-4 space-y-2.5">
                  <RoamDisruptions items={disruptions} locale={locale} />
                  {groupEvent && groupWhen && (
                    <a
                      href="#group-ride-section"
                      className="group flex min-h-[48px] items-center gap-3 rounded-[14px] bg-forest/[0.07] px-4 py-2.5 text-[0.9375rem] text-navy transition-colors hover:bg-forest/[0.11]"
                    >
                      <Users size={17} className="shrink-0 text-forest" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{tr('overview.group_ride')}</span> <span className="text-ink-soft">· {groupWhen}</span>
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
        <RoamSectionNav sections={sections} locale={locale} />

        {/* ── The route: map fixed beside the stop list on wide screens ── */}
        {hasRoute && (
          <section id="route" aria-labelledby="route-h" className="scroll-mt-28 px-6 pt-8 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="route-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                {tr('route.h2')}
              </h2>
              {trailsUsed.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.875rem]">
                  <span className="text-ink-soft">{tr('route.on_this')}</span>
                  {trailsUsed.map((x) => (
                    <Link key={x.id} href={withLang(`/trails/${x.id}`, locale)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold underline-offset-4 hover:underline ${x.closed ? 'bg-[#FFF4EC] text-[#9A3412]' : 'bg-forest/[0.08] text-forest'}`}>
                      {x.name}
                      {x.miles != null ? <span className="font-medium opacity-80">· {tr('tile.mi', { mi: miles(Number(x.miles)) })}</span> : null}
                    </Link>
                  ))}
                </p>
              )}
              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                <div className="space-y-4 lg:sticky lg:top-[124px]">
                  {(roam.route_coordinates || roam.checkpoints.length > 0) && (
                    <div>
                      <div className="h-[320px] overflow-hidden rounded-[18px] border border-navy/10 sm:h-[400px] lg:h-[min(520px,calc(100vh-300px))]">
                        <RoamMap
                          locale={locale}
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
                        {tr(bonusStops.length > 0 ? 'route.pins_bonus' : 'route.pins')}
                      </p>
                    </div>
                  )}
                  {/* Route notes on this Roam's line, while the switch is on (Shift 01763). */}
                  <RoamNotes routeCoordinates={roam.route_coordinates} mode={roam.mode} locale={locale} />
                  {/* The app box follows the map, as it has since 2026-10-15 (exp-2026-09-7). */}
                  {appBox}
                </div>
                <RoamStopList stops={requiredStops} bonus={bonusStops} legs={roam.legs} startDockLine={startDockLine} locale={locale} />
              </div>
            </div>
          </section>
        )}

        {/* ── Getting there ── */}
        {hasGettingThere && (
          <section id="getting-there" aria-labelledby="getting-there-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="getting-there-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                {tr('getting.h2')}
              </h2>
              <div className={`mt-5 grid gap-6 lg:items-start ${roam.rail_home ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
                <div className="min-w-0">
                  {first && (
                    <a
                      href={directionsUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-navy px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-navy/90 sm:w-auto"
                    >
                      <Navigation size={16} aria-hidden /> {tr('getting.directions_to', { place: first.label })}
                    </a>
                  )}
                  {trailsConnect.length > 0 && (
                    <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.875rem]">
                      <span className="text-ink-soft">{tr('getting.connects')}</span>
                      {trailsConnect.map((x) => (
                        <Link key={x.id} href={withLang(`/trails/${x.id}`, locale)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold underline-offset-4 hover:underline ${x.closed ? 'bg-[#FFF4EC] text-[#9A3412]' : 'bg-forest/[0.08] text-forest'}`}>
                          {x.name}
                          {x.closed ? <span className="font-medium">· {tr('getting.closed')}</span> : null}
                        </Link>
                      ))}
                    </p>
                  )}
                  {/* Without a trains-home list beside it, the details spread into two columns. */}
                  <dl className={`mt-5 overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] ${roam.rail_home ? 'divide-y divide-navy/[0.07]' : 'grid gap-px bg-navy/[0.07] lg:grid-cols-2 [&>div]:bg-white'}`}>
                    {roam.access_note && (
                      <div className="px-5 py-4">
                        <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Navigation size={15} className="text-forest" aria-hidden /> {tr('getting.by_transit')}</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.access_note}</dd>
                      </div>
                    )}
                    {nearDocks.length > 0 && (
                      <div className="px-5 py-4">
                        <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Bike size={15} className="text-forest" aria-hidden /> {tr('getting.docks')}</dt>
                        <dd className="m-0 mt-1.5">
                          <ul className="space-y-2">
                            {nearDocks.map((d) => (
                              <li key={d.station_id} className="text-[0.9375rem] leading-snug">
                                <span className="text-navy">{d.name}</span>
                                <span className="block tabular-nums text-ink-soft">
                                  {tr('dock.walk', { min: walkMinTo(d.distance_meters) })} · {d.num_bikes_available === 0 ? tr('dock.no_bikes') : tr(d.num_bikes_available === 1 ? 'dock.bikes_one' : 'dock.bikes_other', { count: d.num_bikes_available })} · {tr(d.num_docks_available === 1 ? 'dock.docks_one' : 'dock.docks_other', { count: d.num_docks_available })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {roam.parking_note && (
                      <div className="px-5 py-4">
                        <dt className="text-[0.9375rem] font-semibold text-navy">{tr('getting.parking')}</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.parking_note}</dd>
                      </div>
                    )}
                    {roam.surface && (
                      <div className="px-5 py-4">
                        <dt className="text-[0.9375rem] font-semibold text-navy">{tr('getting.surface')}</dt>
                        <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{roam.surface}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="min-w-0">
                  {roam.rail_home && (
                    <TrainsHome stopId={roam.rail_home.stop_id} routeId={roam.rail_home.route_id} directionId={roam.rail_home.direction_id} locale={locale} />
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Keep going: where you can ride on from either end (Shift 01289) ── */}
        {keepGoing.length > 0 && (
          <section id="keep-going" aria-labelledby="keep-going-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="keep-going-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                {tr('keep.h2')}
              </h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                {tr('keep.body', { name: roam.name })}
              </p>
              <RoamKeepGoing
                locale={locale}
                roamId={roam.id}
                roamName={roam.name}
                route={roam.route_coordinates}
                rows={keepGoing}
                closed={disruptions.map((d) => d.closed_geometry).filter((g): g is [number, number][] => !!g && g.length > 1)}
              />
            </div>
          </section>
        )}

        {/* ── Group ride (Shift 01229), 14 days out until it ends ── */}
        {groupEvent && (
          <section id="group-ride-section" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <RoamGroupEventCard event={groupEvent} bare locale={locale} />
            </div>
          </section>
        )}

        {/* ── How it works: the closing step, with the app (the description and
            credits moved to the top, Keith 2026-10-22) ── */}
        <section id="how-it-works" aria-labelledby="how-h" className="scroll-mt-28 px-6 pb-20 pt-14 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="how-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
              {tr('how.h2')}
            </h2>
            <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
              {tr('how.lede')}
            </p>
            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Navigation, title: tr('how.step1_title'), body: tr('how.step1_body') },
                { icon: MapPinned, title: tr('how.step2_title'), body: `${tr('how.step2_body')}${completionHint ? ` ${completionHint}` : ''}` },
                {
                  icon: BadgeCheck,
                  title: roam.badge_name ? tr('how.step3_title_badge', { badge: roam.badge_name }) : tr('how.step3_title'),
                  body: `${roam.badge_name ? tr('how.step3_body_badge', { badge: roam.badge_name }) : tr('how.step3_body')}${roam.collection ? ` ${tr('how.collection_bonus', { count: roam.collection.item_count, collection: roam.collection.name })}` : ''}`,
                },
              ].map((step, i) => (
                <li key={step.title} className="rounded-[16px] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
                  <p className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-navy">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest/[0.1] text-[0.8125rem] font-bold text-forest" aria-hidden>{i + 1}</span>
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
            {roam.collection && (
              <p className="mt-4 text-[0.9375rem] text-ink-soft">
                <span className="font-semibold text-forest">{tr('how.part_of', { collection: roam.collection.name })}</span> {tr('how.part_of_rest', { count: roam.collection.item_count, badge: roam.collection.badge_name })}
              </p>
            )}
            <div className="mt-6">
              <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="roam_bottom" tone="light" />
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
