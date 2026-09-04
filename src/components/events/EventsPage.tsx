'use client'

import { useState, useCallback, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar as CalendarIcon, List, Search, SlidersHorizontal } from 'lucide-react'
import {
  type CommunityEvent, getTypeMeta, parseEventDate, dateLong, formatTime, isDeadline,
} from '@/lib/events'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import EventCard from './EventCard'
import WeekStrip from './WeekStrip'
import FiltersSheet from './FiltersSheet'
import FilterBar from './FilterBar'
import AppliedFilters from './AppliedFilters'
import MiniMonth from './MiniMonth'
import Agenda, { AGENDA_PAGE } from './Agenda'
import { TypePills, LocationControl, DistancePills, WhenPills, TagToggles } from './FilterControls'
import { useEventFilters } from './useEventFilters'
import { useSavedEvents } from './useSavedEvents'

// ---------------------------------------------------------------------------
// Viewport: phones can switch between the list and a week strip; desktop is
// always the agenda + mini month. Read through useSyncExternalStore so the
// server render (phone tree) hydrates cleanly.
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
// Spotlight — featured events pinned above the list, unaffected by filters
// (a statewide contest shouldn't vanish under "5 mi").
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
      className="group flex min-w-[86%] snap-start items-start gap-4 rounded-2xl border p-5 transition-all duration-200 hover:brightness-110 sm:min-w-0 sm:gap-5 sm:p-7 lg:gap-4 lg:p-4"
      style={{ borderColor: meta.color + '55', backgroundColor: meta.color + '12' }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[13px] lg:h-11 lg:w-11"
        style={{ backgroundColor: meta.color + '29' }}
      >
        <Icon size={26} className="lg:hidden" style={{ color: meta.color }} />
        <Icon size={20} className="hidden lg:block" style={{ color: meta.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          Spotlight · {meta.label}
        </p>
        <h2 className="mt-1 font-display text-[20px] font-bold leading-snug text-white sm:text-[22px] lg:text-[17px]">
          {event.title}
        </h2>
        <p className="mt-1 text-[13px] font-medium text-white/75">{dateLine}</p>
        {summary && (
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-white/75 lg:mt-1 lg:line-clamp-1 lg:text-[13px]">{summary}</p>
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
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getDesktopServerSnapshot)

  // Phone view: the visitor's explicit choice wins, otherwise the list.
  const [phoneView, setPhoneView] = useState<'calendar' | 'list'>('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [listLimit, setListLimit] = useState(AGENDA_PAGE)

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const { saved, toggle: toggleSaved, count: savedCount } = useSavedEvents()
  const f = useEventFilters(events, {
    saved,
    // The week strip is the date control in the phone calendar view.
    applyDateRange: isDesktop || phoneView === 'list',
    notify: showToast,
  })

  // Any filter change starts paging over (state adjusted during render, the
  // React-sanctioned way to derive a reset from props/state).
  const [prevPageKey, setPrevPageKey] = useState(f.pageKey)
  if (prevPageKey !== f.pageKey) {
    setPrevPageKey(f.pageKey)
    setListLimit(AGENDA_PAGE)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const spotlightEvents = events
    .filter((ev) => ev.featured && parseEventDate(ev.event_date) >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 2)

  const pickView = (v: 'calendar' | 'list') => {
    setPhoneView(v)
    // A day picked on the week strip would otherwise silently narrow the list.
    if (v === 'list') f.setSelectedDay(null)
  }

  const handleToggleSave = (id: string) => {
    showToast(toggleSaved(id) ? 'Event saved' : 'Removed from saved')
  }

  const dayPanelTitle = f.selectedDay ? dateLong(parseEventDate(f.selectedDay)).replace(/, \d{4}$/, '') : 'Upcoming events'

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-navy">
      {/* Header */}
      <section className="px-4 pb-5 pt-8 sm:px-8 lg:pb-4 lg:pt-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">
              Community Events · Massachusetts
            </p>
            <h1 className="mt-3 font-display text-[clamp(32px,5.4vw,64px)] font-extrabold leading-[1.06] tracking-tighter text-white lg:mt-2 lg:text-[40px]">
              Find your next ride,{' '}
              <br className="hidden sm:block lg:hidden" />
              walk, or roll.
            </h1>
            <p className="mt-4 hidden max-w-[640px] text-base leading-relaxed text-white/75 sm:block lg:mt-2 lg:text-[15px]">
              {events.length} upcoming events across Massachusetts: group rides, e-bike demos, walking tours, transit meetups, talks, civic actions, and festivals, all in one place.
            </p>
          </div>
          <Link
            href="/events/submit"
            className="inline-block shrink-0 self-start rounded-[10px] bg-lime px-6 py-3 text-[14px] font-bold text-navy transition-opacity hover:opacity-85 lg:self-end"
          >
            Submit an event
          </Link>
        </div>
      </section>

      {/* Spotlight */}
      {spotlightEvents.length > 0 && (
        <section className="px-4 pb-5 sm:px-8 sm:pb-6 lg:pb-4">
          <div className="mx-auto flex max-w-[1200px] snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-col sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid lg:grid-cols-2 lg:gap-4">
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
              value={f.query}
              onChange={(e) => f.setQuery(e.target.value)}
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
            {f.activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-navy">
                {f.activeFilterCount}
              </span>
            )}
          </button>
          <div className="inline-flex h-10 shrink-0 rounded-lg bg-card p-1">
            <button
              onClick={() => pickView('list')}
              aria-pressed={phoneView === 'list'}
              aria-label="List view"
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${phoneView === 'list' ? 'bg-lime text-navy' : 'text-white/75'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => pickView('calendar')}
              aria-pressed={phoneView === 'calendar'}
              aria-label="Calendar view"
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${phoneView === 'calendar' ? 'bg-lime text-navy' : 'text-white/75'}`}
            >
              <CalendarIcon size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Desktop filter bar: sticky under the site nav */}
      <FilterBar filters={f} savedCount={savedCount} resultCount={f.filtered.length} />

      {/* Main content */}
      <section className="px-4 pb-24 pt-4 sm:px-8 lg:pt-4">
        <div className="mx-auto max-w-[1200px]">

          {/* Phone calendar view: week strip + that day's events */}
          {phoneView === 'calendar' && (
            <div className="lg:hidden">
              <WeekStrip events={f.filteredNoDay} selectedDay={f.selectedDay} onSelectDay={f.setSelectedDay} />
              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-white">{dayPanelTitle}</h3>
                  <span className="font-mono text-[13px] text-white/75">{f.filtered.length} events</span>
                </div>
                {f.filtered.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.07] bg-card px-8 py-12 text-center">
                    <p className="text-[15px] text-white/75">
                      {f.selectedDay
                        ? 'Nothing on this day yet. Pick another date above, or host your own.'
                        : 'No upcoming events match your filters.'}
                    </p>
                    <Link href="/events/submit" className="mt-3 inline-block text-[13px] font-semibold text-lime hover:underline">
                      Submit an event
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(f.selectedDay ? f.filtered : f.filtered.slice(0, listLimit)).map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        userLat={f.userLoc.lat}
                        userLng={f.userLoc.lng}
                        showDate={!f.selectedDay}
                        saved={!!saved[ev.id]}
                        onToggleSave={handleToggleSave}
                      />
                    ))}
                  </div>
                )}
                {!f.selectedDay && f.filtered.length > listLimit && (
                  <button
                    onClick={() => setListLimit((n) => n + AGENDA_PAGE)}
                    className="mx-auto mt-5 block rounded-[10px] border border-white/[0.18] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                  >
                    Show more · {f.filtered.length - listLimit} remaining
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Agenda: the phone list view, and always on desktop (with the mini month beside it) */}
          <div className={`${phoneView === 'calendar' ? 'hidden lg:grid' : 'grid'} lg:grid-cols-[minmax(0,1fr)_248px] lg:items-start lg:gap-8`}>
            <div className="min-w-0">
              <AppliedFilters filters={f.activeFilters} onClearAll={f.clearAll} className="mb-4 hidden lg:flex" />
              <Agenda
                events={f.filtered}
                limit={listLimit}
                onShowMore={() => setListLimit((n) => n + AGENDA_PAGE)}
                paged={!f.selectedDay}
                userLoc={f.userLoc}
                saved={saved}
                onToggleSave={handleToggleSave}
                emptyMessage={
                  f.savedOnly && savedCount === 0
                    ? 'Nothing saved yet. Tap the bookmark on any event to keep it here.'
                    : f.selectedDay
                      ? 'Nothing on this day yet. Pick another date, or host your own.'
                      : 'No events match your filters.'
                }
                showCount
              />
            </div>

            <aside className="sticky top-[132px] hidden self-start lg:block">
              <MiniMonth events={f.filteredNoDay} selectedDay={f.selectedDay} onSelectDay={f.setSelectedDay} />
              <div className="mt-4 rounded-2xl border border-white/[0.07] bg-card p-4">
                <p className="text-[14px] font-bold text-white">Hosting a ride, walk, or workshop?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                  Add it here and it reaches people across the state.
                </p>
                <Link
                  href="/events/submit"
                  className="mt-3 inline-block rounded-[10px] border border-lime/50 px-4 py-2 text-[13px] font-bold text-lime transition-colors hover:bg-lime/[0.08]"
                >
                  Submit an event
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Phone filters sheet */}
      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={f.clearAll}
        activeCount={f.activeFilterCount}
        resultCount={f.filtered.length}
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Event type</p>
            <TypePills value={f.typeFilter} counts={f.typeCounts} onChange={f.setTypeFilter} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Distance from you</p>
            <LocationControl
              geoStatus={f.geoStatus}
              userLoc={f.userLoc}
              initialCity={f.initialCity}
              onUseMyLocation={f.useMyLocation}
              onCitySelect={f.selectCity}
            />
            <div className="mt-2"><DistancePills value={f.distance} onChange={f.setDistance} /></div>
          </div>
          {phoneView === 'list' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">When</p>
              <WhenPills value={f.dateRange} onChange={f.setDateRange} />
            </div>
          )}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Good for</p>
            <TagToggles selected={f.tags} counts={f.tagCounts} onToggle={f.toggleTag} />
          </div>
          {savedCount > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Saved</p>
              <button
                onClick={() => f.setSavedOnly(!f.savedOnly)}
                aria-pressed={f.savedOnly}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  f.savedOnly ? 'border-lime/50 text-lime' : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
                }`}
              >
                Only saved events · {savedCount}
              </button>
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
