'use client'

import { useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Calendar as CalendarIcon, List, Search, Navigation, SlidersHorizontal } from 'lucide-react'
import {
  type CommunityEvent, getTypeMeta, haversine, parseEventDate,
  dateKey, dateLong, formatTime, groupLabel, isDeadline, todayKey, DEFAULT_LOCATION,
  TYPE_FILTER_ORDER, EVENT_TYPES,
} from '@/lib/events'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import CalendarGrid from './CalendarGrid'
import EventCard from './EventCard'
import CityAutocomplete from './CityAutocomplete'
import WeekStrip from './WeekStrip'
import FiltersSheet from './FiltersSheet'

// ---------------------------------------------------------------------------
// Distance pills
// ---------------------------------------------------------------------------

const DISTANCE_OPTIONS = [
  { value: '5', label: '5 mi' },
  { value: '10', label: '10 mi' },
  { value: '25', label: '25 mi' },
  { value: 'all', label: 'Statewide' },
] as const

// ---------------------------------------------------------------------------
// Date range options (list view only)
// ---------------------------------------------------------------------------

const DATE_RANGE_OPTIONS = [
  { value: 'upcoming', label: 'All upcoming' },
  { value: 'week', label: 'This week' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'month', label: 'Next 30 days' },
] as const

// ---------------------------------------------------------------------------
// Viewport: phones land on the list, desktop on the calendar. Read through
// useSyncExternalStore so the server render (list) hydrates cleanly and the
// desktop upgrade happens in the same commit as the media query result.
// ---------------------------------------------------------------------------

const DESKTOP_QUERY = '(min-width: 1024px)'
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getDesktopSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches
const getDesktopServerSnapshot = () => false

// ---------------------------------------------------------------------------
// Spotlight — featured events pinned above the calendar, unaffected by the
// distance/type filters (a statewide contest shouldn't vanish under "5 mi").
// ---------------------------------------------------------------------------

function SpotlightCard({ event }: { event: CommunityEvent }) {
  const meta = getTypeMeta(event.event_type)
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? CalendarIcon
  const evDate = parseEventDate(event.event_date)
  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const dateLine =
    (isDeadline(event.event_type) ? 'Entry deadline: ' : '') +
    dateLong(evDate) +
    (timeStr ? ` · ${timeStr}` : '')
  const summary = event.body?.split('\n').find((line) => line.trim()) ?? null

  return (
    <Link
      href={`/events/${encodeURIComponent(event.id)}`}
      className="group flex min-w-[86%] snap-start items-start gap-4 rounded-2xl border p-5 transition-all duration-200 hover:brightness-110 sm:min-w-0 sm:gap-5 sm:p-7"
      style={{ borderColor: meta.color + '55', backgroundColor: meta.color + '12' }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[13px]"
        style={{ backgroundColor: meta.color + '29' }}
      >
        <Icon size={26} style={{ color: meta.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          Spotlight · {meta.label}
        </p>
        <h2 className="mt-1 font-display text-[20px] font-bold leading-snug text-white sm:text-[22px]">
          {event.title}
        </h2>
        <p className="mt-1 text-[13px] font-medium text-white/75">{dateLine}</p>
        {summary && (
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-white/75">{summary}</p>
        )}
      </div>
      <span
        className="mt-1 hidden shrink-0 items-center gap-1.5 text-[13px] font-semibold sm:flex"
        style={{ color: meta.color }}
      >
        See details
        <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventsPageProps {
  events: CommunityEvent[]
}

export default function EventsPage({ events }: EventsPageProps) {
  const router = useRouter()

    // View state: the visitor's explicit choice wins; otherwise width decides.
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getDesktopServerSnapshot)
  const [viewChoice, setViewChoice] = useState<'calendar' | 'list' | null>(null)
  const view: 'calendar' | 'list' = viewChoice ?? (isDesktop ? 'calendar' : 'list')
  const pickView = (v: 'calendar' | 'list') => setViewChoice(v)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Long lists render in pages of 40 so a phone never lays out 180 cards.
  const LIST_PAGE = 40
  const [listLimit, setListLimit] = useState(LIST_PAGE)

  // Filter state
  const [query, setQuery] = useState('')
  const [distance, setDistance] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState('All')
  const [dateRange, setDateRange] = useState('upcoming')

  // Location state
  const [userLoc, setUserLoc] = useState(DEFAULT_LOCATION)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'active'>('idle')

  // Calendar state
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Saved events
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // --- Filtering ---

  const today = todayKey()

  // Featured events for the Spotlight strip — kept out of the filter pipeline.
  const spotlightEvents = useMemo(
    () =>
      events
        .filter((ev) => ev.featured && ev.event_date >= today)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
        .slice(0, 2),
    [events, today],
  )

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      // Future events only
      if (ev.event_date < today) return false

      // Type filter
      if (typeFilter !== 'All' && ev.event_type !== typeFilter) return false

      // Text search
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const haystack = [ev.title, ev.location_name, ev.event_type, ev.organizer_name]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      // Distance filter
      if (distance !== 'all' && ev.location_lat && ev.location_lng) {
        const d = haversine(userLoc.lat, userLoc.lng, ev.location_lat, ev.location_lng)
        if (d > Number(distance)) return false
      }
      if (distance !== 'all' && (!ev.location_lat || !ev.location_lng)) return false

      // Date range (list view only)
      if (view === 'list') {
        const evDate = parseEventDate(ev.event_date)
        const todayDate = new Date()
        todayDate.setHours(0, 0, 0, 0)
        if (dateRange === 'week') {
          const end = new Date(todayDate)
          end.setDate(end.getDate() + 7)
          if (evDate > end) return false
        } else if (dateRange === 'weekend') {
          const end = new Date(todayDate)
          end.setDate(end.getDate() + 9)
          const dow = evDate.getDay()
          if (!(dow === 0 || dow === 6) || evDate > end) return false
        } else if (dateRange === 'month') {
          const end = new Date(todayDate)
          end.setDate(end.getDate() + 31)
          if (evDate > end) return false
        }
      }

      return true
    }).sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? '').localeCompare(b.event_time ?? ''))
  }, [events, today, typeFilter, query, distance, userLoc, view, dateRange])

    // Any filter change starts paging over (state adjusted during render, the
  // React-sanctioned way to derive a reset from props/state).
  const pageKey = [typeFilter, query, distance, dateRange, view, selectedDay].join('|')
  const [prevPageKey, setPrevPageKey] = useState(pageKey)
  if (prevPageKey !== pageKey) {
    setPrevPageKey(pageKey)
    setListLimit(LIST_PAGE)
  }

  // Type facet counts (respecting distance + search filters, not type filter)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 }
    for (const ev of events) {
      if (ev.event_date < today) continue
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const haystack = [ev.title, ev.location_name, ev.event_type, ev.organizer_name]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) continue
      }
      if (distance !== 'all' && ev.location_lat && ev.location_lng) {
        const d = haversine(userLoc.lat, userLoc.lng, ev.location_lat, ev.location_lng)
        if (d > Number(distance)) continue
      }
      if (distance !== 'all' && (!ev.location_lat || !ev.location_lng)) continue
      counts.All = (counts.All ?? 0) + 1
      counts[ev.event_type] = (counts[ev.event_type] ?? 0) + 1
    }
    return counts
  }, [events, today, query, distance, userLoc])

  // --- Calendar day panel events ---

  const dayPanelEvents = useMemo(() => {
    if (selectedDay) {
      return filtered.filter((ev) => ev.event_date === selectedDay)
    }
    return filtered
  }, [filtered, selectedDay])

  const dayPanelTitle = selectedDay
    ? (() => {
        const d = parseEventDate(selectedDay)
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`
      })()
    : 'Upcoming events'

  // --- List view: group by day ---

  const listGroups = useMemo(() => {
    const groups: { key: string; label: string; events: CommunityEvent[] }[] = []
    let currentKey = ''
        for (const ev of filtered.slice(0, listLimit)) {
      if (ev.event_date !== currentKey) {
        currentKey = ev.event_date
        const d = parseEventDate(ev.event_date)
        groups.push({ key: currentKey, label: groupLabel(d), events: [] })
      }
      groups[groups.length - 1].events.push(ev)
    }
        return groups
  }, [filtered, listLimit])

  // --- Handlers ---

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not available — try typing a town.')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLoc({ lat, lng, label: 'Your location' })
        setGeoStatus('active')
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
        showToast('Location access denied — type a town instead.')
      },
      { timeout: 8000 },
    )
  }

  const handleCitySelect = (loc: { lat: number; lng: number; label: string }) => {
    setUserLoc(loc)
    setGeoStatus('active')
    showToast(`Near ${loc.label}`)
  }

  const handleToggleSave = (id: string) => {
    setSaved((s) => {
      const next = { ...s }
      if (next[id]) {
        delete next[id]
        showToast('Removed from saved')
      } else {
        next[id] = true
        showToast('Event saved')
      }
      return next
    })
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
    setSelectedDay(null)
  }

    const activeFilterCount =
    (typeFilter !== 'All' ? 1 : 0) +
    (distance !== 'all' ? 1 : 0) +
    (view === 'list' && dateRange !== 'upcoming' ? 1 : 0)
  const clearFilters = () => {
    setTypeFilter('All')
    setDistance('all')
    setDateRange('upcoming')
  }

  // --- Location control (shared between views) ---

  const locationControl = (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          onClick={handleUseMyLocation}
          disabled={geoStatus === 'locating'}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          <Navigation size={13} />
          {geoStatus === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <CityAutocomplete onSelect={handleCitySelect} />
      {geoStatus === 'active' && (
        <p className="mt-1.5 text-[11px] text-lime/80">
          Near {userLoc.label}
        </p>
      )}
    </div>
  )

  // --- Distance pills ---

  const distancePills = (
    <div className="flex flex-wrap gap-1.5">
      {DISTANCE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setDistance(opt.value)}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            distance === opt.value
              ? 'border-lime/50 text-lime'
              : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  // --- Type pills (list view) ---

  const typePills = (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => setTypeFilter('All')}
        className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
          typeFilter === 'All'
            ? 'border-lime/50 text-lime'
            : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
        }`}
      >
        All
      </button>
      {TYPE_FILTER_ORDER.map((t) => {
        const meta = EVENT_TYPES[t]
        if (!meta) return null
        const count = typeCounts[t] ?? 0
        if (count === 0) return null
        return (
          <button
            key={t}
            onClick={() => setTypeFilter(t === typeFilter ? 'All' : t)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              typeFilter === t
                ? 'border-lime/50 text-lime'
                : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
            }`}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )

    // --- When pills (list view) ---

  const whenPills = (
    <div className="flex flex-wrap gap-1.5">
      {DATE_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setDateRange(opt.value)}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
            dateRange === opt.value
              ? 'border-lime/50 text-lime'
              : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-navy">
      {/* Hero */}
            <section className="px-4 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">
            Community Events · Massachusetts
          </p>
          <h1 className="mt-3 font-display text-[clamp(32px,5.4vw,64px)] font-extrabold leading-[1.06] tracking-tighter text-white">
            Find your next ride,{' '}
            <br className="hidden sm:block" />
            walk, or roll.
          </h1>
          <p className="mt-4 hidden max-w-[560px] text-base leading-relaxed text-white/75 sm:block">
            Group rides, e-bike demos, walking tours, transit meetups, talks, civic actions, festivals — real events across Massachusetts, all in one place.
          </p>
          <Link
            href="/events/submit"
            className="mt-4 inline-block rounded-[10px] bg-lime px-6 py-3 text-[14px] font-bold text-navy transition-opacity hover:opacity-85 sm:mt-6"
          >
            Submit an event
          </Link>
        </div>
      </section>

      {/* Spotlight */}
      {spotlightEvents.length > 0 && (
                <section className="px-4 pb-5 sm:px-8 sm:pb-6">
          <div className="mx-auto flex max-w-[1200px] snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-col sm:gap-4 sm:overflow-visible sm:pb-0">
            {spotlightEvents.map((ev) => (
              <SpotlightCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

            {/* Phone toolbar: sticky under the fixed 60px site nav */}
      <section className="sticky top-[60px] z-30 border-b border-white/[0.07] bg-navy/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events"
              aria-label="Search events"
              className="h-10 w-full rounded-lg border border-white/[0.14] bg-[#1F2034] pl-9 pr-3 text-[14px] text-white placeholder:text-white/60 focus:border-lime focus:outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-navy">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="inline-flex h-10 shrink-0 rounded-lg bg-card p-1">
            <button
              onClick={() => pickView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${view === 'list' ? 'bg-lime text-navy' : 'text-white/75'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => pickView('calendar')}
              aria-pressed={view === 'calendar'}
              aria-label="Calendar view"
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${view === 'calendar' ? 'bg-lime text-navy' : 'text-white/75'}`}
            >
              <CalendarIcon size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* View switcher (desktop) */}
      <section className="hidden px-8 pb-6 lg:block">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-xl bg-card p-1">
              <button
                onClick={() => pickView('calendar')}
                className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                  view === 'calendar' ? 'bg-lime text-navy' : 'text-white/70 hover:text-white'
                }`}
              >
                <CalendarIcon size={16} />
                Calendar
              </button>
                            <button
                onClick={() => pickView('list')}
                className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                  view === 'list' ? 'bg-lime text-navy' : 'text-white/70 hover:text-white'
                }`}
              >
                <List size={16} />
                List
              </button>
            </div>
          </div>
        </div>
      </section>

            {/* Main content */}
      <section className="px-4 pb-24 sm:px-8">
        <div className="mx-auto max-w-[1200px]">

          {/* ============== CALENDAR VIEW ============== */}
          {view === 'calendar' && (
            <div className="grid gap-7 lg:grid-cols-[272px_1fr]">
              {/* Sidebar */}
              <aside className="sticky top-[92px] hidden self-start rounded-2xl border border-white/[0.07] bg-card p-[22px] lg:block" style={{ maxHeight: 'calc(100vh - 108px)', overflowY: 'auto' }}>
                {/* Search */}
                <div className="mb-5">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Search</label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Title or town"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#1F2034] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/50 focus:border-lime focus:outline-none"
                    />
                  </div>
                </div>

                {/* Distance */}
                <div className="mb-5">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Distance from you</label>
                  {locationControl}
                  <div className="mt-3">{distancePills}</div>
                </div>

                {/* Event type */}
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Event type</label>
                  <div className="flex flex-col gap-0.5">
                    {/* All */}
                    <button
                      onClick={() => setTypeFilter('All')}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                        typeFilter === 'All'
                          ? 'border border-lime/30 bg-lime/[0.1] text-lime'
                          : 'text-white/80 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span>All</span>
                      <span className="font-mono text-[12px] text-white/50">{typeCounts.All ?? 0}</span>
                    </button>
                    {TYPE_FILTER_ORDER.map((t) => {
                      const meta = EVENT_TYPES[t]
                      if (!meta) return null
                      const count = typeCounts[t] ?? 0
                      if (count === 0) return null
                      return (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(t === typeFilter ? 'All' : t)}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                            typeFilter === t
                              ? 'border border-lime/30 bg-lime/[0.1] text-lime'
                              : 'text-white/80 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                            {meta.label}
                          </span>
                          <span className="font-mono text-[12px] text-white/50">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </aside>

              {/* Calendar + panel */}
              <div className="min-w-0">
                                <div className="hidden lg:block">
                  <CalendarGrid
                    events={filtered}
                    year={calYear}
                    monthIndex={calMonth}
                    selectedDay={selectedDay}
                    onPrevMonth={prevMonth}
                    onNextMonth={nextMonth}
                    onSelectDay={setSelectedDay}
                    onSelectEvent={(id) => router.push(`/events/${encodeURIComponent(id)}`)}
                  />
                </div>
                <div className="lg:hidden">
                  <WeekStrip events={filtered} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                </div>

                {/* Day panel */}
                <div className="mt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-white">{dayPanelTitle}</h3>
                    <span className="font-mono text-[13px] text-white/70">{dayPanelEvents.length} events</span>
                  </div>

                  {dayPanelEvents.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.07] bg-card px-8 py-12 text-center">
                      <p className="text-[15px] text-white/75">
                        {selectedDay
                          ? 'No events on this day. Pick another date above — or host your own.'
                          : 'No upcoming events match your filters.'}
                      </p>
                      <Link href="/events/submit" className="mt-3 inline-block text-[13px] font-semibold text-lime hover:underline">
                        Submit an event
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                                            {(selectedDay ? dayPanelEvents : dayPanelEvents.slice(0, listLimit)).map((ev) => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          userLat={userLoc.lat}
                          userLng={userLoc.lng}
                          showDate={!selectedDay}
                          saved={!!saved[ev.id]}
                          onToggleSave={handleToggleSave}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {!selectedDay && dayPanelEvents.length > listLimit && (
                  <button
                    onClick={() => setListLimit((n) => n + LIST_PAGE)}
                    className="mx-auto mt-5 block rounded-[10px] border border-white/[0.18] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                  >
                    Show more · {dayPanelEvents.length - listLimit} remaining
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============== LIST VIEW ============== */}
          {view === 'list' && (
            <div>
                            {/* Toolbar (desktop; phones use the sticky toolbar + filters sheet) */}
              <div className="mb-6 hidden border-b border-white/[0.07] pb-6 lg:block">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="relative max-w-[440px] flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search events"
                      className="w-full rounded-lg border border-white/[0.14] bg-[#1F2034] py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/50 focus:border-lime focus:outline-none"
                    />
                  </div>
                  <Link
                    href="/events/submit"
                    className="rounded-[10px] border border-lime/50 px-5 py-2 text-[13px] font-bold text-lime transition-colors hover:bg-lime/[0.08]"
                  >
                    Submit an event
                  </Link>
                </div>

                {/* Type pills */}
                <div className="mb-3">
                  <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Type</span>
                  {typePills}
                </div>

                {/* Distance + When */}
                <div className="flex flex-wrap items-start gap-6">
                  <div>
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Distance from you</span>
                    <div className="mt-1.5">{locationControl}</div>
                    <div className="mt-2">{distancePills}</div>
                  </div>
                  <div>
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">When</span>
                                        <div className="mt-1.5">{whenPills}</div>
                  </div>
                </div>
              </div>

              {/* Result count */}
                            <p className="mb-4 text-[13px] text-white/70">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </p>

              {/* Grouped by day */}
              {listGroups.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-card px-8 py-16 text-center">
                  <p className="text-[15px] text-white/75">No events match your filters.</p>
                  <Link href="/events/submit" className="mt-3 inline-block text-[13px] font-semibold text-lime hover:underline">
                    Submit an event
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {listGroups.map((group) => (
                    <div key={group.key}>
                                            <div className="sticky top-[116px] z-20 mb-3 flex items-center gap-3 bg-navy py-2 lg:top-[60px]">
                        <h3 className="whitespace-nowrap text-[14px] font-semibold text-white/80">{group.label}</h3>
                        <div className="h-px flex-1 bg-white/[0.07]" />
                        <span className="font-mono text-[12px] text-white/70">{group.events.length}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {group.events.map((ev) => (
                          <EventCard
                            key={ev.id}
                            event={ev}
                            userLat={userLoc.lat}
                            userLng={userLoc.lng}
                            saved={!!saved[ev.id]}
                            onToggleSave={handleToggleSave}
                          />
                        ))}
                      </div>
                    </div>
                                    ))}
                </div>
              )}
              {filtered.length > listLimit && (
                <button
                  onClick={() => setListLimit((n) => n + LIST_PAGE)}
                  className="mx-auto mt-6 block rounded-[10px] border border-white/[0.18] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Show more · {filtered.length - listLimit} remaining
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Phone filters sheet */}
      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFilters}
        activeCount={activeFilterCount}
        resultCount={filtered.length}
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Event type</p>
            {typePills}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Distance from you</p>
            {locationControl}
            <div className="mt-2">{distancePills}</div>
          </div>
          {view === 'list' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">When</p>
              {whenPills}
            </div>
          )}
        </div>
      </FiltersSheet>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/[0.14] bg-[#2E2F45] px-5 py-3 text-[13px] font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
