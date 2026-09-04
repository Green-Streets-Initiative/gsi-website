'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  type CommunityEvent, EVENT_TYPES, TAG_META, TYPE_FILTER_ORDER, DEFAULT_LOCATION,
  haversine, parseEventDate, todayKey, getTypeMeta, getTagMeta, dateMedium,
} from '@/lib/events'
import { trackEvents } from './events-analytics'

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

export const WHEN_OPTIONS = [
  { value: 'upcoming', label: 'All upcoming' },
  { value: 'week', label: 'This week' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'month', label: 'Next 30 days' },
] as const
export type WhenValue = (typeof WHEN_OPTIONS)[number]['value']

/** The "Good for" toggles: the tags with real coverage in the data. */
export const GOOD_FOR_TAGS = ['free', 'beginner_friendly', 'family_friendly'] as const

export interface UserLoc { lat: number; lng: number; label: string }
export type GeoStatus = 'idle' | 'locating' | 'active'

export interface ActiveFilter { key: string; label: string; clear: () => void }

const DISTANCE_VALUES: readonly string[] = DISTANCE_OPTIONS.map((o) => o.value)
const WHEN_VALUES: readonly string[] = WHEN_OPTIONS.map((o) => o.value)
const URL_KEYS = ['q', 'when', 'type', 'day', 'near', 'dist', 'tags', 'saved']

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

type Ignore = 'type' | 'tags' | 'day'

interface Options {
  saved: Record<string, boolean>
  /** False only in the phone calendar view, where the week strip is the date control. */
  applyDateRange: boolean
  notify?: (msg: string) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventFilters(events: CommunityEvent[], { saved, applyDateRange, notify }: Options) {
  const params = useSearchParams()
  const today = todayKey()
  const todayDate = useMemo(() => parseEventDate(today), [today])

  // Initial state comes from the URL (validated); invalid values fall back.
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [distance, setDistanceState] = useState<DistanceValue>(() => {
    const v = params.get('dist') ?? ''
    return DISTANCE_VALUES.includes(v) ? (v as DistanceValue) : 'all'
  })
  const [typeFilter, setTypeState] = useState(() => {
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

  const setSavedOnly = useCallback((v: boolean) => {
    setSavedOnlyState(v)
    trackEvents('events_filter_changed', { dimension: 'saved', value: v })
  }, [])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      notify?.('Location is not available here. Type a town instead.')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLoc({ lat, lng, label: 'Your location' })
        setGeoStatus('active')
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
        notify?.('Location access was declined. Type a town instead.')
      },
      { timeout: 8000 },
    )
  }, [notify])

  const selectCity = useCallback((loc: UserLoc) => {
    setUserLoc(loc)
    setGeoStatus('active')
    notify?.(`Near ${loc.label}`)
    trackEvents('events_filter_changed', { dimension: 'near', value: loc.label })
  }, [notify])

  // --- One predicate for the list and every facet count ---

  const q = query.trim().toLowerCase()

  const matches = useCallback((ev: CommunityEvent, ignore?: Ignore): boolean => {
    if (ev.event_date < today) return false
    if (ignore !== 'type' && typeFilter !== 'All' && ev.event_type !== typeFilter) return false
    if (ignore !== 'tags' && tags.length > 0 && !tags.every((t) => ev.tags.includes(t))) return false
    if (savedOnly && !saved[ev.id]) return false
    if (q) {
      const haystack = [ev.title, ev.location_name, ev.event_type, getTypeMeta(ev.event_type).label, ev.organizer_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (distance !== 'all') {
      if (!ev.location_lat || !ev.location_lng) return false
      if (haversine(userLoc.lat, userLoc.lng, ev.location_lat, ev.location_lng) > Number(distance)) return false
    }
    if (ignore !== 'day' && selectedDay) return ev.event_date === selectedDay
    if (applyDateRange && !inDateRange(parseEventDate(ev.event_date), dateRange, todayDate)) return false
    return true
  }, [today, typeFilter, tags, savedOnly, saved, q, distance, userLoc, selectedDay, applyDateRange, dateRange, todayDate])

  const sortEvents = (list: CommunityEvent[]) =>
    list.sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? '').localeCompare(b.event_time ?? ''))

  const filtered = useMemo(() => sortEvents(events.filter((ev) => matches(ev))), [events, matches])

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

  // --- Applied filters (for chips, the phone badge, and Clear all) ---

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = []
    if (selectedDay) list.push({ key: 'day', label: dateMedium(parseEventDate(selectedDay)), clear: () => setSelectedDay(null) })
    if (applyDateRange && dateRange !== 'upcoming') {
      list.push({ key: 'when', label: WHEN_OPTIONS.find((o) => o.value === dateRange)?.label ?? dateRange, clear: () => setDateRange('upcoming') })
    }
    if (distance !== 'all') list.push({ key: 'distance', label: `Within ${distance} mi of ${userLoc.label}`, clear: () => setDistance('all') })
    if (typeFilter !== 'All') list.push({ key: 'type', label: getTypeMeta(typeFilter).label, clear: () => setTypeFilter('All') })
    for (const t of tags) list.push({ key: `tag:${t}`, label: getTagMeta(t).label, clear: () => toggleTag(t) })
    if (savedOnly) list.push({ key: 'saved', label: 'Saved', clear: () => setSavedOnly(false) })
    return list
  }, [selectedDay, applyDateRange, dateRange, distance, userLoc.label, typeFilter, tags, savedOnly,
      setSelectedDay, setDateRange, setDistance, setTypeFilter, toggleTag, setSavedOnly])

  // The picked day is its own control on phones, so it stays out of the badge count.
  const activeFilterCount = activeFilters.filter((f) => f.key !== 'day').length

  const clearAll = useCallback(() => {
    setSelectedDayState(null)
    setDateRangeState('upcoming')
    setDistanceState('all')
    setTypeState('All')
    setTags([])
    setSavedOnlyState(false)
    trackEvents('events_filter_changed', { dimension: 'all', value: 'clear' })
  }, [])

  const pageKey = [query, distance, typeFilter, dateRange, selectedDay ?? '', tags.join(','), savedOnly, applyDateRange].join('|')

  // --- URL sync: replaceState keeps the page's RSC payload untouched ---

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search)
      for (const k of URL_KEYS) next.delete(k)
      if (query.trim()) next.set('q', query.trim())
      if (dateRange !== 'upcoming') next.set('when', dateRange)
      if (typeFilter !== 'All') next.set('type', typeFilter)
      if (selectedDay) next.set('day', selectedDay)
      if (geoStatus === 'active') next.set('near', `${userLoc.lat.toFixed(4)},${userLoc.lng.toFixed(4)},${userLoc.label}`)
      if (distance !== 'all') next.set('dist', distance)
      if (tags.length) next.set('tags', tags.join(','))
      if (savedOnly) next.set('saved', '1')
      const qs = next.toString()
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      if (url !== window.location.pathname + window.location.search) {
        window.history.replaceState(window.history.state, '', url)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, dateRange, typeFilter, selectedDay, geoStatus, userLoc, distance, tags, savedOnly])

  return {
    // state
    query, distance, typeFilter, dateRange, selectedDay, tags, savedOnly, userLoc, geoStatus,
    initialCity: initialNear?.label ?? '',
    // setters
    setQuery, setDistance, setTypeFilter, setDateRange, setSelectedDay, toggleTag, setSavedOnly,
    useMyLocation, selectCity,
    // derived
    filtered, filteredNoDay, typeCounts, typesByCount, tagCounts,
    activeFilters, activeFilterCount, clearAll, pageKey,
  }
}

export type EventFilters = ReturnType<typeof useEventFilters>
