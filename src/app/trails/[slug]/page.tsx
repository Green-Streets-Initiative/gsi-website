import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Ruler, Route, MapPin, Flag, Navigation, Bike, TrainFront, ParkingCircle, ExternalLink, ArrowRight, CircleCheck, Info, Clock } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import PhotoCredit from '@/components/PhotoCredit'
import TrailMap from '@/components/trails/TrailMap'
import RoamDisruptions from '@/components/roams/RoamDisruptions'
import RoamSectionNav from '@/components/roams/RoamSectionNav'
import RoamKeepGoing from '@/components/roams/RoamKeepGoing'
import { getTrail, isLoopLike, type TrailNotice } from '@/lib/trails/queries'
import { getTrailLines } from '@/lib/trails/geometry'
import { MAP_PLACES } from '@/lib/trails/places'
import { getBluebikesDocks } from '@/lib/server/bluebikes'
import { withUtm } from '@/lib/utm'

export const revalidate = 3600

const SITE_URL = 'https://www.gogreenstreets.org'
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''

/** 2 -> "2", 6.39 -> "6.4" */
function miles(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** "Oct 19, 2026" from a YYYY-MM-DD date. */
function day(d: string): string {
  return new Date(`${d}T12:00:00-04:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
}

/** Research text as one clean sentence: dates as "Dec 31, 2026", one closing period. */
function sentence(s: string): string {
  const t = s.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => day(d)).trim().replace(/\.+$/, '')
  return `${t}.`
}

/** 110 -> "1 hr 50 min", 42 -> "42 min" */
function duration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = Math.round((m % 60) / 5) * 5
  return rest ? `${h} hr ${rest} min` : `${h} hr`
}

/** "Alewife Station, Cambridge" -> "Alewife Station" */
function place(name: string): string {
  return name.split(' (')[0].split(', ')[0].trim()
}

/** The surface as one or two words for the summary tile; the full sentence is in About. */
function surfaceTile(s: string | null): { value: string; sub: string | null } | null {
  if (!s) return null
  const t = s.trim()
  if (/^mixed/i.test(t)) return { value: 'Mixed', sub: 'paved and unpaved' }
  if (/^mostly paved/i.test(t)) return { value: 'Mostly paved', sub: null }
  if (/^paved/i.test(t)) {
    if (/\bexcept\b/i.test(t)) return { value: 'Mostly paved', sub: null }
    return { value: 'Paved', sub: /whole (way|length|loop)/i.test(t) ? 'the whole way' : null }
  }
  if (/stone|dirt|sand|clay|gravel|crushed/i.test(t)) return { value: 'Unpaved', sub: /stone dust|crushed stone/i.test(t) ? 'stone dust' : null }
  return null
}

function townsLine(towns: string[]): string {
  if (towns.length <= 3) return towns.join(', ')
  return `${towns.slice(0, 3).join(', ')} and ${towns.length - 3} more`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getTrail(decodeURIComponent(slug))
  if (!data) return { title: 'Trail not found' }
  const t = data.trail
  const pts = t.access_points
  const span = pts.length > 1 && !isLoopLike(pts) ? ` from ${place(pts[0].name)} to ${place(pts[pts.length - 1].name)}` : t.towns.length > 0 ? ` in ${t.towns.join(', ')}` : ''
  const len = t.full_miles ? miles(t.full_miles) : null
  const title = `${t.name}: ${len ? `${len} ${len === '1' ? 'mile' : 'miles'}${span}` : t.kind ?? 'trail'}, where to get on and how to get there`
  const description = t.summary ?? `${t.name}: length, surface, access points, parking and transit.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/trails/${t.id}` },
    // Staged until the roam page title test ends (2026-10-26); then these go
    // into the sitemap and the trail-tour roam pages forward here.
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}/trails/${t.id}`, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

function NoticeList({ items }: { items: TrailNotice[] }) {
  return (
    <ul className="space-y-3">
      {items.map((n, i) => (
        <li key={i} className="rounded-[14px] border border-[#8A6D1F]/20 bg-[#FFFAEB] px-4 py-3">
          <p className="text-[0.9375rem] font-semibold leading-snug text-navy">{n.what}</p>
          {n.where && <p className="mt-0.5 text-[0.875rem] text-ink-soft">{n.where}</p>}
          {(n.end || n.detour) && (
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-soft">
              {n.end ? <>{/^\d{4}-\d{2}-\d{2}$/.test(n.end) ? `Until ${day(n.end)}.` : sentence(n.end)} </> : null}
              {n.detour ? <>{sentence(n.detour)}</> : null}
            </p>
          )}
          {n.source_url && (
            <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-forest underline underline-offset-4">
              Source <ExternalLink size={11} aria-hidden />
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

export default async function TrailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getTrail(decodeURIComponent(slug))
  if (!data) notFound()
  const { trail: t, disruptions, roams, keepGoing } = data

  const pts = t.access_points
  const first = pts[0] ?? null
  const last = pts.length > 1 ? pts[pts.length - 1] : null
  const [geo, docksFirst, docksLast] = await Promise.all([
    getTrailLines(t.id),
    first ? getBluebikesDocks(first.lat, first.lng, 600).catch(() => []) : Promise.resolve([]),
    last ? getBluebikesDocks(last.lat, last.lng, 600).catch(() => []) : Promise.resolve([]),
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
  const connectRoams = roams.filter((r) => r.relation === 'connects')
  const utm = { source: 'web_trail', medium: 'trail_page', campaign: t.id }
  const iosUrl = withUtm(IOS_URL, utm) ?? IOS_URL
  const androidUrl = withUtm(ANDROID_URL, utm) ?? ANDROID_URL

  const surface = surfaceTile(t.surface)
  const tiles = [
    t.full_miles ? { icon: Ruler, label: 'Length', value: `${miles(t.full_miles)} mi`, sub: t.kind } : null,
    surface ? { icon: Route, label: 'Surface', value: surface.value, sub: surface.sub } : null,
    pts.length > 0 ? { icon: MapPin, label: 'Get on at', value: `${pts.length} ${pts.length === 1 ? 'place' : 'places'}`, sub: 'on the map' } : null,
  ].filter((x): x is { icon: typeof Ruler; label: string; value: string; sub: string | null } => !!x)
  const loop = isLoopLike(pts)
  const spanLine = first && last && !loop
    ? `From ${place(first.name)} to ${place(last.name)}`
    : loop && t.towns.length > 0
      ? t.towns.length === 1 ? `A loop in ${t.towns[0]}` : `Loops through ${townsLine(t.towns)}`
      : null

  const walkMin = (m: number) => Math.max(1, Math.round(m / 80))
  const dockGroups = [
    first ? { label: place(first.name), docks: docksFirst.slice(0, 2) } : null,
    last ? { label: place(last.name), docks: docksLast.slice(0, 2) } : null,
  ].filter((g): g is { label: string; docks: typeof docksFirst } => !!g && g.docks.length > 0)

  const amen = t.amenities ?? {}
  const amenities = [
    amen.restrooms ? { label: 'Restrooms', body: amen.restrooms } : null,
    amen.water ? { label: 'Water', body: amen.water } : null,
    amen.food ? { label: 'Food', body: amen.food } : null,
  ].filter((x): x is { label: string; body: string } => !!x)

  const hasGetThere = !!(t.transit_note || t.bike_share_note || t.parking_note || dockGroups.length > 0)
  const sections = [
    { id: 'map', label: 'Map' },
    hasGetThere ? { id: 'get-there', label: 'Get there' } : null,
    roams.length > 0 ? { id: 'roams', label: 'Roams' } : null,
    keepGoing.length > 0 ? { id: 'keep-going', label: 'Keep going', phoneHidden: roams.length > 0 } : null,
    { id: 'about', label: 'About' },
  ].filter((x): x is { id: string; label: string; phoneHidden?: boolean } => !!x)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trails', item: `${SITE_URL}/trails` },
      { '@type': 'ListItem', position: 2, name: t.name, item: `${SITE_URL}/trails/${t.id}` },
    ],
  }

  const statusRow =
    disruptions.length > 0 ? null : t.notices.length > 0 ? (
      <a href="#notices" className="group flex min-h-[48px] items-center gap-3 rounded-[14px] bg-[#FFFAEB] px-4 py-2.5 text-[0.9375rem] text-navy ring-1 ring-[#8A6D1F]/20 transition-colors hover:bg-[#FFF4D6]">
        <Info size={17} className="shrink-0 text-[#8A6D1F]" aria-hidden />
        <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
          <span className="font-semibold">{t.notices.length === 1 ? 'Notice' : `${t.notices.length} notices`}:</span>{' '}
          <span className="text-ink-soft">
            {t.notices[0].what}
            {t.notices[0].where ? `, ${t.notices[0].where.charAt(0).toLowerCase()}${t.notices[0].where.slice(1)}` : ''}
            {t.notices[0].end && /^\d{4}-\d{2}-\d{2}$/.test(t.notices[0].end) ? `, until ${day(t.notices[0].end)}` : ''}
          </span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-[#8A6D1F] transition-transform group-hover:translate-x-0.5" aria-hidden />
      </a>
    ) : t.closures_checked_on ? (
      <p className="flex items-center gap-2 text-[0.9375rem] text-navy">
        <CircleCheck size={16} className="shrink-0 text-forest" aria-hidden />
        <span>
          <span className="font-semibold">Open.</span> <span className="text-ink-soft">No closures as of {day(t.closures_checked_on)}.</span>
        </span>
      </p>
    ) : null

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
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
                <Link href="/trails" className="font-semibold text-forest underline-offset-4 hover:underline">Trails</Link>
                {t.towns.length > 0 ? <span> · {townsLine(t.towns)}</span> : null}
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

              <div className="mt-4 space-y-2.5">
                <RoamDisruptions items={disruptions} subject="trail" />
                {statusRow}
              </div>

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                {tour ? (
                  <Link
                    href={`/shift/roams/${tour.id}`}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-navy px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-navy/90"
                  >
                    {tour.mode === 'walk' ? 'Walk' : 'Ride'} it as a roam <ArrowRight size={16} aria-hidden />
                  </Link>
                ) : null}
                {first && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${first.lat},${first.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-colors ${tour ? 'bg-white text-navy ring-1 ring-navy/15 hover:bg-navy/[0.04]' : 'bg-navy text-white hover:bg-navy/90'}`}
                  >
                    <Navigation size={16} aria-hidden /> {place(first.name).length <= 24 ? `Directions to ${place(first.name)}` : 'Directions to the trail'}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <RoamSectionNav sections={sections} />

        {/* ── Map and the places to get on ── */}
        <section id="map" aria-labelledby="map-h" className="scroll-mt-28 px-6 pt-8 lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="map-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">Where to get on</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="lg:sticky lg:top-[124px]">
                <div className="h-[320px] overflow-hidden rounded-[18px] border border-navy/10 sm:h-[400px] lg:h-[min(560px,calc(100vh-240px))]">
                  <TrailMap name={t.name} lines={lines} points={pts.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }))} closed={closedLines} places={places} />
                </div>
                <p className="mt-2 text-[0.8125rem] text-ink-soft">
                  Numbers match the list{closedLines.length > 0 ? '. The orange dashes are closed.' : '.'}
                </p>
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
                              <dt className="shrink-0"><TrainFront size={14} className="mt-[2px] text-forest" aria-label="Transit" /></dt>
                              <dd className="m-0 text-ink-soft">{p.transit}</dd>
                            </div>
                          )}
                          {p.parking && (
                            <div className="flex gap-2">
                              <dt className="shrink-0"><ParkingCircle size={14} className="mt-[2px] text-forest" aria-label="Parking" /></dt>
                              <dd className="m-0 text-ink-soft">{p.parking}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-[0.875rem] font-semibold text-forest underline-offset-4 hover:underline"
                      >
                        <Navigation size={13} aria-hidden /> Directions
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
              <h2 id="get-there-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">Getting there</h2>
              <dl className="mt-5 grid gap-px overflow-hidden rounded-[16px] bg-navy/[0.07] shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] lg:grid-cols-3">
                {t.transit_note && (
                  <div className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><TrainFront size={15} className="text-forest" aria-hidden /> By transit</dt>
                    <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{t.transit_note}</dd>
                  </div>
                )}
                {(t.bike_share_note || dockGroups.length > 0) && (
                  <div className="bg-white px-5 py-4">
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><Bike size={15} className="text-forest" aria-hidden /> Bike share</dt>
                    {/* The live docks at each end say it better; the note is for trails with none nearby. */}
                    {t.bike_share_note && dockGroups.length === 0 && <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{t.bike_share_note}</dd>}
                    {dockGroups.length > 0 && (
                      <dd className="m-0 mt-3 space-y-3">
                        {dockGroups.map((g) => (
                          <div key={g.label}>
                            <p className="text-[0.8125rem] font-semibold text-navy">Near {g.label}, right now</p>
                            <ul className="mt-1 space-y-1.5">
                              {g.docks.map((d) => (
                                <li key={d.station_id} className="text-[0.875rem] leading-snug">
                                  <span className="text-navy">{d.name}</span>
                                  <span className="block tabular-nums text-ink-soft">
                                    {walkMin(d.distance_meters)} min walk · {d.num_bikes_available === 0 ? 'no bikes right now' : `${d.num_bikes_available} ${d.num_bikes_available === 1 ? 'bike' : 'bikes'}`}
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
                    <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-navy"><ParkingCircle size={15} className="text-forest" aria-hidden /> Parking</dt>
                    <dd className="m-0 mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{t.parking_note}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        )}

        {/* ── Roams on this trail ── */}
        {roams.length > 0 && (
          <section id="roams" aria-labelledby="roams-h" className="scroll-mt-28 px-6 pt-12 lg:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 id="roams-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">
                {roams.length === 1 ? 'A roam on this trail' : 'Roams on this trail'}
              </h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                A roam is a self-guided route with stops along the way. The free Shift app checks you in at each stop, and you unlock a badge at the end.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...(tour ? [tour] : []), ...otherRoams, ...connectRoams].map((r) => (
                  <div
                    key={r.id}
                    className="group relative flex flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(25,26,46,0.08),0_0_0_1px_rgba(25,26,46,0.08)]"
                  >
                    {r.hero_image_url ? (
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
                        {r.is_tour ? 'The whole trail' : r.relation === 'connects' ? 'Starts nearby' : r.miles_on_trail ? `${miles(r.miles_on_trail)} mi on this trail` : 'Uses this trail'}
                      </p>
                      <h3 className="mt-0.5 text-[1.0625rem] font-semibold leading-snug text-navy">
                        <Link href={`/shift/roams/${r.id}`} className="after:absolute after:inset-0 after:content-['']">{r.name}</Link>
                      </h3>
                      {r.hook && <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-ink-soft">{r.hook}</p>}
                      <p className="mt-auto flex items-center gap-3 pt-3 text-[0.8125rem] tabular-nums text-ink-soft">
                        {r.distance_miles ? <span className="inline-flex items-center gap-1"><Ruler size={12} aria-hidden /> {miles(r.distance_miles)} mi</span> : null}
                        {r.estimated_minutes ? <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden /> {duration(r.estimated_minutes)}</span> : null}
                        <ArrowRight size={14} className="ml-auto text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-4 rounded-[14px] border border-navy/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-[52ch] text-[0.9375rem] text-navy">
                  <span className="font-semibold">Get Shift, free.</span>{' '}
                  <span className="text-ink-soft">Follow a roam with turn-by-turn directions to each stop, and see closures on your trails before you go.</span>
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
              <h2 id="keep-going-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">Keep going</h2>
              <p className="mt-2 max-w-[62ch] text-[1rem] leading-relaxed text-ink-soft">
                The {t.name} joins other paths and protected bike lanes. Pick a direction to see it on the map.
              </p>
              <RoamKeepGoing roamId={t.id} roamName={t.name} subject="trail" quiet places={places} route={null} routeLines={lines} rows={keepGoing} closed={closedLines} />
            </div>
          </section>
        )}

        {/* ── About: what it's like, the rules, who runs it, where the facts come from ── */}
        <section id="about" aria-labelledby="about-h" className="scroll-mt-28 px-6 pb-20 pt-14 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 id="about-h" className="font-serif text-[clamp(1.75rem,3.2vw,2.25rem)] font-normal leading-[1.1] text-navy">About the {t.name}</h2>
            <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
              <dl className="min-w-0 divide-y divide-navy/[0.07] self-start rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
                {t.surface && <AboutRow label="Surface" body={t.surface} />}
                {t.rules_note && <AboutRow label="Rules" body={t.rules_note} />}
                {amenities.map((a) => <AboutRow key={a.label} label={a.label} body={a.body} />)}
                {t.agency && <AboutRow label="Who looks after it" body={t.agency} />}
                {t.aka.length > 0 && <AboutRow label="Also called" body={t.aka.join(', ')} />}
              </dl>
              <div className="min-w-0 space-y-8">
                {t.notices.length > 0 && (
                  <div id="notices" className="scroll-mt-28">
                    <h3 className="text-[1.0625rem] font-semibold text-navy">Notices</h3>
                    <p className="mt-1 text-[0.9375rem] text-ink-soft">Work and changes along the trail, with the way around where there is one.</p>
                    <div className="mt-3">
                      <NoticeList items={t.notices} />
                    </div>
                  </div>
                )}
                {(t.official_url || t.friends_url) && (
                  <div>
                    <h3 className="text-[1.0625rem] font-semibold text-navy">More about the trail</h3>
                    <ul className="mt-2 space-y-1.5 text-[0.9375rem]">
                      {t.official_url && (
                        <li>
                          <a href={t.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                            Official page <ExternalLink size={12} aria-hidden />
                          </a>
                          <span className="text-ink-soft"> · {hostOf(t.official_url)}</span>
                        </li>
                      )}
                      {t.friends_url && t.friends_url !== t.official_url && (
                        <li>
                          <a href={t.friends_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
                            Friends of the trail <ExternalLink size={12} aria-hidden />
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
                      Where these facts come from
                      <span className="text-[0.8125rem] font-medium text-ink-soft">{t.facts_checked_on ? `Checked ${day(t.facts_checked_on)}` : null}</span>
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
      <Footer variant="light" />
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

