import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RidePage, { type GoingFace } from '@/components/rides/RidePage'
import { rideOrganizer } from '@/lib/rides/organizer'
import { fetchAlbum } from '@/app/events/[id]/photos/photo-api'
import AppOnlyRidePage from '@/components/rides/AppOnlyRidePage'
import type { RideCoffeeInfo } from '@/components/rides/RideCoffee'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, scheduleText, type PublicRide, type RideLookup } from '@/lib/rides/public'
import { hostLabel, rideExtras } from '@/lib/rides/host'
import { bikePerksForPlaces } from '@/lib/server/bike-perks'
import { newInfraForPlaces } from '@/lib/server/new-infra'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * A Shift group ride's public page: the link organizers put in their
 * Instagram bio, Partiful post or group chat. Anyone can say Going / Maybe /
 * Can't go here without the app, and the page always shows the latest from
 * the organizer. Fresh on every request so "is it still on?" is never stale.
 */
export const dynamic = 'force-dynamic'

/** The ride, null when there is no such ride, or 'error' when the lookup
 *  itself failed: a hiccup must not tell someone their ride doesn't exist. */
async function loadRide(code: string, date: string | null = null): Promise<RideLookup | null | 'error'> {
  if (!looksLikeRideCode(code)) return null
  try {
    // With a date (a calendar listing's ?date=), the lookup includes that date
    // even when it's past the first eight (Shift 01564).
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_public', date ? { p_code: code, p_date: date } : { p_code: code })
    if (error) {
      console.error('get_ride_public error:', error)
      return 'error'
    }
    return (data as RideLookup | null) ?? null
  } catch (e) {
    console.error('get_ride_public threw:', e)
    return 'error'
  }
}

type Search = Promise<{ date?: string | string[]; lang?: string | string[]; preview?: string | string[] }>
const dateParam = (v: string | string[] | undefined) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export async function generateMetadata({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }): Promise<Metadata> {
  const { code } = await params
  // A link to one date (from its calendar listing) previews that date's own name and description.
  const sp = await searchParams
  const want = dateParam(sp.date)
  const locale = await siteLocale(sp.lang)
  const t = translator(ridesStrings, locale)
  const ride = await loadRide(code, want)
  if (ride === 'error') return { title: t('meta.group'), robots: { index: false } }
  if (!ride) return { title: t('meta.not_found'), robots: { index: false } }
  if (!ride.web) return { title: ride.name, robots: { index: false } }
  const day = want ? ride.occurrences.find((d) => d.date === want) : undefined
  // The organizer's own description stays as written; the fallback is in the page's language.
  const fallback = ride.meetup_name
    ? t('meta.desc_from', { schedule: scheduleText(ride, locale), place: ride.meetup_name })
    : t('meta.desc', { schedule: scheduleText(ride, locale) })
  const description = (day?.description || ride.description)?.slice(0, 160) || fallback
  const title = day?.title ? `${day.title} · ${ride.name}` : ride.name
  const flyer = day?.flyer_url || ride.flyer_url
  return {
    title,
    description,
    // Invite-only rides are shared by link; only public rides belong in search.
    robots: ride.visibility === 'public' && ride.status === 'active' ? undefined : { index: false, follow: false },
    alternates: { canonical: `/rides/${ride.code}` },
    openGraph: {
      title,
      description,
      url: `/rides/${ride.code}`,
      ...(flyer ? { images: [{ url: flyer }] } : {}),
    },
  }
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }) {
  const { code } = await params
  const sp = await searchParams
  const initialDate = dateParam(sp.date)
  const locale = await siteLocale(sp.lang)
  const ride = await loadRide(code, initialDate)
  if (ride === 'error') return <CouldNotLoad locale={locale} href={withLang(`/rides/${encodeURIComponent(code)}${initialDate ? `?date=${initialDate}` : ''}`, locale)} />
  if (!ride) notFound()

  // Who runs it (logo, channels, their calendar page) and the route's climbing;
  // the Bicycle Benefits members by any of its meeting spots or routes; and
  // what's new on each of its routes (or by each meeting spot).
  // Plus where it ends and who buys the coffee there (Ride Fund, Shift 01596).
  // And the newest date's shared photos (Shift ride photos): null while the
  // switch is off, unless the link carries that date's preview key.
  const preview = typeof sp.preview === 'string' ? sp.preview.slice(0, 64) : ''
  // And who's going on each date: first names and photos of Shift members with public profiles (Shift 01751).
  // And the person who organizes it, when their profile is public (Shift 01752).
  const [extras, perks, newInfra, coffee, album, faces, organizer] = ride.web
    ? await Promise.all([rideExtras(ride.id).catch(() => null), bikePerksForPlaces(ridePlaces(ride)).catch(() => []), newInfraForPlaces(ridePlaces(ride)), rideCoffee(ride.code), fetchAlbum({ ride: ride.code, date: 'latest' }, preview).catch(() => null), goingFaces(ride.code), rideOrganizer(ride.code)])
    : [null, [], [], null, null, {}, null]
  const photos = album && album.album.state !== 'none'
    ? { album, preview, albumRef: { ride: ride.code, date: album.event.date }, href: withLang(`/rides/${encodeURIComponent(ride.code)}/photos/${album.event.date}${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`, locale) }
    : null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {ride.web ? <RidePage ride={{ ...ride, languages: extras?.languages ?? null }} host={extras?.host ?? null} hostPerson={hostLabel(extras)} ascentFt={extras?.ascentFt ?? null} hillShape={extras?.hillShape ?? null} profile={extras?.profile ?? null} organizer={organizer} comfort={extras?.comfortSegments ?? null} initialDate={initialDate} perks={perks} newInfra={newInfra} coffee={coffee} photos={photos} faces={faces} locale={locale} /> : <AppOnlyRidePage ride={ride} locale={locale} />}
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}

/** Who's going, by date id: never worth a failed page either. */
async function goingFaces(code: string): Promise<Record<string, GoingFace[]>> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_going_faces', { p_code: code })
    return error || !data ? {} : (data as Record<string, GoingFace[]>)
  } catch {
    return {}
  }
}

/** A missing coffee line is never worth a failed page. */
async function rideCoffee(code: string): Promise<RideCoffeeInfo | null> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_coffee', { p_code: code })
    return error ? null : ((data as RideCoffeeInfo | null) ?? null)
  } catch {
    return null
  }
}

/** Each meeting spot and route the ride page can show: the ride's own and each date's. */
function ridePlaces(ride: PublicRide) {
  const pt = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null)
  const line = (w: { lat: number; lng: number }[] | null | undefined) => (w ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  return [
    { line: line(ride.route_waypoints), start: pt(ride.meetup_lat, ride.meetup_lng) },
    ...ride.occurrences.map((d) => ({
      line: line(d.own_route && d.route ? d.route.route_waypoints : ride.route_waypoints),
      start: pt(d.meetup_lat, d.meetup_lng),
    })),
  ]
}

/** The lookup failed (not "no such ride"): say so and offer the same page again. */
function CouldNotLoad({ href, locale }: { href: string; locale: SiteLocale }) {
  const t = translator(ridesStrings, locale)
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <div className="mx-auto max-w-[560px] px-4 py-16 sm:px-8">
          <h1 className="font-display text-[30px] font-extrabold leading-tight text-[#191A2E]">{t('load.title')}</h1>
          <p className="mt-2 text-[16px] text-[#191A2E]/80">{t('load.body')}</p>
          {/* A full reload, so the lookup runs again. */}
          <a href={href} className="mt-6 inline-flex min-h-[46px] items-center rounded-[10px] bg-[#191A2E] px-5 text-[15px] font-bold text-white hover:opacity-90">
            {t('load.retry')}
          </a>
        </div>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
