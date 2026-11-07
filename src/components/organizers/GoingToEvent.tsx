'use client'

import { useEffect, useRef, useState } from 'react'
import { Bike, CalendarHeart, Footprints, Search } from 'lucide-react'
import { formatTime } from '@/lib/events'
import { getFeedCandidates, type FeedCandidate, type FeedTarget } from '@/lib/organizers/api'
import { dateLabel } from '@/lib/organizers/ride-words'
import { Button, Card, Input, SectionTitle, cx } from './ui'

/**
 * "Going to an event?" (Go Together, Shift 01460): the leader picks the
 * bigger event the group rides or walks to, and the ride shows on that
 * event's page. The console twin of the app's components/FeedEventPicker.tsx:
 * the same suggestions (events on the ride's date, nearest to where it ends)
 * and the same words. A recurring ride picks once, for its next date; each
 * later date links to that event's row on the same day.
 *
 * Saved by the editor after the ride itself (set_ride_feeds), so a link that
 * fails never loses the ride.
 */
/** The nearest few first; the rest behind "Show more". */
const SHOWN = 4

export default function GoingToEvent({ value, onChange, date, at, seriesId, walk, recurring }: {
  value: FeedTarget | null
  onChange: (v: FeedTarget | null) => void
  /** The ride's next date; null until the schedule is set. */
  date: string | null
  /** Where the ride ends, for "closest first". */
  at: { lat: number; lng: number } | null
  seriesId: string | null
  walk: boolean
  recurring: boolean
}) {
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const [found, setFound] = useState<{ key: string; rows: FeedCandidate[]; failed: boolean } | null>(null)
  const req = useRef(0)
  const Icon = walk ? Footprints : Bike
  // Nothing loads until the leader asks (Keith 2026-11-07: few rides go to
  // an event, so no cards until someone takes an action). Same as the app's button.
  const open = picking
  // About 100 m of movement before asking again.
  const key = `${date}|${at ? `${at.lat.toFixed(3)},${at.lng.toFixed(3)}` : ''}|${query.trim()}`
  const rows = found?.key === key ? found.rows : null

  useEffect(() => {
    if (!open || !date) return
    const n = ++req.current
    const t = setTimeout(() => {
      getFeedCandidates({ date, lat: at?.lat, lng: at?.lng, query, seriesId }).then(
        (r) => { if (n === req.current) setFound({ key, rows: r, failed: false }) },
        () => { if (n === req.current) setFound({ key, rows: [], failed: true }) })
    }, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [open, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const day = date ? dateLabel(date) : null
  const hint = !date
    ? 'Optional. Your ride shows on its page.'
    : recurring
      ? `Optional. Each time it's on, starting ${day}, your ${walk ? 'walk' : 'ride'} shows on the event's page.`
      : `Optional. Your ${walk ? 'walk' : 'ride'} shows on the event's page.`

  return (
    <Card id="sec-event">
      <SectionTitle hint={hint}>Going to an event?</SectionTitle>

      {value && !picking && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--ev-accent-fill) bg-(--ev-panel) p-3 ring-1 ring-(--ev-accent-fill)">
          <Icon className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-(--ev-ink)">{walk ? 'Walks' : 'Rides'} to {value.title}</span>
            {value.event_date && (
              <span className="block text-[14px] text-(--ev-ink-75)">
                {[dateLabel(value.event_date), value.event_time ? formatTime(value.event_time) : null, value.location_name].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => setPicking(true)}>Change</Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Button>
          </span>
        </div>
      )}

      {!value && !picking && (
        <Button onClick={() => setPicking(true)}>
          <CalendarHeart className="h-4 w-4" aria-hidden />Choose an event
        </Button>
      )}

      {open && !date && (
        <p className="text-[14px] leading-snug text-(--ev-ink-75)">Set when your {walk ? 'walk' : 'ride'} happens first, then pick the event.</p>
      )}

      {open && date && (
        <>
          <label className="relative mb-3 block">
            <span className="sr-only">Search events on {day}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ev-ink-75)" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search events on ${day}`} className="pl-9" />
          </label>
          {!query && (
            <p className="mb-2 text-[14px] text-(--ev-ink-75)">
              {at ? `Closest to where your ${walk ? 'walk' : 'ride'} ends first.` : 'Add where you meet to see the closest events first.'}
            </p>
          )}
          {rows == null ? (
            <p className="text-[14px] text-(--ev-ink-75)">Finding events…</p>
          ) : found?.failed ? (
            <p className="text-[14px] text-(--ev-ink-75)">Couldn&rsquo;t load events. Check your connection and try again.</p>
          ) : rows.length === 0 ? (
            <p className="text-[14px] text-(--ev-ink-75)">{query ? 'No events match that.' : `No events on ${day} yet. Try a search.`}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Event your ride goes to">
              {(all || query ? rows : rows.slice(0, SHOWN)).map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={value?.id === c.id}
                  onClick={() => { onChange(c); setPicking(false); setQuery(''); setAll(false) }}
                  className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition',
                    value?.id === c.id ? 'border-(--ev-accent-fill) bg-(--ev-panel) ring-1 ring-(--ev-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel-faint)')}>
                  <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-(--ev-ink)">{c.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-(--ev-ink-75)">
                      {[
                        c.event_date !== date ? dateLabel(c.event_date) : null,
                        c.event_time ? formatTime(c.event_time) : null,
                        c.location_name,
                        c.miles != null ? `${c.miles < 10 ? c.miles.toFixed(1) : Math.round(c.miles)} mi from the end` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {rows && !query && !all && rows.length > SHOWN && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll(true)}>Show {rows.length - SHOWN} more</Button>
          )}
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setPicking(false); setQuery(''); setAll(false) }}>
            {value ? `Keep ${value.title}` : 'Not going to an event'}
          </Button>
        </>
      )}
    </Card>
  )
}
