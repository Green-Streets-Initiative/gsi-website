'use client'

import { useState } from 'react'
import Link from 'next/link'
import { eventPath } from '@/lib/events-url'
import { Calendar, Bookmark, Route, Users } from 'lucide-react'
import { type CommunityEvent, getTypeMeta, getTagMeta, haversine, isDeadline, eventDayKeys, isMultiDay, eventRideStyle, isNoDrop } from '@/lib/events'
import { withLang } from '@/lib/site-i18n'
import { typeLabel, tagLabel, rideLevelLabel, rideLengthL, distanceL, timeL, dateRangeShortL, ledInLineL } from '@/lib/events-i18n'
import { typeInk, tagInk, rideStyleInk, TINT } from '@/lib/events-tone'
import { townFromAddress } from '@/lib/events-seo'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import CardThumb from './CardThumb'
import { cardTransit, stopTags, type CardTransit } from '@/lib/event-transit'
import { RIDE_STYLE_ORDER, type RideStyle } from '@/lib/ride-style'
import { useEventsTone, useEventsI18n } from './EventsTone'
import { eventLanguages, ownNames } from '@/lib/languages'

interface EventCardProps {
  event: CommunityEvent
  userLat: number
  userLng: number
  /** The person picked a place (Near), so "2.3 mi away" is from them and not the default point. */
  showAway?: boolean
  showDate?: boolean
  saved?: boolean
  onToggleSave?: (id: string) => void
  onOpen?: () => void
  /** A feeder ride's destination, when it is a card of its own: "Rides to Critical Mass" (Shift 01460). */
  ridesTo?: string | null
  /** A Go together tray sits flush underneath (FeederTray). */
  attached?: boolean
}

/** Easy, Moderate, Rec as a three-step meter: how hard, at a glance. */
function LevelMeter({ level, color }: { level: RideStyle; color: string }) {
  const k = RIDE_STYLE_ORDER.indexOf(level)
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px]" aria-hidden>
      {RIDE_STYLE_ORDER.map((l, i) => (
        <span key={l} className="block w-[4px] rounded-[1px]" style={{ height: 6 + i * 4, backgroundColor: color, opacity: i <= k ? 1 : 0.22 }} />
      ))}
    </span>
  )
}

/** "[GL D] 5 min walk to Union Square": the line's own tags, then the walk, then the stop (two lines at most). */
function TransitLine({ tr, label, className }: { tr: CardTransit; label: string; className?: string }) {
  return (
    <p className={`line-clamp-2 text-[14px] leading-[24px] text-(--ev-ink-85) ${className ?? ''}`}>
      {stopTags(tr.stop).map((tag) => (
        <span key={tag.text}
          className={`mr-1 inline-flex h-[22px] min-w-[22px] items-center justify-center whitespace-nowrap px-1.5 align-[1px] font-(family-name:--font-headline) text-[13px] font-extrabold leading-none ${tag.bg === '#FFC72C' ? 'rounded-[4px]' : 'rounded-full'}`}
          style={{ backgroundColor: tag.bg, color: tag.fg }}>
          {tag.text}
        </span>
      ))}
      {label}
    </p>
  )
}

/**
 * One event. Phones get the stacked card; from lg up the same markup becomes
 * a denser row with a fixed time column on the left (CSS only, so there is no
 * layout flash when the desktop media query resolves after hydration).
 */
export default function EventCard({ event, userLat, userLng, showAway, showDate, saved, onToggleSave, onOpen, ridesTo, attached }: EventCardProps) {
  const { tone, hrefBase } = useEventsTone()
  // A flyer link that no longer loads falls back to the logo or map, never an empty square.
  const [flyerOk, setFlyerOk] = useState(true)
  // It may have failed before the page hydrated, when onError wasn't listening yet.
  const flyerRef = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFlyerOk(false)
  }
  const { locale, t } = useEventsI18n()
  const meta = getTypeMeta(event.event_type)
  const metaLabel = typeLabel(event.event_type, locale)
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
  // The type's color for this surface: the navy-tuned one, or its ink on cream.
  const ink = typeInk(meta, tone)
  const tint = TINT[tone]
  // Easy / Moderate / Rec, only when the listing supports the call.
  const level = eventRideStyle(event)
  const noDrop = isNoDrop(event)
  const langs = eventLanguages(event.languages).filter((c) => c !== 'en')
  // Pace, distance, and drop policy are the three things a rider needs (Keith).
  // The level carries the pace; the length rides beside it when the listing states one.
  // Two distances sit on a ride's card, so each says what it is (Keith 2026-11-03):
  // the ride's length ("24 mi ride") next to its level, and how far it is from
  // you ("2.3 mi away") at the end of the place line, where it never gets cut off.
  const rideLength = level ? rideLengthL(event.distance_text, locale) : null
  const isRide = !!level || event.event_type === 'group_ride' || event.event_type === 'guided_ride'
  // Under the place: a ride's length, level and no-drop; for everything
  // else the nearest T stop (Keith 2026-11-18: most riders bring a bike).
  const privateHome = /^a home in /i.test(event.location_name ?? '')
  const placeless = !event.location_address && Number(event.target_radius_miles) >= 100
  const transit = !isRide && !privateHome && !placeless ? cardTransit(event.nearest_transit) : null
  const hasFacts = isRide && (!!rideLength || !!level || noDrop)

  const away = showAway && event.location_lat && event.location_lng
    ? t('card.away', { distance: distanceL(haversine(userLat, userLng, event.location_lat, event.location_lng), locale) })
    : null

  const timeStr = event.event_time ? timeL(event.event_time, locale) : null
  const endStr = event.event_end_time ? timeL(event.event_end_time, locale) : null
  // "Nov 1 to 30" for a multi-day event (Shift 01557), "Nov 1" otherwise.
  const datePart = showDate ? dateRangeShortL(event, locale) : null
  // The desktop time column says how long a multi-day, all-day event runs.
  const spanLabel = isMultiDay(event) ? t('card.days', { count: eventDayKeys(event).length }) : t('card.all_day')
  const deadline = isDeadline(event.event_type)
  // A Shift ride's cancelled date stays on the list, struck through, so
  // someone planning on it sees it's off instead of it quietly vanishing.
  const off = event.schedule_status === 'cancelled'

  // Who runs it sits on the card itself: people come to trust specific groups,
  // and they shouldn't have to click through to find out (Keith, 2026-09-14).
  const organizer = event.organizer_name?.trim() || null

  // Phone: date · time · organizer, then the place line
  let when = datePart && timeStr ? `${datePart} · ${timeStr}` : datePart ?? timeStr ?? ''
  if (deadline && when) when = t('card.entry_deadline', { when })

  const place = event.location_name && event.location_name !== 'See event page for details' ? event.location_name : null
  // Until someone picks a place there is no "away", so the place line leads
  // with the town: "16 Park Street" alone doesn't say it's in Topsfield.
  const town = away ? null : townFromAddress(event.location_address)
  const placeLead = away ?? (town && !place?.includes(town) ? town : null)

  // Desktop: the time lives in its own column and the distance in its own, so date · organizer · place
  const whenLg = datePart ? (deadline ? t('card.entry_deadline', { when: datePart }) : datePart) : ''

  /** "lead · organizer · tail", with the organizer set brighter than the rest. */
  const metaLine = (lead: string, tail: string | null) => (
    <>
      {lead}
      {organizer && (
        <>
          {lead && ' · '}
          <span className="font-medium text-(--ev-ink-85)">{organizer}</span>
        </>
      )}
      {tail && `${lead || organizer ? ' · ' : ''}${tail}`}
    </>
  )

  const facts = hasFacts ? (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-semibold text-(--ev-ink-85)">
      {rideLength && <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Route size={16} className="text-(--ev-accent)" aria-hidden />{rideLength}</span>}
      {level && (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: rideStyleInk(level, tone) }}>
          <LevelMeter level={level} color={rideStyleInk(level, tone)} />{rideLevelLabel(level, locale)}
        </span>
      )}
      {noDrop && <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Users size={16} className="text-(--ev-accent)" aria-hidden />{t('card.no_drop')}</span>}
    </span>
  ) : null
  const walkTo = transit ? t('card.walk_to', { min: transit.walk, stop: transit.stop.name }) : ''
  const typeTile = (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] lg:h-12 lg:w-12 lg:rounded-[10px]"
      style={{ backgroundColor: ink + tint.tile }}
    >
      <Icon size={26} className="lg:hidden" style={{ color: ink }} />
      <Icon size={20} className="hidden lg:block" style={{ color: ink }} />
    </div>
  )

  const saveBtn = (cls: string) => onToggleSave && (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.id) }}
      className={`relative z-20 shrink-0 items-center justify-center rounded-full border border-(--ev-line-mid) transition-colors hover:border-(--ev-line-stronger) ${cls}`}
      aria-label={saved ? t('card.unsave') : t('card.save')}
    >
      <Bookmark size={18} className={saved ? 'fill-(--ev-accent) text-(--ev-accent)' : 'text-(--ev-ink-75)'} />
    </button>
  )

  return (
    <div className={`group relative flex min-h-[72px] items-start gap-3 border border-(--ev-line) bg-(--ev-card) p-3.5 transition-all duration-200 hover:border-(--ev-line-mid) hover:bg-(--ev-card-hover) sm:gap-4 sm:p-4 lg:min-h-0 lg:items-center lg:px-4 lg:py-3 ${attached ? 'rounded-t-[14px]' : 'rounded-[14px]'}`}>
      <Link href={withLang(eventPath(event, hrefBase), locale)} onClick={onOpen} className={`absolute inset-0 z-10 ${attached ? 'rounded-t-[14px]' : 'rounded-[14px]'}`} aria-label={event.title} />

      {/* Desktop time column */}
      <div className="hidden w-[76px] shrink-0 flex-col lg:flex">
        <span className={`text-[14px] font-semibold leading-tight ${off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)'}`}>
          {deadline ? t('card.deadline') : timeStr ?? spanLabel}
        </span>
        {!deadline && timeStr && endStr && (
          <span className="mt-0.5 text-[13px] leading-tight text-(--ev-ink-75)">{t('card.to_time', { time: endStr })}</span>
        )}
      </div>

      {/* Phones: the save button sits under the square, so the title gets the width. */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        {/* The flyer when there is one; else the host's square logo, a map of the start, or the type tile */}
        {event.image_url && flyerOk ? (
          <div
            className="h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border lg:h-12 lg:w-12 lg:rounded-[10px]"
            style={{ borderColor: ink + tint.spotLine, backgroundColor: ink + tint.thumb }}
          >
            <img ref={flyerRef} src={event.image_url} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setFlyerOk(false)} />
          </div>
        ) : (
          <CardThumb
            lat={deadline || privateHome || placeless ? null : event.location_lat}
            lng={deadline || privateHome || placeless ? null : event.location_lng}
            logo={event.organizer_logo ?? null}
            fallback={typeTile}
          />
        )}
        {saveBtn('flex h-11 w-11 lg:hidden')}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug lg:hidden" style={{ color: ink }}>
          {metaLabel}
        </p>
        <h3 className={`mt-0.5 line-clamp-3 font-(family-name:--font-headline) text-[17px] font-extrabold leading-snug tracking-[-0.01em] sm:text-[18px] lg:mt-0 lg:line-clamp-1 lg:text-[17px] ${off ? 'text-(--ev-ink-75)' : 'text-(--ev-ink)'}`}>
          {off && <span className="mr-2 inline-block rounded-full bg-[#FBE4DF] px-2 py-0.5 align-middle font-(family-name:--font-gsi) text-[13px] font-bold leading-tight text-(--ev-danger)">{t('card.cancelled')}</span>}
          <span className={off ? 'line-through' : undefined}>{event.title}</span>
        </h3>
        <p className={`mt-1 text-[14px] leading-snug text-(--ev-ink-75) lg:hidden ${off ? 'line-through' : ''}`}>
          {metaLine(when, null)}
        </p>
        {(place || placeLead) && (
          // How far away leads, so it is never the part that gets cut off; the place may take two lines.
          <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-(--ev-ink-75) lg:hidden">
            {placeLead && <span className="font-semibold text-(--ev-ink-85)">{placeLead}</span>}
            {placeLead && place && ' · '}
            {place}
          </p>
        )}
        {facts && <div className="mt-1.5 lg:hidden">{facts}</div>}
        {transit && <TransitLine tr={transit} label={walkTo} className="mt-1 lg:hidden" />}
        {/* Desktop: the type never truncates; the place does. */}
        <p className="mt-0.5 hidden min-w-0 text-[14px] leading-snug text-(--ev-ink-75) lg:flex">
          <span className="shrink-0 whitespace-pre">
            <span className="font-medium" style={{ color: ink }}>{metaLabel}</span>
            {(whenLg || organizer || place) && ' · '}
          </span>
          {/* The town (or sign) has its own column; this line keeps the venue. */}
          <span className="truncate">{metaLine(whenLg, place)}</span>
        </p>
        {ridesTo && (
          <p className="mt-1 truncate text-[14px] font-semibold text-(--ev-accent)">
            {t(event.event_type === 'walking_tour' ? 'card.walks_to' : 'card.rides_to', { event: ridesTo })}
          </p>
        )}
        {(event.ride_series_id || langs.length > 0 || event.tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1 lg:mt-1">
            {/* Planned in the Shift app — riders can RSVP there rather than
                following a link to somebody else's site. */}
            {event.ride_series_id && !off && (
              <span className="inline-block rounded-full bg-(--ev-accent-tint-15) px-2.5 py-0.5 text-[13px] font-semibold leading-snug text-(--ev-accent)">
                {t('card.rsvp_no_app')}
              </span>
            )}
            {/* Led in another language (Shift 01697), in its own words: "Español". */}
            {langs.length > 0 && (
              <span lang={langs[0]} title={ledInLineL(event.languages, event.event_type, locale) ?? undefined}
                className="inline-block rounded-full bg-(--ev-accent-tint-15) px-2.5 py-0.5 text-[13px] font-semibold leading-snug text-(--ev-accent)">
                {ownNames(langs)}
              </span>
            )}
            {(langs.length > 0 ? event.tags.filter((t) => t !== 'spanish' && t !== 'bilingual') : event.tags).slice(0, 3).map(tag => {
              const tm = tagInk(getTagMeta(tag), tone)
              return (
                <span
                  key={tag}
                  className="inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-snug"
                  style={{ color: tm.color, backgroundColor: tm.bg }}
                >
                  {tagLabel(tag, locale)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop where column, beside the bookmark: the town, then how far */}
      <div className="hidden w-[240px] shrink-0 flex-col items-end gap-1 text-right lg:flex">
        {town && <span className="max-w-full truncate text-[14px] font-semibold text-(--ev-ink-85)">{town}</span>}
        {away && <span className="text-[14px] font-semibold text-(--ev-ink-85)">{away}</span>}
        {facts && <div className="flex justify-end">{facts}</div>}
        {transit && <TransitLine tr={transit} label={walkTo} className="max-w-full" />}
      </div>

      {/* Bookmark (desktop; on phones it sits under the square) */}
      {saveBtn('hidden h-9 w-9 lg:flex')}
    </div>
  )
}
