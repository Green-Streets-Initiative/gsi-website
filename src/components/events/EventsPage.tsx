'use client'

import { useState, useCallback, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { eventPath } from '@/lib/events-url'
import { ArrowRight, Calendar as CalendarIcon, List, Search, SlidersHorizontal } from 'lucide-react'
import {
  type CommunityEvent, getTypeMeta, parseEventDate, eventLastDay, isDeadline,
} from '@/lib/events'
import { withLang, type SiteLocale } from '@/lib/site-i18n'
import { typeLabel, timeL, dateRangeLongL, dayTitleL, eventCount, eventsT } from '@/lib/events-i18n'
import { typeInk, TINT } from '@/lib/events-tone'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import { EventsToneProvider, toneClass, useEventsTone, useEventsI18n, type EventsTone } from './EventsTone'
import './events-tone.css'
import EventCard from './EventCard'
import FeederTray from './FeederTray'
import WeekStrip from './WeekStrip'
import FiltersSheet from './FiltersSheet'
import FilterBar from './FilterBar'
import AppliedFilters from './AppliedFilters'
import MiniMonth from './MiniMonth'
import Agenda, { AGENDA_PAGE } from './Agenda'
import EventAlertSignup from './EventAlertSignup'
import ForYou from './ForYou'
import { TypePills, LevelPills, LocationControl, DistancePills, WhenPills, TagToggles, AudienceToggles, hasAudienceChoices, LanguageToggles } from './FilterControls'
import { useEventFilters } from './useEventFilters'
import { useSavedEvents } from './useSavedEvents'
import { DateTile } from './EventPageParts'
import { eventBodyPlain } from '@/lib/event-body'

/** On phones the email sign-up sits after this many events. */
const PHONE_SIGNUP_AFTER = 5

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

const SPOTLIGHT_MAX = 3

function SpotlightCard({ event, compact }: { event: CommunityEvent; compact: boolean }) {
  const { tone, hrefBase } = useEventsTone()
  const { locale, t } = useEventsI18n()
  const meta = getTypeMeta(event.event_type)
  const ink = typeInk(meta, tone)
  const tint = TINT[tone]
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? CalendarIcon
  const timeStr = event.event_time ? timeL(event.event_time, locale) : null
  // "November 1 to 30, 2026" for a multi-day event (Shift 01557).
  const when = dateRangeLongL(event, locale) + (timeStr ? ` · ${timeStr}` : '')
  const dateLine = isDeadline(event.event_type) ? t('card.entry_deadline', { when }) : when
  const firstLine = event.body?.split('\n').find((line) => line.trim())
  const summary = firstLine ? eventBodyPlain(firstLine) : null
  const upcoming = event.event_date >= new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  return (
    <Link
      href={withLang(eventPath(event, hrefBase), locale)}
      className="group flex min-w-[86%] snap-start items-start gap-3.5 rounded-2xl border p-4 transition-all duration-200 hover:brightness-110 sm:min-w-0 sm:gap-5 sm:p-6 lg:gap-4 lg:p-4"
      style={{ borderColor: ink + tint.spotLine, backgroundColor: ink + tint.spotBg }}
    >
      {/* The date tile while it is still ahead; a campaign that has started keeps its type icon. */}
      {upcoming ? (
        <DateTile date={event.event_date} locale={locale} />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: ink + tint.tile }}>
          <Icon size={26} style={{ color: ink }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: ink }}>
          {upcoming && <Icon size={16} aria-hidden />}
          {t('spot.label', { type: typeLabel(event.event_type, locale) })}
        </p>
        <h2 className="mt-1 font-(family-name:--font-headline) text-[18px] font-extrabold leading-snug tracking-[-0.01em] text-(--ev-ink) sm:text-[22px] lg:text-[18px]">
          {event.title}
        </h2>
        <p className="mt-1 text-[14px] font-medium text-(--ev-ink-75)">{dateLine}</p>
        {summary && (
          <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-(--ev-ink-75) max-sm:hidden lg:mt-1 lg:line-clamp-1 lg:text-[14px]">{summary}</p>
        )}
      </div>
      <span
        className={`mt-1 hidden shrink-0 items-center gap-1.5 text-[14px] font-semibold sm:flex ${compact ? 'lg:hidden' : ''}`}
        style={{ color: ink }}
      >
        {t('spot.see_details')}
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
  /** `light` is the cream site; `dark` (default) is the app-dark original. */
  tone?: EventsTone
  /** Where event links point; the staged copy passes its own base so review stays inside it. */
  hrefBase?: string
  /** The page's language (translation plan, batch 5). English when left out. */
  locale?: SiteLocale
}

// Direction A (Keith 2026-11-17): one plain Overpass headline and a short
// line, no eyebrow, so the first phone screen reaches the listings. Both tones
// share it; only the colors differ, through the --ev-* tokens.
const HEADER = {
  h1: 'font-(family-name:--font-headline) text-[30px] font-extrabold leading-[1.1] tracking-[-0.01em] text-(--ev-ink) sm:text-[38px] lg:text-[42px]',
  // Phones show the count on the list's own count line, just below.
  lede: 'mt-2 hidden text-[16px] leading-snug text-(--ev-ink-75) sm:block lg:text-[17px]',
  cta: 'hidden shrink-0 self-end rounded-[10px] border-2 border-(--ev-primary) px-5 py-2.5 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-primary) transition-colors hover:bg-(--ev-accent-tint-8) lg:inline-block',
}

export default function EventsPage({ events, tone = 'dark', hrefBase = '/events', locale = 'en' }: EventsPageProps) {
  const h = HEADER
  const t = eventsT(locale)
  const submitHref = `${hrefBase}/submit`
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
    locale,
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
    // Still running: a featured month-long campaign stays up through its last day.
    .filter((ev) => ev.featured && parseEventDate(eventLastDay(ev)) >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, SPOTLIGHT_MAX)

  const pickView = (v: 'calendar' | 'list') => {
    setPhoneView(v)
    // A day picked on the week strip would otherwise silently narrow the list.
    if (v === 'list') f.setSelectedDay(null)
  }

  const handleToggleSave = (id: string) => {
    showToast(toggleSaved(id) ? t('toast.saved') : t('toast.unsaved'))
  }

  const hostCard = (cls: string) => (
    <div className={`${cls} rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4`}>
      <p className="font-(family-name:--font-headline) text-[16px] font-extrabold text-(--ev-ink)">{t('host.title')}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-(--ev-ink-75)">
        {t('host.body')}
      </p>
      <Link
        href={submitHref}
        className="mt-3 inline-block rounded-[10px] border-2 border-(--ev-primary) px-4 py-2 font-(family-name:--font-headline) text-[14px] font-extrabold text-(--ev-primary) transition-colors hover:bg-(--ev-accent-tint-8)"
      >
        {t('cta.submit')}
      </Link>
    </div>
  )

  const dayPanelTitle = f.selectedDay ? dayTitleL(parseEventDate(f.selectedDay), locale) : t('day.upcoming')

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <EventsToneProvider tone={tone} hrefBase={hrefBase} locale={locale}>
    <div className={`min-h-screen bg-(--ev-bg) ${toneClass(tone)}`}>
      {/* Header */}
      <section className="px-4 pb-4 pt-6 sm:px-8 lg:pb-4 lg:pt-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <h1 className={h.h1}>
              {t('page.h1')}
            </h1>
            <p className={h.lede}>
              {t('page.lede', { count: events.length })}
            </p>
          </div>
          <Link
            href={submitHref}
            className={h.cta}
          >
            {t('cta.submit')}
          </Link>
        </div>
      </section>

      {/* For you: a signed-in member's events, ranked as the app's Home ranks them */}
      <ForYou events={events} />

      {/* Spotlight */}
      {spotlightEvents.length > 0 && (
        <section className="px-4 pb-5 sm:px-8 sm:pb-6 lg:pb-4">
          <div
            className={`mx-auto flex max-w-[1200px] snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-col sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid lg:gap-4 ${
              spotlightEvents.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
            }`}
          >
            {spotlightEvents.map((ev) => (
              <SpotlightCard key={ev.id} event={ev} compact={spotlightEvents.length >= 3} />
            ))}
          </div>
        </section>
      )}

      {/* Phone toolbar: sticky under the fixed 60px site nav */}
      <section className="sticky top-[60px] z-30 border-b border-(--ev-line) bg-(--ev-bar) px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--ev-ink-60)" />
            <input
              type="text"
              value={f.query}
              onChange={(e) => f.setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              className="h-10 w-full rounded-lg border border-(--ev-line-mid) bg-(--ev-input) pl-9 pr-3 text-[16px] text-(--ev-ink) placeholder:text-(--ev-ink-60) focus:border-(--ev-accent) focus:outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-(--ev-line-mid) px-3 text-[14px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
          >
            <SlidersHorizontal size={15} />
            {t('filters.button')}
            {f.activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-(--ev-accent-fill) px-1.5 text-[11px] font-bold text-(--ev-on-accent-fill)">
                {f.activeFilterCount}
              </span>
            )}
          </button>
          <div className="inline-flex h-10 shrink-0 rounded-lg bg-(--ev-card) p-1">
            <button
              onClick={() => pickView('list')}
              aria-pressed={phoneView === 'list'}
              aria-label={t('view.list')}
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${phoneView === 'list' ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'text-(--ev-ink-75)'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => pickView('calendar')}
              aria-pressed={phoneView === 'calendar'}
              aria-label={t('view.calendar')}
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors ${phoneView === 'calendar' ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'text-(--ev-ink-75)'}`}
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
                  <h3 className="font-(family-name:--font-headline) text-[19px] font-extrabold text-(--ev-ink)">{dayPanelTitle}</h3>
                  <span className="text-[14px] text-(--ev-ink-75)">{locale === 'en' ? t('count.events_other', { count: f.filtered.length }) : eventCount(t, f.filtered.length)}</span>
                </div>
                {f.filtered.length === 0 ? (
                  <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) px-8 py-12 text-center">
                    <p className="text-[15px] text-(--ev-ink-75)">
                      {f.selectedDay ? t('empty.day_phone') : t('empty.filters_phone')}
                    </p>
                    <Link href={submitHref} className="mt-3 inline-block text-[15px] font-semibold text-(--ev-accent) hover:underline">
                      {t('cta.submit')}
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(f.selectedDay ? f.entries : f.entries.slice(0, listLimit)).map(({ event: ev, feeders }, i) => (
                      <div key={ev.id}>
                        <EventCard
                          event={ev}
                          userLat={f.userLoc.lat}
                          userLng={f.userLoc.lng}
                          showAway={f.geoStatus === 'active'}
                          showDate={!f.selectedDay}
                          saved={!!saved[ev.id]}
                          onToggleSave={handleToggleSave}
                          ridesTo={f.ridesTo(ev)}
                          attached={feeders.length > 0}
                        />
                        {feeders.length > 0 && (
                          <FeederTray eventId={ev.id} feeders={feeders} userLat={f.userLoc.lat} userLng={f.userLoc.lng} showAway={f.geoStatus === 'active'} />
                        )}
                        {i === Math.min(PHONE_SIGNUP_AFTER, f.entries.length) - 1 && (
                          <EventAlertSignup filters={f} source="events_list" className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!f.selectedDay && f.entries.length > listLimit && (
                  <button
                    onClick={() => setListLimit((n) => n + AGENDA_PAGE)}
                    className="mx-auto mt-5 block rounded-[10px] border border-(--ev-line-strong) px-6 py-3 text-[14px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                  >
                    {t('agenda.show_more', { count: f.entries.length - listLimit })}
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
                entries={f.entries}
                ridesTo={f.ridesTo}
                limit={listLimit}
                onShowMore={() => setListLimit((n) => n + AGENDA_PAGE)}
                paged={!f.selectedDay}
                userLoc={f.userLoc}
                showAway={f.geoStatus === 'active'}
                saved={saved}
                onToggleSave={handleToggleSave}
                emptyMessage={
                  f.savedOnly && savedCount === 0
                    ? t('empty.saved')
                    : f.selectedDay
                      ? t('empty.day')
                      : t('empty.filters')
                }
                showCount
                countAction={
                  f.filtered.length > 0 && (
                    <a href="#event-alerts" className="flex min-h-[44px] items-center text-[14px] font-semibold text-(--ev-accent) hover:underline">
                      {t('alerts.jump')}
                    </a>
                  )
                }
                // Phone: after the first five events, not below the whole
                // list, where almost nobody scrolled (calendar growth plan
                // bet 1). The count line jumps here. Desktop has it in the sidebar.
                inset={{
                  after: PHONE_SIGNUP_AFTER,
                  node: <EventAlertSignup filters={f} source="events_list" id="event-alerts" className="mt-2.5 scroll-mt-[140px] lg:hidden" />,
                }}
              />
              {/* Phones: the header has no Submit button, so hosts find it after the list. */}
              {hostCard('mt-8 lg:hidden')}
            </div>

            <aside className="sticky top-[132px] hidden self-start lg:block">
              <MiniMonth events={f.filteredNoDay} selectedDay={f.selectedDay} onSelectDay={f.setSelectedDay} />
              <EventAlertSignup filters={f} source="events_sidebar" className="mt-4" />
              {hostCard('mt-4')}
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
          {/* First when there is a choice: for someone who'd rather ride in Spanish, it is the question (Shift 01697). */}
          {f.languageChoices.length > 0 && (
            <div>
              <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.led_in')}</p>
              <LanguageToggles choices={f.languageChoices} selected={f.langs} counts={f.languageCounts} onToggle={f.toggleLang} />
            </div>
          )}
          <div>
            <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.type')}</p>
            <TypePills value={f.typeFilter} counts={f.typeCounts} onChange={f.setTypeFilter} />
          </div>
          <div>
            <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.level')}</p>
            <LevelPills value={f.typeFilter} counts={f.typeCounts} onChange={f.setTypeFilter} />
          </div>
          <div>
            <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.distance')}</p>
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
              <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.when')}</p>
              <WhenPills value={f.dateRange} onChange={f.setDateRange} />
            </div>
          )}
          <div>
            <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.good_for')}</p>
            <TagToggles selected={f.tags} counts={f.tagCounts} onToggle={f.toggleTag} />
          </div>
          {hasAudienceChoices(f.audience, f.audienceCounts) && (
            <div>
              <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.rides_for')}</p>
              <AudienceToggles selected={f.audience} counts={f.audienceCounts} onToggle={f.toggleAudience} />
            </div>
          )}
          {savedCount > 0 && (
            <div>
              <p className="mb-2 font-(family-name:--font-headline) text-[15px] font-extrabold text-(--ev-ink)">{t('sheet.saved')}</p>
              <button
                onClick={() => f.setSavedOnly(!f.savedOnly)}
                aria-pressed={f.savedOnly}
                className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                  f.savedOnly ? 'border-(--ev-accent-line) text-(--ev-accent)' : 'border-(--ev-line-mid) text-(--ev-ink-78) hover:bg-(--ev-panel)'
                }`}
              >
                {t('sheet.only_saved', { count: savedCount })}
              </button>
            </div>
          )}
        </div>
      </FiltersSheet>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--ev-line-mid) bg-(--ev-toast) px-5 py-3 text-[14px] font-medium text-(--ev-ink-on-toast) shadow-(--ev-shadow)"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
    </EventsToneProvider>
  )
}
