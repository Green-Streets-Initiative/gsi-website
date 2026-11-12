import Link from 'next/link'
import { Bike, Calendar, MapPin } from 'lucide-react'
import StaticMapSvg from '@/components/nearby/StaticMapSvg'
import { EVENT_TYPE_ICONS } from '@/components/events/event-type-icons'
import { RASTER_TILE_ATTRIBUTION } from '@/lib/nearby/static-map'
import { eventRideStyle, getTypeMeta, isNoDrop } from '@/lib/events'
import { eventsT, rideLengthL, rideLevelLabel, tagLabel, typeLabel } from '@/lib/events-i18n'
import { townFromAddress } from '@/lib/events-seo'
import { SITE_LOCALE_TAG, type SiteLocale } from '@/lib/site-i18n'

/*
 * The easy group rides on /bike-lessons as cards, after the Shift app's event
 * ribbon (EventStripCard, Keith 2026-11-12): a picture band on top (the
 * organizer's flyer, else a small map of the meeting spot, else a poster in
 * the ride's color), a dark date badge over it, then who runs it, the name,
 * the level chips and the place. A swipeable row on phones, a grid on desktop.
 */

export type RideCard = {
  id: string
  href: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  organizer_name: string | null
  event_type: string
  image_url: string | null
  tags: string[]
  pace: string | null
  distance_text: string | null
  no_drop: boolean | null
  body: string | null
}

const BAND = 'relative h-[148px] overflow-hidden'

function dateParts(r: RideCard, locale: SiteLocale): { top: string; day: string; time: string | null } {
  const [y, m, d] = r.event_date.split('-').map(Number)
  const [hh, mm] = (r.event_time ?? '').split(':').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0))
  const tag = SITE_LOCALE_TAG[locale]
  const top = at.toLocaleString(tag, { weekday: 'short', timeZone: 'UTC' })
  const day = at.toLocaleString(tag, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const time = r.event_time
    ? at.toLocaleString(tag, { hour: 'numeric', ...(mm ? { minute: '2-digit' } : {}), timeZone: 'UTC' })
    : null
  return { top, day, time }
}

/** "Sheldon Field · Northampton", "BU Cycle Kitchen": the spot, then its town when it adds something. */
function placeLine(r: RideCard): string | null {
  const name = r.location_name?.split(',')[0]?.trim() || null
  const town = townFromAddress(r.location_address) ?? townFromAddress(r.location_name)
  if (name && town && !name.toLowerCase().includes(town.toLowerCase())) return `${name} · ${town}`
  return name ?? town
}

function Band({ r, typeColor }: { r: RideCard; typeColor: string }) {
  if (r.image_url) {
    return (
      <div className={BAND}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    )
  }
  const lat = Number(r.location_lat)
  const lng = Number(r.location_lng)
  if (r.location_lat != null && r.location_lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return (
      <div className={BAND}>
        <StaticMapSvg
          center={{ lat, lng }}
          maxHalf={{ lat: 0.004, lng: 0.006 }}
          width={420}
          height={170}
          title={r.location_name ?? r.title}
          lines={[]}
          markers={[{ lat, lng, kind: 'home' }]}
          className="block h-full w-full"
        />
        {/* Map credit: legal fine print, the one place under the type floor. */}
        <span className="absolute right-1.5 bottom-1 rounded bg-white/85 px-1 text-[10px] leading-tight text-navy/80">
          {RASTER_TILE_ATTRIBUTION}
        </span>
      </div>
    )
  }
  return (
    <div className={`${BAND} flex items-center justify-end pr-6`} style={{ background: '#2D6A4F' }}>
      <Bike size={92} strokeWidth={1.5} style={{ color: typeColor }} aria-hidden />
    </div>
  )
}

export default function RideCards({ rides, locale }: { rides: RideCard[]; locale: SiteLocale }) {
  const et = eventsT(locale)
  return (
    <ul className="-mx-6 mt-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-3 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
      {rides.map((r) => {
        const meta = getTypeMeta(r.event_type)
        const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
        const { top, day, time } = dateParts(r, locale)
        const level = eventRideStyle({ ...r, body: r.body ?? '', tags: r.tags ?? [] })
        const length = rideLengthL(r.distance_text, locale)
        const chips = [
          level ? rideLevelLabel(level, locale) : null,
          length,
          isNoDrop({ ...r, body: r.body ?? '' }) ? et('card.no_drop') : null,
          (r.tags ?? []).includes('free') ? tagLabel('free', locale) : null,
        ].filter((c): c is string => !!c)
        const place = placeLine(r)
        const organizer = r.organizer_name?.trim() || null
        return (
          <li key={r.id} className="w-[84%] max-w-[340px] shrink-0 snap-start md:w-auto md:max-w-none">
            <Link
              href={r.href}
              className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-navy/12 bg-white transition-colors hover:border-forest"
            >
              <div className="relative">
                <Band r={r} typeColor={meta.color} />
                <div className="absolute top-3 left-3 rounded-[12px] px-3 py-2 leading-none shadow-[0_2px_8px_rgba(15,16,30,0.25)]" style={{ background: 'rgba(25,26,46,0.96)' }}>
                  <span className="block text-[13px] font-bold tracking-[0.06em] text-gold uppercase">{top}</span>
                  <span className="mt-1 block text-[19px] font-extrabold text-white">{day}</span>
                  {time && <span className="mt-1 block text-[14px] font-medium text-white/85">{time}</span>}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
                <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium text-navy/80">
                  <Icon size={16} style={{ color: meta.ink }} aria-hidden />
                  <span className="truncate">{[typeLabel(r.event_type, locale), organizer].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[1.1875rem] font-extrabold leading-[1.2] text-navy group-hover:text-forest">
                  {r.title}
                </span>
                {chips.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span key={c} className="rounded-full bg-forest/10 px-2.5 py-1 text-[14px] font-bold leading-tight text-forest">{c}</span>
                    ))}
                  </span>
                )}
                {place && (
                  <span className="mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-[15px] leading-snug text-navy">
                    <MapPin size={16} className="shrink-0 text-forest" aria-hidden />
                    <span className="truncate">{place}</span>
                  </span>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
