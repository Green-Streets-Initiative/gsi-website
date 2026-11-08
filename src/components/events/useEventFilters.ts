'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  type CommunityEvent, type RideStyle, EVENT_TYPES, TAG_META, TYPE_FILTER_ORDER, DEFAULT_LOCATION,
  RIDE_STYLE_ORDER, RIDE_STYLE_LABEL,
  haversine, parseEventDate, todayKey, getTypeMeta, eventLastDay,
  eventRideStyle, isNoDrop, styleFilterValue, parseStyleFilter,
} from '@/lib/events'
import type { SiteLocale } from '@/lib/site-i18n'
import type { EventsKey } from '@/lib/site-strings/events'
import { eventsT, typeFilterLabelL, tagLabel, dateMediumL, placeLabel, typeLabel, rideLevelLabel, languageNameL } from '@/lib/events-i18n'
import { trackEvents } from './events-analytics'
import { LANGUAGES, eventLanguages, languageEnglish, languageLabel, isLanguage, type PartnerLanguage } from '@/lib/languages'
import { nestFeeders } from '@/lib/go-together'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export const DISTANCE_OPTIONS = [
  { value: '5', label: '5 mi' },
  { value: '10', label: '10 mi' },
  { value: '25', label: '25 mi' },
  { value: 'all', label: 'Statewide' },
] as const
export type DistanceValue = (typeof DISTANCE_OPTIONS)[number]['value']
/**
 * Picking a place narrows to this distance unless one is already picked, so
 * "Near Somerville" shows what's near Somerville (Keith 2026-11-03: it was
 * still statewide). Statewide stays one tap away under How far.
 */
const NEAR_DEFAULT_DISTANCE: DistanceValue = '10'

export const WHEN_OPTIONS = [
  { value: 'upcoming', label: 'All upcoming' },
  { value: 'week', label: 'This week' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'month', label: 'Next 30 days' },
] as const
export type WhenValue = (typeof WHEN_OPTIONS)[number]['value']

/** The "Good for" toggles: the tags with real coverage in the data. */
export const GOOD_FOR_TAGS = ['free', 'beginner_friendly', 'family_friendly'] as const
/** "Rides for" groups. Unlike Good for, an event matches ANY picked group. */
export const AUDIENCE_TAGS = ['women', 'lgbtq', 'seniors', 'students'] as const
/** Languages an event can be led in, other than English (Shift 01697). Like Rides for, an event matches ANY picked one. */
export const FILTER_LANGUAGES = LANGUAGES.map((l) => l.id).filter((id) => id !== 'en')

/** "In Spanish": the chip and pill words for a language filter ("En español" on a Spanish page). */
export function languageFilterLabel(code: PartnerLanguage, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return `In ${languageEnglish(code)}`
  return eventsT(locale)('lang.filter', { lang: languageNameL(code, locale) })
}

export interface UserLoc { lat: number; lng: number; label: string }
export type GeoStatus = 'idle' | 'locating' | 'active'

export interface ActiveFilter { key: string; label: string; clear: () => void }

const DISTANCE_VALUES: readonly string[] = DISTANCE_OPTIONS.map((o) => o.value)
const WHEN_VALUES: readonly string[] = WHEN_OPTIONS.map((o) => o.value)
// The Language filter is "led", not "lang": ?lang= is the page's own language
// (site-i18n), and the two shared one key on main, so ?lang=es filtered to
// Spanish-led events and ?lang=zh-Hans was dropped from the address.
const URL_KEYS = ['q', 'when', 'type', 'level', 'day', 'near', 'dist', 'tags', 'for', 'led', 'saved']

/**
 * The "type" filter is one radio group holding either an event type or a
 * ride level (`style:easy`), the way the Shift app does it. A level already
 * narrows to rides, so the two never need to combine. In the URL a level is
 * written as `level=easy`, which is the link to paste when someone asks
 * where the beginner rides are.
 */
function isRideLevel(v: string): v is RideStyle {
  return (RIDE_STYLE_ORDER as string[]).includes(v)
}

/** What a type-filter value is called on the pill and the applied chip. */
export function typeFilterLabel(value: string, locale: SiteLocale = 'en'): string {
  return typeFilterLabelL(value, locale)
}

function parseNear(v: string | null): UserLoc | null {
  if (!v) return null
  const [latS, lngS, ...rest] = v.split(',')
  const lat = Number(latS)
  const lng = Number(lngS)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, label: rest.join(',').trim() || 'Your location' }
}

function inDateRange(evDate: Date, range: WhenValue, today: Date): boolean {
  if (range === 'upcoming') return true
  const end = new Date(today)
  if (range === 'week') {
    end.setDate(end.getDate() + 7)
    return evDate <= end
  }
  if (range === 'weekend') {
    end.setDate(end.getDate() + 9)
    const dow = evDate.getDay()
    return (dow === 0 || dow === 6) && evDate <= end
  }
  end.setDate(end.getDate() + 31)
  return evDate <= end
}

type Ignore = 'type' | 'tags' | 'audience' | 'lang' | 'day' | 'distance'

interface Options {
  saved: Record<string, boolean>
  /** False only in the phone calendar view, where the week strip is the date control. */
  applyDateRange: boolean
  notify?: (msg: string) => void
  /** The page's language, for chip labels and notices. English when left out. */
  locale?: SiteLocale
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventFilters(events: CommunityEvent[], { saved, applyDateRange, notify, locale = 'en' }: Options) {
  const params = useSearchParams()
  const t = useMemo(() => eventsT(locale), [locale])
  const today = todayKey()
  const todayDate = useMemo(() => parseEventDate(today), [today])

  // Initial state comes from the URL (validated); invalid values fall back.
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [distance, setDistanceState] = useState<DistanceValue>(() => {
    const v = params.get('dist') ?? ''
    if (DISTANCE_VALUES.includes(v)) return v as DistanceValue
    return parseNear(params.get('near')) ? NEAR_DEFAULT_DISTANCE : 'all'
  })
  const [typeFilter, setTypeState] = useState(() => {
    const level = params.get('level')
    if (level && isRideLevel(level)) return styleFilterValue(level)
    const v = params.get('type')
    return v && EVENT_TYPES[v] ? v : 'All'
  })
  const [dateRange, setDateRangeState] = useState<WhenValue>(() => {
    const v = params.get('when') ?? ''
    return WHEN_VALUES.includes(v) ? (v as WhenValue) : 'upcoming'
  })
  const [selectedDay, setSelectedDayState] = useState<string | null>(() => {
    const v = params.get('day')
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today ? v : null
  })
  const [tags, setTags] = useState<string[]>(() =>
    (params.get('tags') ?? '').split(',').filter((t) => t in TAG_META),
  )
  const [audience, setAudience] = useState<string[]>(() =>
    (params.get('for') ?? '').split(',').filter((t) => (AUDIENCE_TAGS as readonly string[]).includes(t)),
  )
  const [langs, setLangs] = useState<PartnerLanguage[]>(() =>
    (params.get('led') ?? '').split(',').filter((c): c is PartnerLanguage => isLanguage(c) && c !== 'en'),
  )
  const [savedOnly, setSavedOnlyState] = useState(() => params.get('saved') === '1')
  const [initialNear] = useState(() => parseNear(params.get('near')))
  const [userLoc, setUserLoc] = useState<UserLoc>(initialNear ?? DEFAULT_LOCATION)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(initialNear ? 'active' : 'idle')

  // --- Setters (tracked) ---

  const setDistance = useCallback((v: DistanceValue) => {
    setDistanceState(v)
    trackEvents('events_filter_changed', { dimension: 'distance', value: v })
  }, [])

  const setTypeFilter = useCallback((t: string) => {
    setTypeState(t)
    trackEvents('events_filter_changed', { dimension: 'type', value: t })
  }, [])

  // A "When" bucket and a picked day are both date scopes; choosing one clears the other.
  const setDateRange = useCallback((v: WhenValue) => {
    setDateRangeState(v)
    setSelectedDayState(null)
    trackEvents('events_filter_changed', { dimension: 'when', value: v })
  }, [])

  const setSelectedDay = useCallback((d: string | null) => {
    setSelectedDayState(d)
    if (d) {
      setDateRangeState('upcoming')
      trackEvents('events_day_selected', { day: d })
    }
  }, [])

  const toggleTag = useCallback((t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
    trackEvents('events_filter_changed', { dimension: 'tag', value: t })
  }, [])

  const toggleAudience = useCallback((t: string) => {
    setAudience((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
    trackEvents('events_filter_changed', { dimension: 'audience', value: t })
  }, [])

  const toggleLang = useCallback((c: PartnerLanguage) => {
    setLangs((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
    trackEvents('events_filter_changed', { dimension: 'language', value: c })
  }, [])

  const setSavedOnly = useCallback((v: boolean) => {
    setSavedOnlyState(v)
    trackEvents('events_filter_changed', { dimension: 'saved', value: v })
  }, [])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      notify?.(t('toast.no_geo'))
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLoc({ lat, lng, label: 'Your location' })
        setGeoStatus('active')
        setDistanceState((d) => (d === 'all' ? NEAR_DEFAULT_DISTANCE : d))
        trackEvents('events_filter_changed', { dimension: 'near', value: 'geolocation' })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
            { headers: { Accept: 'application/json' } },
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.hamlet
          if (city) setUserLoc({ lat, lng, label: city })
        } catch { /* best-effort */ }
      },
      () => {
        setGeoStatus('idle')
        notify?.(t('toast.geo_declined'))
      },
      { timeout: 8000 },
    )
  }, [notify, t])

  const selectCity = useCallback((loc: UserLoc) => {
    setUserLoc(loc)
    setGeoStatus('active')
    setDistanceState((d) => (d === 'all' ? NEAR_DEFAULT_DISTANCE : d))
    notify?.(t('loc.near', { place: placeLabel(loc.label, locale) }))
    trackEvents('events_filter_changed', { dimension: 'near', value: loc.label })
  }, [notify, t, locale])

  // --- One predicate for the list and every facet count ---

  const q = query.trim().toLowerCase()

  const matches = useCallback((ev: CommunityEvent, ignore?: Ignore): boolean => {
    // A multi-day event (Shift 01557) stays until its last day.
    if (eventLastDay(ev) < today) return false
    if (ignore !== 'type' && typeFilter !== 'All') {
      const level = parseStyleFilter(typeFilter)
      if (level ? eventRideStyle(ev) !== level : ev.event_type !== typeFilter) return false
    }
    if (ignore !== 'tags' && tags.length > 0 && !tags.every((t) => ev.tags.includes(t))) return false
    if (ignore !== 'audience' && audience.length > 0 && !audience.some((t) => ev.tags.includes(t))) return false
    if (ignore !== 'lang' && langs.length > 0) {
      const led = eventLanguages(ev.languages)
      if (!langs.some((c) => led.includes(c))) return false
    }
    if (savedOnly && !saved[ev.id]) return false
    if (q) {
      const level = eventRideStyle(ev)
      // English words always match; the page's own words match too.
      const haystack = [ev.title, ev.location_name, ev.event_type, getTypeMeta(ev.event_type).label, ev.organizer_name, level && RIDE_STYLE_LABEL[level], isNoDrop(ev) && 'no-drop',
        ...eventLanguages(ev.languages).flatMap((c) => [languageEnglish(c), languageLabel(c), locale !== 'en' && languageNameL(c, locale)]),
        locale !== 'en' && typeLabel(ev.event_type, locale), locale !== 'en' && level && rideLevelLabel(level, locale)]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (ignore !== 'distance' && distance !== 'all') {
      if (!ev.location_lat || !ev.location_lng) return false
      if (haversine(userLoc.lat, userLoc.lng, ev.location_lat, ev.location_lng) > Number(distance)) return false
    }
    // A picked day shows what is on that day, including a multi-day event in progress.
    if (ignore !== 'day' && selectedDay) return ev.event_date <= selectedDay && selectedDay <= eventLastDay(ev)
    if (applyDateRange && !inDateRange(parseEventDate(ev.event_date), dateRange, todayDate)) return false
    return true
  }, [today, typeFilter, tags, audience, langs, savedOnly, saved, q, distance, userLoc, selectedDay, applyDateRange, dateRange, todayDate, locale])

  const sortEvents = (list: CommunityEvent[]) =>
    list.sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? '').localeCompare(b.event_time ?? ''))

  const filtered = useMemo(() => sortEvents(events.filter((ev) => matches(ev))), [events, matches])

  // Go Together: feeder rides sit in their event's tray, and a feeder within
  // the distance brings in its event from past it (Keith 2026-10-29).
  const entries = useMemo(
    () => nestFeeders(filtered, sortEvents([...events]), (ev) => matches(ev, 'distance')),
    [filtered, events, matches],
  )
  /** A feeder that is a card of its own says where it goes. */
  const ridesTo = useMemo(() => {
    const titles = new Map(events.map((ev) => [ev.id, ev.title]))
    return (ev: CommunityEvent) => (ev.feeds_content_id ? titles.get(ev.feeds_content_id) ?? null : null)
  }, [events])

  /** Same filters minus the picked day; feeds the mini month so its dots stay put. */
  const filteredNoDay = useMemo(
    () => (selectedDay ? sortEvents(events.filter((ev) => matches(ev, 'day'))) : filtered),
    [events, matches, selectedDay, filtered],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 }
    for (const ev of events) {
      if (!matches(ev, 'type')) continue
      counts.All += 1
      counts[ev.event_type] = (counts[ev.event_type] ?? 0) + 1
      const level = eventRideStyle(ev)
      if (level) counts[styleFilterValue(level)] = (counts[styleFilterValue(level)] ?? 0) + 1
    }
    return counts
  }, [events, matches])

  /** Types that have events under the current filters, most common first. */
  const typesByCount = useMemo(() => {
    const order = (t: string) => TYPE_FILTER_ORDER.indexOf(t as (typeof TYPE_FILTER_ORDER)[number])
    return Object.keys(EVENT_TYPES)
      .filter((t) => (typeCounts[t] ?? 0) > 0)
      .sort((a, b) => (typeCounts[b] ?? 0) - (typeCounts[a] ?? 0) || order(a) - order(b))
  }, [typeCounts])

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of GOOD_FOR_TAGS) {
      const others = tags.filter((x) => x !== t)
      counts[t] = events.filter((ev) =>
        matches(ev, 'tags') && ev.tags.includes(t) && others.every((o) => ev.tags.includes(o)),
      ).length
    }
    return counts
  }, [events, matches, tags])

  const audienceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of AUDIENCE_TAGS) counts[t] = events.filter((ev) => matches(ev, 'audience') && ev.tags.includes(t)).length
    return counts
  }, [events, matches])

  /** Languages with events under the other filters; the rest stay hidden ("In Arabic 0" helps nobody). */
  const languageCounts = useMemo(() => {
    const counts: Partial<Record<PartnerLanguage, number>> = {}
    for (const ev of events) {
      if (!matches(ev, 'lang')) continue
      for (const c of eventLanguages(ev.languages)) if (c !== 'en') counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  }, [events, matches])
  const languageChoices = useMemo(
    () => FILTER_LANGUAGES.filter((c) => (languageCounts[c] ?? 0) > 0 || langs.includes(c)),
    [languageCounts, langs],
  )

  // --- Applied filters (for chips, the phone badge, and Clear all) ---

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = []
    if (selectedDay) list.push({ key: 'day', label: dateMediumL(parseEventDate(selectedDay), locale), clear: () => setSelectedDay(null) })
    if (applyDateRange && dateRange !== 'upcoming') {
      list.push({ key: 'when', label: t(`when.${dateRange}` as EventsKey), clear: () => setDateRange('upcoming') })
    }
    if (distance !== 'all') list.push({ key: 'distance', label: t('chip.within_of', { dist: distance, place: placeLabel(userLoc.label, locale) }), clear: () => setDistance('all') })
    if (typeFilter !== 'All') list.push({ key: 'type', label: typeFilterLabel(typeFilter, locale), clear: () => setTypeFilter('All') })
    for (const tag of tags) list.push({ key: `tag:${tag}`, label: tagLabel(tag, locale), clear: () => toggleTag(tag) })
    for (const tag of audience) list.push({ key: `for:${tag}`, label: tagLabel(tag, locale), clear: () => toggleAudience(tag) })
    for (const c of langs) list.push({ key: `lang:${c}`, label: languageFilterLabel(c, locale), clear: () => toggleLang(c) })
    if (savedOnly) list.push({ key: 'saved', label: t('chip.saved'), clear: () => setSavedOnly(false) })
    return list
  }, [selectedDay, applyDateRange, dateRange, distance, userLoc.label, typeFilter, tags, audience, langs, savedOnly, locale, t,
      setSelectedDay, setDateRange, setDistance, setTypeFilter, toggleTag, toggleAudience, toggleLang, setSavedOnly])

  // The picked day is its own control on phones, so it stays out of the badge count.
  const activeFilterCount = activeFilters.filter((f) => f.key !== 'day').length

  const clearAll = useCallback(() => {
    setSelectedDayState(null)
    setDateRangeState('upcoming')
    setDistanceState('all')
    setTypeState('All')
    setTags([])
    setAudience([])
    setLangs([])
    setSavedOnlyState(false)
    trackEvents('events_filter_changed', { dimension: 'all', value: 'clear' })
  }, [])

  const pageKey = [query, distance, typeFilter, dateRange, selectedDay ?? '', tags.join(','), audience.join(','), langs.join(','), savedOnly, applyDateRange].join('|')

  // --- URL sync: replaceState keeps the page's RSC payload untouched ---

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search)
      for (const k of URL_KEYS) next.delete(k)
      if (query.trim()) next.set('q', query.trim())
      if (dateRange !== 'upcoming') next.set('when', dateRange)
      const level = parseStyleFilter(typeFilter)
      if (level) next.set('level', level)
      else if (typeFilter !== 'All') next.set('type', typeFilter)
      if (selectedDay) next.set('day', selectedDay)
      if (geoStatus === 'active') next.set('near', `${userLoc.lat.toFixed(4)},${userLoc.lng.toFixed(4)},${userLoc.label}`)
      // A place with no dist reads as the near default, so Statewide is written out.
      if (distance !== 'all' || geoStatus === 'active') next.set('dist', distance)
      if (tags.length) next.set('tags', tags.join(','))
      if (audience.length) next.set('for', audience.join(','))
      if (langs.length) next.set('led', langs.join(','))
      if (savedOnly) next.set('saved', '1')
      const qs = next.toString()
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      if (url !== window.location.pathname + window.location.search) {
        window.history.replaceState(window.history.state, '', url)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, dateRange, typeFilter, selectedDay, geoStatus, userLoc, distance, tags, audience, langs, savedOnly])

  return {
    // state
    query, distance, typeFilter, dateRange, selectedDay, tags, audience, langs, savedOnly, userLoc, geoStatus,
    initialCity: initialNear?.label ?? '',
    // setters
    setQuery, setDistance, setTypeFilter, setDateRange, setSelectedDay, toggleTag, toggleAudience, toggleLang, setSavedOnly,
    useMyLocation, selectCity,
    // derived
    filtered, filteredNoDay, entries, ridesTo, typeCounts, typesByCount, tagCounts, audienceCounts, languageCounts, languageChoices,
    activeFilters, activeFilterCount, clearAll, pageKey,
  }
}

export type EventFilters = ReturnType<typeof useEventFilters>
