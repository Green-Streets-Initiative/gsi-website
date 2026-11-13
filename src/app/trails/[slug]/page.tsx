import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Ruler, Route, MapPin, Flag, Navigation, Bike, TrainFront, ParkingCircle, ExternalLink, ArrowRight, CircleCheck, Info, Clock, Snowflake } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import PhotoCredit from '@/components/PhotoCredit'
import TrailMap from '@/components/trails/TrailMap'
import GpxLink from '@/components/trails/GpxLink'
import TrainsHome from '@/components/roams/TrainsHome'
import RoamDisruptions from '@/components/roams/RoamDisruptions'
import RoamSectionNav from '@/components/roams/RoamSectionNav'
import RoamKeepGoing from '@/components/roams/RoamKeepGoing'
import { getTrail, isLoopLike, type TrailNotice } from '@/lib/trails/queries'
import { getTrailLines } from '@/lib/trails/geometry'
import { MAP_PLACES } from '@/lib/trails/places'
import { RAIL_HOME } from '@/lib/trails/railHome'
import { getPathConditions } from '@/lib/trails/conditions'
import { clearedShort, CONDITION_COLOR, headline, isWintry, reportLine, snowLine, timeOf } from '@/lib/trails/conditionText'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import { withUtm } from '@/lib/utm'
import { getTourTrails, roamHref } from '@/lib/trails/tours'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { siteDate, translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { trailStrings, type TrailKey } from '@/lib/site-strings/trails'

type TT = T<TrailKey>
type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string | string[] }> }

// Ten minutes: path conditions after snow change through the morning.
export const revalidate = 600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

/** 2 -> "2", 6.39 -> "6.4" */
function miles(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** "Oct 19, 2026" from a YYYY-MM-DD date. */
function day(d: string, locale: SiteLocale = 'en'): string {
  return siteDate(locale, `${d}T12:00:00-04:00`, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
}

/** Research text as one clean sentence: dates as "Dec 31, 2026", one closing period. */
function sentence(s: string, locale: SiteLocale = 'en'): string {
  const t = s.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => day(d, locale)).trim().replace(/\.+$/, '')
  return `${t}.`
}

/** 110 -> "1 hr 50 min", 42 -> "42 min" */
function duration(min: number, t: TT): string {
  const m = Math.round(min)
  if (m < 60) return t('dur.min', { m })
  const h = Math.floor(m / 60)
  const rest = Math.round((m % 60) / 5) * 5
  return rest ? t('dur.hr_min', { h, m: rest }) : t('dur.hr', { h })
}

/** "Alewife Station, Cambridge" -> "Alewife Station"; "North end, Old Colony Road, downtown Mansfield" -> "downtown Mansfield" */
function place(name: string): string {
  const parts = name.split(' (')[0].split(', ').map((x) => x.trim())
  if (parts.length > 1 && /^(north|south|east|west)(ern)? end$/i.test(parts[0])) return parts[parts.length - 1]
  return parts[0]
}

/** The surface as one or two words for the summary tile; the full sentence is in About. */
function surfaceTile(s: string | null, tr: TT): { value: string; sub: string | null } | null {
  if (!s) return null
  const t = s.trim()
  if (/^mixed/i.test(t)) return { value: tr('surf.mixed'), sub: tr('surf.paved_unpaved') }
  if (/^mostly paved/i.test(t)) return { value: tr('surf.mostly_paved'), sub: null }
  if (/^paved/i.test(t)) {
    if (/\bexcept\b/i.test(t)) return { value: tr('surf.mostly_paved'), sub: null }
    return { value: tr('surf.paved'), sub: /whole (way|length|loop)/i.test(t) ? tr('surf.whole_way') : null }
  }
  if (/stone|dirt|sand|clay|gravel|crushed/i.test(t)) return { value: tr('surf.unpaved'), sub: /stone dust|crushed stone/i.test(t) ? tr('surf.stone_dust') : null }
  return null
}

function townsLine(towns: string[], t: TT): string {
  if (towns.length <= 3) return towns.join(', ')
  return t('towns.more', { list: towns.slice(0, 3).join(', '), count: towns.length - 3 })
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const tr = translator(trailStrings, await siteLocale((await searchParams).lang))
  const data = await getTrail(decodeURIComponent(slug))
  if (!data) return { title: tr('meta.not_found') }
  const t = data.trail
  const pts = t.access_points
  const title = searchTitle(t.name, t.full_miles, pts.some((p) => !!p.parking) || !!t.parking_note, tr)
  const description = searchDescription(t.summary, t.name, tr)
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/trails/${t.id}` },
    openGraph: { title, description, url: `${SITE_URL}/trails/${t.id}`, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

/**
 * The search title: the trail's name first, then what people look a trail up
 * for (the map, parking, where to get on), kept near Google's ~60 characters.
 * The length rides along in brackets only when it fits; the roam title test
 * (exp-2026-09-5) found a distance in the title bought no clicks.
 */
function searchTitle(name: string, fullMiles: number | null, hasParking: boolean, t: TT): string {
  const withLen = fullMiles ? t(hasParking ? 'meta.title_len_parking' : 'meta.title_len', { name, miles: miles(fullMiles) }) : null
  return withLen && withLen.length <= 62 ? withLen : t(hasParking ? 'meta.title_parking' : 'meta.title', { name })
}

/** The summary's opening sentences up to ~155 characters, then what only the page has. */
function searchDescription(summary: string | null, name: string, t: TT): string {
  const tail = t('meta.tail')
  if (!summary) return t('meta.no_summary', { name })
  const sentences = summary.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [summary]
  let out = ''
  for (const x of sentences) {
    if ((out + x).trim().length > 155) break
    out += x
  }
  out = out.trim() || summary.slice(0, 150).replace(/\s+\S*$/, '') + '…'
  return out.length + tail.length + 1 <= 160 ? `${out} ${tail}` : out
}

/**
 * A long fact note as its first sentence, with the rest one tap away: the
 * Getting there notes run 7 to 10 lines on a phone (polish 2026-11-04, one
 * sentence per card). Plain <details>, so it works without JavaScript and
 * the full text stays in the page for search.
 */
function Brief({ text, t }: { text: string; t: TT }) {
  const m = text.match(/^.+?[.!?](?=\s+[A-Z(])/)
  const head = m ? m[0] : text
  const rest = m ? text.slice(head.length).trim() : ''
  if (!rest || head.length < 40) return <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{text}</dd>
  return (
    <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
      {head}
      <details className="group/more mt-1">
        <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center text-[0.875rem] font-semibold text-forest [&::-webkit-details-marker]:hidden">
          <span className="group-open/more:hidden">{t('brief.more')}</span>
          <span className="hidden group-open/more:inline">{t('brief.less')}</span>
        </summary>
        <p className="m-0">{rest}</p>
      </details>
    </dd>
  )
}

function NoticeList({ items, t, locale }: { items: TrailNotice[]; t: TT; locale: SiteLocale }) {
  return (
    <ul className="space-y-3">
      {items.map((n, i) => (
        <li key={i} className="rounded-[14px] border border-[#8A6D1F]/20 bg-[#FFFAEB] px-4 py-3">
          <p className="text-[0.9375rem] font-semibold leading-snug text-navy">{n.what}</p>
          {n.where && <p className="mt-0.5 text-[0.875rem] text-ink-soft">{n.where}</p>}
          {(n.end || n.detour) && (
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
              {n.end ? <>{/^\d{4}-\d{2}-\d{2}$/.test(n.end) ? t('notices.until', { date: day(n.end, locale) }) : sentence(n.end, locale)} </> : null}
              {n.detour ? <>{sentence(n.detour, locale)}</> : null}
            </p>
          )}
          {n.source_url && (
            <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-forest underline underline-offset-4">
              {t('notices.source')} <ExternalLink size={11} aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** "lexingtonma.gov/717/Minuteman-Bikeway" for the sources list. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '')
  } catch {
    return url
  }
}

export default async function TrailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const locale = await siteLocale((await searchParams).lang)
  const tr = translator(trailStrings, locale)
  const data = await getTrail(decodeURIComponent(slug))
  if (!data) notFound()
  const { trail: t, disruptions, roams, keepGoing } = data
  const tours = await getTourTrails()

  const pts = t.access_points
  const first = pts[0] ?? null
  const last = pts.length > 1 ? pts[pts.length - 1] : null
  const [geo, docksFirst, docksLast, conditions] = await Promise.all([
    getTrailLines(t.id),
    first ? getBluebikesDocks(first.lat, first.lng, 600).catch(() => []) : Promise.resolve([]),
    last ? getBluebikesDocks(last.lat, last.lng, 600).catch(() => []) : Promise.resolve([]),
    getPathConditions(),
  ])
  const lines = geo?.lines ?? []
  // Place names for the maps: this trail's (lib/trails/places.ts), at its own access points.
  const places = MAP_PLACES.filter((m) => m.trail === t.id).flatMap((m) => {
    const p = pts.find((x) => x.name.includes(m.match))
    return p ? [{ label: m.label, lat: p.lat, lng: p.lng }] : []
  })
  const closedLines = disruptions.map((d) => d.closed_geometry).filter((g): g is [number, number][] => !!g && g.length > 1)

  const tour = roams.find((r) => r.is_tour) ?? null
  // A trail page shows the trail itself: a roam's photo only when it is of the
  // place (Wikimedia and partner photos), never a stock image.
  const tourPhoto = tour?.hero_image_url && !/unsplash/i.test(`${tour.hero_image_attribution ?? ''} ${tour.hero_image_url}`) ? tour : null
  const photoUrl = t.hero_image_url ?? tourPhoto?.hero_image_url ?? null
  const otherRoams = roams.filter((r) => r !== tour && r.relation === 'uses')
  // Directions to the trail by bike, or on foot for a walking roam, as the app's
  // trail links do (parity gap-web-directions-drive).
  const travelmode = tour?.mode === 'walk' ? 'walking' : 'bicycling'
  const connectRoams = roams.filter((r) => r.relation === 'connects')
  const utm = { source: 'web_trail', medium: 'trail_page', campaign: t.id }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const surface = surfaceTile(t.surface, tr)
  const tiles = [
    t.full_miles ? { icon: Ruler, label: tr('tile.length'), value: tr('tile.mi', { mi: miles(t.full_miles) }), sub: t.kind } : null,
    surface ? { icon: Route, label: tr('tile.surface'), value: surface.value, sub: surface.sub } : null,
    pts.length > 0 ? { icon: MapPin, label: tr('tile.get_on'), value: tr(pts.length === 1 ? 'tile.places_one' : 'tile.places_other', { count: pts.length }), sub: tr('tile.on_map') } : null,
  ].filter((x): x is { icon: typeof Ruler; label: string; value: string; sub: string | null } => !!x)
  const loop = isLoopLike(pts)
  const spanLine = first && last && !loop
    ? tr('span.from_to', { from: place(first.name), to: place(last.name) })
    : loop && t.towns.length > 0
      ? t.towns.length === 1 ? tr('span.loop_in', { town: t.towns[0] }) : tr('span.loops_through', { towns: townsLine(t.towns, tr) })
      : null

  const walkMin = (m: number) => Math.max(1, Math.round(m / 80))
  const dockGroups = [
    first ? { label: place(first.name), docks: docksFirst.slice(0, 2) } : null,
    last ? { label: place(last.name), docks: docksLast.slice(0, 2) } : null,
  ].filter((g): g is { label: string; docks: typeof docksFirst } => !!g && g.docks.length > 0)

  const amen = t.amenities ?? {}
  const amenities = [
    amen.restrooms ? { label: tr('about.restrooms'), body: amen.restrooms } : null,
    amen.water ? { label: tr('about.water'), body: amen.water } : null,
    amen.food ? { label: tr('about.food'), body: amen.food } : null,
  ].filter((x): x is { label: string; body: string } => !!x)

  // Drivers' first question: can I park where I get on?
  const parkingCount = pts.filter((p) => p.parking).length
  // Ride out, train home: a Commuter Rail station at one of the places to get on.
  const rail = RAIL_HOME[t.id] ?? null
  const railPoint = rail ? pts.find((p) => p.name.includes(rail.match)) ?? null : null
  const railFrom = rail && railPoint ? rail.from ?? place(railPoint.name) : null
  const railReach = rail && railFrom
    ? rail.meters <= 400
      ? railFrom.includes(rail.station) ? tr('rail.right_on') : tr('rail.right_on_at', { place: railFrom })
      : tr('rail.miles_from', { miles: miles(rail.meters / 1609), place: railFrom })
    : null

  // Who clears snow: in About all year, and in the overview from November to
  // March. After snow, the newest report from someone who used the trail, or
  // how much snow fell, comes first (Keith 2026-10-31).
  const cond = conditions.get(t.id) ?? null
  const winter = cond?.winter ?? null
  const now = new Date()
  const month = Number(now.toLocaleDateString('en-US', { month: 'numeric', timeZone: 'America/New_York' }))
  const winterSeason = month >= 11 || month <= 3
  const winterShort = winter ? clearedShort(winter.cleared, locale) : null
  const nowLine = headline(cond, now, locale)
  const reportLines = (cond?.reports ?? []).flatMap((r) => (r.line ?? []).map((l) => ({ line: l, color: CONDITION_COLOR[r.condition] })))
  const hasWinterRow = !!winter || !!nowLine

  // One column per card, so a trail with no bike share has no empty third cell.
  const getThereCols = [t.transit_note, t.bike_share_note || dockGroups.length > 0, t.parking_note].filter(Boolean).length
  const hasGetThere = !!(t.transit_note || t.bike_share_note || t.parking_note || dockGroups.length > 0 || railReach)
  const sections = [
    { id: 'map', label: tr('section.map') },
    hasGetThere ? { id: 'get-there', label: tr('section.get_there') } : null,
    roams.length > 0 ? { id: 'roams', label: tr('section.roams') } : null,
    keepGoing.length > 0 ? { id: 'keep-going', label: tr('section.keep_going'), phoneHidden: roams.length > 0 } : null,
    { id: 'about', label: tr('section.about') },
  ].filter((x): x is { id: string; label: string; phoneHidden?: boolean } => !!x)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trails', item: `${SITE_URL}/trails` },
      { '@type': 'ListItem', position: 2, name: t.name, item: `${SITE_URL}/trails/${t.id}` },
    ],
  }

  // The trail as a place, for search engines and answer engines: where it is,
  // how long, the surface, each place to get on (with parking), and when the
  // facts were last checked. Everything here is on the page too.
  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: `${SITE_URL}/trails/${t.id}`,
    name: t.name,
    ...(t.facts_checked_on ? { dateModified: t.facts_checked_on } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Green Streets Initiative', url: SITE_URL },
    mainEntity: {
      '@type': 'TouristAttraction',
      name: t.name,
      ...(t.aka.length > 0 ? { alternateName: t.aka } : {}),
      ...(t.summary ? { description: t.summary } : {}),
      ...(photoUrl ? { image: photoUrl } : {}),
      isAccessibleForFree: true,
      publicAccess: true,
      ...(first ? { geo: { '@type': 'GeoCoordinates', latitude: first.lat, longitude: first.lng } } : {}),
      ...(t.towns.length > 0
        ? {
            address: { '@type': 'PostalAddress', addressLocality: t.towns[0], addressRegion: 'MA', addressCountry: 'US' },
            containedInPlace: t.towns.map((n) => ({ '@type': 'City', name: `${n}, Massachusetts` })),
          }
        : {}),
      additionalProperty: [
        t.full_miles ? { '@type': 'PropertyValue', name: 'Length', value: t.full_miles, unitCode: 'SMI' } : null,
        t.surface ? { '@type': 'PropertyValue', name: 'Surface', value: t.surface } : null,
        t.agency ? { '@type': 'PropertyValue', name: 'Managed by', value: t.agency } : null,
      ].filter(Boolean),
      ...([t.official_url, t.friends_url].filter(Boolean).length > 0 ? { sameAs: [t.official_url, t.friends_url].filter(Boolean) } : {}),
      containsPlace: pts.map((p) => ({
        '@type': 'Place',
        name: p.name,
        geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
        ...(p.parking ? { amenityFeature: { '@type': 'LocationFeatureSpecification', name: 'Parking', value: true, description: p.parking } } : {}),
      })),
    },
  }

  const statusRow =
    disruptions.length > 0 ? null : t.notices.length > 0 ? (
      <a href="#notices" className="group flex min-h-[48px] items-center gap-3 rounded-[14px] bg-[#FFFAEB] px-4 py-2.5 text-[0.9375rem] text-navy ring-1 ring-[#8A6D1F]/20 transition-colors hover:bg-[#FFF4D6]">
        <Info size={17} className="shrink-0 text-[#8A6D1F]" aria-hidden />
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
          <span className="font-semibold">{tr(t.notices.length === 1 ? 'status.notice_one' : 'status.notice_other', { count: t.notices.length })}</span>{' '}
          <span className="text-ink-soft">
            {t.notices[0].what}
            {t.notices[0].where ? `, ${t.notices[0].where.charAt(0).toLowerCase()}${t.notices[0].where.slice(1)}` : ''}
            {t.notices[0].end && /^\d{4}-\d{2}-\d{2}$/.test(t.notices[0].end) ? `, ${tr('status.until', { date: day(t.notices[0].end, locale) })}` : ''}
          </span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-[#8A6D1F] transition-transform group-hover:translate-x-0.5" aria-hidden />
      </a>
    ) : t.closures_checked_on ? (
      <p className="flex items-center gap-2 text-[0.9375rem] text-navy">
        <CircleCheck size={16} className="shrink-0 text-forest" aria-hidden />
        <span>
          <span className="font-semibold">{tr('status.open')}</span> <span className="text-ink-soft">{tr('status.no_closures', { date: day(t.closures_checked_on, locale) })}</span>
        </span>
      </p>
    ) : null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        {/* ── Overview: how long, what it's like, where to get on, is it open ── */}
        <section className="px-6 pt-5 lg:px-8 lg:pt-10">
          <div className={`mx-auto grid max-w-[1120px] gap-5 ${photoUrl ? 'lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-12' : ''}`}>
            {photoUrl && (
              // After the facts on phones so the first screen answers the question; beside them on desktop.
              <figure className="order-last">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={t.name}
                  className="aspect-[16/10] w-full rounded-[18px] object-cover shadow-[0_1px_2px_rgba(25,26,46,0.06)]"
                />
                {(t.hero_image_url ? t.hero_image_attribution : tourPhoto?.hero_image_attribution) ? (
                  <figcaption className="mt-1.5 text-[0.75rem] text-ink-soft">
                    <PhotoCredit
                      text={t.hero_image_url ? t.hero_image_attribution : tourPhoto?.hero_image_attribution}
                      url={t.hero_image_url ? t.hero_image_attribution_url : tourPhoto?.hero_image_attribution_url}
                    />
                  </figcaption>
                ) : null}
              </figure>
            )}
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="text-[0.875rem] text-ink-soft">
                <Link href={withLang('/trails', locale)} className="font-semibold text-forest underline-offset-4 hover:underline">{tr('crumb.trails')}</Link>
                {t.towns.length > 0 ? <span> · {townsLine(t.towns, tr)}</span> : null}
              </nav>
              <h1 className="mt-1.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">{t.name}</h1>
              {t.summary && <p className="mt-2.5 max-w-[60ch] text-[1.0625rem] leading-[1.55] text-ink-soft">{t.summary}</p>}

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
              {spanLine && (
                <p className="mt-3 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  <Flag size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden /> {spanLine}
                </p>
              )}
              {(parkingCount > 0 || t.parking_note) && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  <ParkingCircle size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden />
                  <span>
                    {parkingCount === 0
                      ? tr('park.nearby')
                      : parkingCount === pts.length
                        ? tr('park.every')
                        : tr('park.some', { count: parkingCount, total: pts.length })}
                    {' · '}
                    <a href={parkingCount > 0 ? '#map' : '#get-there'} className="font-semibold text-forest underline-offset-4 hover:underline">
                      {parkingCount > 0 ? tr('park.see') : tr('park.where')}
                    </a>
                  </span>
                </p>
              )}
              {railReach && rail && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  <TrainFront size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden />
                  <span>
                    {tr('rail.back', { station: rail.station })}{' · '}
                    <a href="#train-home" className="font-semibold text-forest underline-offset-4 hover:underline">{tr('rail.next')}</a>
                  </span>
                </p>
              )}

              {nowLine && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  {nowLine.kind === 'report'
                    ? <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CONDITION_COLOR[nowLine.condition] }} aria-hidden />
                    : <Snowflake size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden />}
                  <span>
                    <span className="font-semibold">{nowLine.text}</span>
                    {nowLine.kind === 'report' ? ` · ${tr('now.reported_by', { when: nowLine.when })}` : ''}
                    {' · '}
                    <a href="#winter" className="font-semibold text-forest underline-offset-4 hover:underline">{tr('now.conditions')}</a>
                  </span>
                </p>
              )}
              {winter && winterSeason && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                  <Snowflake size={15} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden />
                  <span>
                    {winterShort}{' · '}
                    <a href="#winter" className="font-semibold text-forest underline-offset-4 hover:underline">{tr('now.who_clears')}</a>
                  </span>
                </p>
              )}

              <div className="mt-4 space-y-2.5">
                <RoamDisruptions items={disruptions} subject="trail" locale={locale} />
                {statusRow}
              </div>

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                {tour ? (
                  <Link
                    href="#roams"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-navy px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-navy/90"
                  >
                    {tr(tour.mode === 'walk' ? 'cta.walk_roam' : 'cta.ride_roam')} <ArrowRight size={16} aria-hidden />
                  </Link>
                ) : null}
                {first && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${first.lat},${first.lng}&travelmode=${travelmode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-colors ${tour ? 'bg-white text-navy ring-1 ring-navy/15 hover:bg-navy/[0.04]' : 'bg-navy text-white hover:bg-navy/90'}`}
                  >
                    <Navigation size={16} aria-hidden /> {place(first.name).length <= 18 ? tr('cta.directions_to', { place: place(first.name) }) : tr('cta.directions_trail')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <RoamSectionNav sections={sections} locale={locale} />

        {/* ── Map and the places to get on ── */}
        <section id="map" aria-labelledby="map-h" className="scroll-mt-28 px-6 pt-8 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="map-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">{tr('map.h2')}</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="lg:sticky lg:top-[124px]">
                <div className="h-[320px] overflow-hidden rounded-[18px] border border-navy/10 sm:h-[400px] lg:h-[min(560px,calc(100vh-240px))]">
                  <TrailMap locale={locale} name={t.name} lines={lines} points={pts.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, parking: !!p.parking }))} closed={closedLines} places={places} reports={reportLines} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-[0.875rem] text-ink-soft">
                    {tr(parkingCount > 0 ? (closedLines.length > 0 ? 'map.legend_p_closed' : 'map.legend_p') : closedLines.length > 0 ? 'map.legend_closed' : 'map.legend')}
                  </p>
                  {lines.length > 0 && (
                    <GpxLink
                      trailId={t.id}
                      label={tr('map.gpx')}
                      className="inline-flex min-h-[40px] items-center gap-1.5 text-[0.9375rem] font-semibold text-forest underline-offset-4 hover:underline"
                    />
                  )}
                </div>
                {lines.length > 0 && (
                  <p className="text-[0.875rem] text-ink-soft">{tr('map.gpx_for')}</p>
                )}
              </div>
              <ol className="divide-y divide-navy/[0.07] rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
                {pts.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex gap-3.5 px-4 py-4 sm:px-5">
                    <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-navy text-[0.75rem] font-bold text-white" aria-hidden>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[1rem] font-semibold leading-snug text-navy">{p.name}</h3>
                      {p.notes && <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{p.notes}</p>}
                      {(p.transit || p.parking) && (
                        <dl className="mt-2 space-y-1 text-[0.875rem] leading-snug">
                          {p.transit && (
                            <div className="flex gap-2">
                              <dt className="shrink-0"><TrainFront size={14} className="mt-[2px] text-forest" aria-label={tr('pt.transit')} /></dt>
                              <dd className="m-0 text-navy">{p.transit}</dd>
                            </div>
                          )}
                          {p.parking && (
                            <div className="flex gap-2">
                              <dt className="shrink-0"><ParkingCircle size={14} className="mt-[2px] text-forest" aria-label={tr('pt.parking')} /></dt>
                              <dd className="m-0 text-navy">{p.parking}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${travelmode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-[0.875rem] font-semibold text-forest underline-offset-4 hover:underline"
                      >
                        <Navigation size={13} aria-hidden /> {tr('pt.directions')}
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Getting there ── */}
        {hasGetThere && (
          <section id="get-there" aria-labelledby="get-there-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="get-there-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">{tr('get.h2')}</h2>
              {getThereCols > 0 && (
              <dl className={`mt-5 grid gap-px overflow-hidden rounded-[16px] bg-navy/[0.07] shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] ${getThereCols === 3 ? 'lg:grid-cols-3' : getThereCols === 2 ? 'lg:grid-cols-2' : ''}`}>
                {t.transit_note && (
                  <div className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><TrainFront size={15} className="text-forest" aria-hidden /> {tr('get.transit')}</dt>
                    <Brief text={t.transit_note} t={tr} />
                  </div>
                )}
                {(t.bike_share_note || dockGroups.length > 0) && (
                  <div className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Bike size={15} className="text-forest" aria-hidden /> {tr('get.bike_share')}</dt>
                    {/* The live docks at each end say it better; the note is for trails with none nearby. */}
                    {t.bike_share_note && dockGroups.length === 0 && <Brief text={t.bike_share_note} t={tr} />}
                    {dockGroups.length > 0 && (
                      <dd className="m-0 mt-3 space-y-3">
                        {dockGroups.map((g) => (
                          <div key={g.label}>
                            <p className="text-[0.8125rem] font-semibold text-navy">{tr('get.near', { place: g.label })}</p>
                            <ul className="mt-1 space-y-1.5">
                              {g.docks.map((d) => (
                                <li key={d.station_id} className="text-[0.875rem] leading-snug">
                                  <span className="text-navy">{d.name}</span>
                                  <span className="block tabular-nums text-ink-soft">
                                    {tr('dock.walk', { min: walkMin(d.distance_meters) })} · {d.num_bikes_available === 0 ? tr('dock.no_bikes') : tr(d.num_bikes_available === 1 ? 'dock.bikes_one' : 'dock.bikes_other', { count: d.num_bikes_available })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </dd>
                    )}
                  </div>
                )}
                {t.parking_note && (
                  <div className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><ParkingCircle size={15} className="text-forest" aria-hidden /> {tr('get.parking')}</dt>
                    <Brief text={t.parking_note} t={tr} />
                  </div>
                )}
              </dl>
              )}
              {rail && railReach && (
                <div id="train-home" className="mt-8 grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
                  <div>
                    <h3 className="text-[1.25rem] font-semibold text-navy">{tr('train.h3')}</h3>
                    <p className="mt-1.5 max-w-[52ch] text-[1rem] leading-relaxed text-ink-soft">
                      {tr('train.body', { station: rail.station, reach: railReach })}
                    </p>
                  </div>
                  <TrainsHome stopId={rail.stop_id} routeId={rail.route_id} directionId={rail.direction_id} headed={false} locale={locale} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Roams on this trail ── */}
        {roams.length > 0 && (
          <section id="roams" aria-labelledby="roams-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="roams-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                {tr(roams.length === 1 ? 'roams.h2_one' : 'roams.h2_other')}
              </h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                {tr('roams.lede')}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...(tour ? [tour] : []), ...otherRoams, ...connectRoams].map((r) => {
                  // This trail's own tour roams live on this page (their roam pages forward
                  // here), so their cards point at the app; a roam that tours another
                  // trail goes to that trail's page.
                  const href = tours.get(r.id) === t.id ? null : withLang(roamHref(r.id, tours), locale)
                  return (
                  <div
                    key={r.id}
                    className={`group relative flex flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] ${href ? 'transition-shadow hover:shadow-[0_4px_14px_rgba(25,26,46,0.08),0_0_0_1px_rgba(25,26,46,0.08)]' : ''}`}
                  >
                    {r.hero_image_url && r.hero_image_url !== photoUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.hero_image_url} alt="" className="aspect-[16/9] w-full object-cover" />
                        {r.hero_image_attribution && (
                          <PhotoCredit
                            text={r.hero_image_attribution}
                            url={r.hero_image_attribution_url}
                            className="absolute bottom-1.5 right-1.5 z-10 max-w-[92%] rounded-[8px] bg-navy/65 px-2 py-0.5 text-[10.5px] leading-tight text-white/90 backdrop-blur-sm"
                            linkClassName="underline decoration-white/50 underline-offset-2 hover:decoration-white"
                          />
                        )}
                      </div>
                    ) : null}
                    <div className="flex flex-1 flex-col px-4 py-3.5">
                      <p className="text-[0.8125rem] font-semibold text-forest">
                        {r.is_tour ? tr('roams.whole') : r.relation === 'connects' ? tr('roams.nearby') : r.miles_on_trail ? tr('roams.mi_on', { mi: miles(r.miles_on_trail) }) : tr('roams.uses')}
                      </p>
                      <h3 className="mt-0.5 text-[1.0625rem] font-semibold leading-snug text-navy">
                        {href ? <Link href={href} className="after:absolute after:inset-0 after:content-['']">{r.name}</Link> : r.name}
                      </h3>
                      {r.hook && <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-ink-soft">{r.hook}</p>}
                      <p className="mt-auto flex items-center gap-3 pt-3 text-[0.8125rem] tabular-nums text-ink-soft">
                        {r.distance_miles ? <span className="inline-flex items-center gap-1"><Ruler size={12} aria-hidden /> {tr('roams.mi', { mi: miles(r.distance_miles) })}</span> : null}
                        {r.estimated_minutes ? <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden /> {duration(r.estimated_minutes, tr)}</span> : null}
                        {href ? (
                          <ArrowRight size={14} className="ml-auto text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                        ) : (
                          <span className="ml-auto font-semibold text-forest">{tr('roams.in_app')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  )
                })}
              </div>
              <div className="mt-5 flex flex-col gap-4 rounded-[14px] border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[52ch] text-[0.9375rem] text-navy">
                  <span className="font-semibold">{tr('roams.get_shift')}</span>{' '}
                  <span className="text-ink-soft">{tr('roams.get_shift_body')}</span>
                </p>
                <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="trail_roams" tone="light" className="shrink-0 [&>a]:max-[420px]:basis-full" />
              </div>
            </div>
          </section>
        )}

        {/* ── Keep going: the network from this trail's ends ── */}
        {keepGoing.length > 0 && (
          <section id="keep-going" aria-labelledby="keep-going-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="keep-going-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">{tr('keep.h2')}</h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                {tr(/s$/.test(t.name) ? 'keep.body_many' : 'keep.body_one', { name: t.name })}
              </p>
              <RoamKeepGoing locale={locale} roamId={t.id} roamName={t.name} subject="trail" quiet places={places} route={null} routeLines={lines} rows={keepGoing} closed={closedLines} />
            </div>
          </section>
        )}

        {/* ── About: what it's like, the rules, who runs it, where the facts come from ── */}
        <section id="about" aria-labelledby="about-h" className="scroll-mt-28 px-6 pb-20 pt-14 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="about-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">{tr('about.h2', { name: t.name })}</h2>
            <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
              <dl className="min-w-0 divide-y divide-navy/[0.07] self-start rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
                {t.surface && <AboutRow label={tr('about.surface')} body={t.surface} />}
                {t.rules_note && <AboutRow label={tr('about.rules')} body={t.rules_note} />}
                {hasWinterRow && (
                  <div id="winter" className="scroll-mt-28 px-5 py-4">
                    <dt className="text-[0.9375rem] font-semibold text-navy">{tr('about.winter')}</dt>
                    {(cond?.reports.length ?? 0) > 0 && (
                      <dd className="m-0 mt-2">
                        <ul className="space-y-1.5">
                          {cond!.reports.slice(0, 4).map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                              <i className="mt-[5px] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CONDITION_COLOR[r.condition] }} aria-hidden />
                              <span><span className="font-semibold">{reportLine(r, locale)}</span> · {timeOf(r.rode_at, now, locale)}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    )}
                    {isWintry(cond?.weather ?? null) && (
                      <dd className="m-0 mt-2 flex items-start gap-2 text-[0.9375rem] leading-snug text-navy">
                        <Snowflake size={14} className="mt-[3px] shrink-0 text-ink-soft" aria-hidden /> {snowLine(cond!.weather!, now, locale)}
                      </dd>
                    )}
                    {winter && (
                      <dd className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
                        {winter.note}{' '}
                        <a href={winter.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-forest underline-offset-4 hover:underline">
                          {winter.as_of ? tr('about.source_as_of', { date: winter.as_of }) : tr('about.source')} <ExternalLink size={11} aria-hidden />
                        </a>
                      </dd>
                    )}
                    <dd className="m-0 mt-2 text-[0.9375rem]">
                      <Link href={withLang('/trails/conditions', locale)} className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                        {tr('about.all_conditions')} <ArrowRight size={14} aria-hidden />
                      </Link>
                    </dd>
                  </div>
                )}
                {amenities.map((a) => <AboutRow key={a.label} label={a.label} body={a.body} />)}
                {t.agency && <AboutRow label={tr('about.agency')} body={t.agency} />}
                {t.aka.length > 0 && <AboutRow label={tr('about.aka')} body={t.aka.join(', ')} />}
              </dl>
              <div className="min-w-0 space-y-8">
                {t.notices.length > 0 && (
                  <div id="notices" className="scroll-mt-28">
                    <h3 className="text-[1.0625rem] font-semibold text-navy">{tr('notices.h3')}</h3>
                    <p className="mt-1 text-[0.9375rem] text-ink-soft">{tr('notices.body')}</p>
                    <div className="mt-3">
                      <NoticeList items={t.notices} t={tr} locale={locale} />
                    </div>
                  </div>
                )}
                {(t.official_url || t.friends_url) && (
                  <div>
                    <h3 className="text-[1.0625rem] font-semibold text-navy">{tr('more.h3')}</h3>
                    <ul className="mt-2 space-y-1.5 text-[0.9375rem]">
                      {t.official_url && (
                        <li>
                          <a href={t.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                            {tr('more.official')} <ExternalLink size={12} aria-hidden />
                          </a>
                          <span className="text-ink-soft"> · {hostOf(t.official_url)}</span>
                        </li>
                      )}
                      {t.friends_url && t.friends_url !== t.official_url && (
                        <li>
                          <a href={t.friends_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                            {tr('more.friends')} <ExternalLink size={12} aria-hidden />
                          </a>
                          <span className="text-ink-soft"> · {hostOf(t.friends_url)}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {t.sources.length > 0 && (
                  <details className="group rounded-[14px] bg-navy/[0.03] px-4 py-3">
                    <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] font-semibold text-navy">
                      {tr('facts.summary')}
                      <span className="text-[0.8125rem] font-medium text-ink-soft">{t.facts_checked_on ? tr('facts.checked', { date: day(t.facts_checked_on, locale) }) : null}</span>
                    </summary>
                    <ul className="mt-2 space-y-1 text-[0.875rem]">
                      {t.sources.map((s) => (
                        <li key={s}>
                          <a href={s} target="_blank" rel="noopener noreferrer" className="break-all text-forest underline-offset-4 hover:underline">{shortUrl(s)}</a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}

function AboutRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-[0.9375rem] font-semibold text-navy">{label}</dt>
      <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</dd>
    </div>
  )
}

