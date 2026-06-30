'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar as CalendarIcon, List, Search, Navigation, MapPin,
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  GraduationCap, Wrench, Flag, Users,
} from 'lucide-react'
import {
  type CommunityEvent, getTypeMeta, haversine, parseEventDate,
  dateKey, groupLabel, todayKey, lookupTown, DEFAULT_LOCATION,
  TYPE_FILTER_ORDER, EVENT_TYPES,
} from '@/lib/events'
import CalendarGrid from './CalendarGrid'
import EventCard from './EventCard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  MapPin, CalendarIcon, GraduationCap, Wrench, Flag, Users,
}

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
// Component
// ---------------------------------------------------------------------------

interface EventsPageProps {
  events: CommunityEvent[]
}

export default function EventsPage({ events }: EventsPageProps) {
  const router = useRouter()

  // View state
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  // Filter state
  const [query, setQuery] = useState('')
  const [distance, setDistance] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState('All')
  const [dateRange, setDateRange] = useState('upcoming')

  // Location state
  const [userLoc, setUserLoc] = useState(DEFAULT_LOCATION)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'active'>('idle')
  const [addressInput, setAddressInput] = useState('')

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
    for (const ev of filtered) {
      if (ev.event_date !== currentKey) {
        currentKey = ev.event_date
        const d = parseEventDate(ev.event_date)
        groups.push({ key: currentKey, label: groupLabel(d), events: [] })
      }
      groups[groups.length - 1].events.push(ev)
    }
    return groups
  }, [filtered])

  // --- Handlers ---

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not available — try typing a town.')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' })
        setGeoStatus('active')
        showToast('Using your location')
      },
      () => {
        setGeoStatus('idle')
        showToast('Location access denied — type a town instead.')
      },
      { timeout: 8000 },
    )
  }

  const handleSetTown = () => {
    const coords = lookupTown(addressInput)
    if (coords) {
      setUserLoc({ lat: coords[0], lng: coords[1], label: addressInput.trim() })
      setGeoStatus('active')
      showToast(`Showing events near ${addressInput.trim()}`)
    } else {
      showToast('Town not recognized — try a Massachusetts city name.')
    }
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
      <div className="flex gap-2">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSetTown()}
          placeholder="Town or city"
          className="flex-1 rounded-lg border border-white/[0.14] bg-[#1F2034] px-3 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-lime focus:outline-none"
        />
        <button
          onClick={handleSetTown}
          className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/[0.06]"
        >
          Set
        </button>
      </div>
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
          className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
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
        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
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
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
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

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-navy">
      {/* Hero */}
      <section className="px-8 pb-8 pt-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">
            Community Events · Massachusetts
          </p>
          <h1 className="mt-3 font-display text-[clamp(40px,5.4vw,64px)] font-extrabold leading-[1.06] tracking-tighter text-white">
            Find your next ride,{' '}
            <br className="hidden sm:block" />
            walk, or roll.
          </h1>
          <p className="mt-4 max-w-[560px] text-base leading-relaxed text-white/75">
            Group rides, e-bike demos, walking tours, transit meetups, civic actions, festivals — real events across Massachusetts, all in one place.
          </p>
          <Link
            href="/events/submit"
            className="mt-6 inline-block rounded-[10px] bg-lime px-6 py-3 text-[14px] font-bold text-navy transition-opacity hover:opacity-85"
          >
            Submit an event
          </Link>
        </div>
      </section>

      {/* View switcher */}
      <section className="px-8 pb-6">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-xl bg-card p-1">
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                  view === 'calendar' ? 'bg-lime text-navy' : 'text-white/70 hover:text-white'
                }`}
              >
                <CalendarIcon size={16} />
                Calendar
              </button>
              <button
                onClick={() => setView('list')}
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
      <section className="px-8 pb-24">
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

                {/* Day panel */}
                <div className="mt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-white">{dayPanelTitle}</h3>
                    <span className="font-mono text-[13px] text-white/50">{dayPanelEvents.length} events</span>
                  </div>

                  {dayPanelEvents.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.07] bg-card px-8 py-12 text-center">
                      <p className="text-[15px] text-white/60">
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
                      {dayPanelEvents.map((ev) => (
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

                {/* Mobile filters (shown below calendar on small screens) */}
                <div className="mt-8 rounded-2xl border border-white/[0.07] bg-card p-5 lg:hidden">
                  <div className="mb-4">
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
                  <div className="mb-4">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Distance</label>
                    {locationControl}
                    <div className="mt-2">{distancePills}</div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Type</label>
                    {typePills}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============== LIST VIEW ============== */}
          {view === 'list' && (
            <div>
              {/* Toolbar */}
              <div className="mb-6 border-b border-white/[0.07] pb-6">
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
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setDateRange(opt.value)}
                          className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                            dateRange === opt.value
                              ? 'border-lime/50 text-lime'
                              : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Result count */}
              <p className="mb-4 text-[13px] text-white/55">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </p>

              {/* Grouped by day */}
              {listGroups.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.07] bg-card px-8 py-16 text-center">
                  <p className="text-[15px] text-white/60">No events match your filters.</p>
                  <Link href="/events/submit" className="mt-3 inline-block text-[13px] font-semibold text-lime hover:underline">
                    Submit an event
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {listGroups.map((group) => (
                    <div key={group.key}>
                      <div className="mb-3 flex items-center gap-3">
                        <h3 className="whitespace-nowrap text-[14px] font-semibold text-white/75">{group.label}</h3>
                        <div className="h-px flex-1 bg-white/[0.07]" />
                        <span className="font-mono text-[12px] text-white/50">{group.events.length}</span>
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
            </div>
          )}
        </div>
      </section>

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
