'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Calendar as CalendarIcon, LocateFixed } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { eventPath } from '@/lib/events-url'
import { type CommunityEvent, getTypeMeta } from '@/lib/events'
import { withLang } from '@/lib/site-i18n'
import { dateRangeLongL, timeL } from '@/lib/events-i18n'
import { typeInk, TINT } from '@/lib/events-tone'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import { useEventsTone, useEventsI18n } from './EventsTone'
import { trackEvents } from './events-analytics'

/*
 * "For you": a signed-in member's events, ranked as the app's Home ranks
 * them (get_home_event_feed, Shift 01684/01685: how you get around, events
 * like ones you opened, what neighbours open, how near, how soon), each with
 * the app's reason line. Measured from the browser's location when the
 * visitor has already let the site use it and is 10+ miles from home, else
 * from home. Signed-out visitors see nothing here: the calendar keeps its
 * date order. Only events this page lists are shown, so a pick never links
 * somewhere the calendar wouldn't.
 */

const MAX = 3

type Reason = 'own_taste' | 'popular_nearby' | 'near_you' | 'wants_to_bike' | 'walker' | 'new_to_shift' | 'transit' | 'student'

interface FeedRow {
  id: string
  reason: Reason | null
}

/** The browser's location, only when the visitor already allowed it: never a prompt. */
async function grantedPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (p?.state !== 'granted') return null
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { maximumAge: 10 * 60_000, timeout: 5000 },
      )
    })
  } catch {
    return null
  }
}

export default function ForYou({ events }: { events: CommunityEvent[] }) {
  const { tone, hrefBase } = useEventsTone()
  const { locale, t } = useEventsI18n()
  const [picks, setPicks] = useState<{ event: CommunityEvent; reason: Reason | null }[]>([])
  // A member with no home on file and no location shared: the feed has
  // nowhere to measure from (43% of members, 2026-11-13), so offer one tap
  // to share the browser's location, asked only when they tap
  const [needsPlace, setNeedsPlace] = useState(false)
  const [locating, setLocating] = useState(false)
  const cancelled = useRef(false)

  const load = useCallback(async (here: { lat: number; lng: number } | null) => {
    const { data, error } = await supabase.rpc('get_home_event_feed', { p_lat: here?.lat ?? null, p_lng: here?.lng ?? null })
    if (cancelled.current || error || !data) return
    const feed = data as { events?: FeedRow[]; from?: string; origin?: unknown }
    setNeedsPlace(!here && feed.origin == null)
    const byId = new Map(events.map((e) => [e.id, e]))
    const rows = (feed.events ?? [])
      .map((r) => ({ event: byId.get(r.id), reason: r.reason }))
      .filter((r): r is { event: CommunityEvent; reason: Reason | null } => !!r.event)
      .slice(0, MAX)
    setPicks(rows)
    if (rows.length) trackEvents('events_for_you_shown', { count: rows.length, from: feed.from ?? null })
  }, [events])

  useEffect(() => {
    cancelled.current = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await load(await grantedPosition())
    })().catch(() => {})
    return () => {
      cancelled.current = true
    }
  }, [load])

  const shareLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    trackEvents('events_for_you_locate', {})
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        load({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          .catch(() => {})
          .finally(() => setLocating(false))
      },
      // Said no: leave the calendar as it is
      () => { setLocating(false); setNeedsPlace(false) },
      { maximumAge: 10 * 60_000, timeout: 10000 },
    )
  }

  if (needsPlace && !picks.length) {
    return (
      <section className="px-4 pb-5 sm:px-8 sm:pb-6 lg:pb-4" aria-labelledby="events-for-you">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) px-4 py-3">
          <div className="min-w-0">
            <h2 id="events-for-you" className="text-[15px] font-bold text-(--ev-ink)">{t('foryou.title')}</h2>
            <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{t('foryou.locate_lede')}</p>
          </div>
          <button
            type="button"
            onClick={shareLocation}
            disabled={locating}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--ev-ink) px-4 text-[14px] font-bold text-(--ev-bg) disabled:opacity-60"
          >
            <LocateFixed size={16} aria-hidden="true" />
            {t('foryou.locate')}
          </button>
        </div>
      </section>
    )
  }

  if (!picks.length) return null
  const tint = TINT[tone]

  return (
    <section className="px-4 pb-5 sm:px-8 sm:pb-6 lg:pb-4" aria-labelledby="events-for-you">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="events-for-you" className="text-[13px] font-bold uppercase tracking-[0.14em] text-(--ev-accent)">
          {t('foryou.title')}
        </h2>
        <p className="mt-1 text-[14px] text-(--ev-ink-75)">{t('foryou.lede')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map(({ event, reason }, i) => {
            const meta = getTypeMeta(event.event_type)
            const ink = typeInk(meta, tone)
            const Icon = EVENT_TYPE_ICONS[meta.icon] ?? CalendarIcon
            const timeStr = event.event_time ? timeL(event.event_time, locale) : null
            return (
              <Link
                key={event.id}
                href={withLang(eventPath(event, hrefBase), locale)}
                onClick={() => trackEvents('events_for_you_tap', { event_id: event.id, position: i, reason })}
                className="flex items-start gap-3 rounded-2xl border p-4 transition-all duration-200 hover:brightness-110"
                style={{ borderColor: ink + tint.spotLine, backgroundColor: ink + tint.spotBg }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ backgroundColor: ink + tint.tile }}>
                  <Icon size={20} style={{ color: ink }} />
                </div>
                <div className="min-w-0 flex-1">
                  {reason && (
                    <p className="text-[13px] font-semibold" style={{ color: ink }}>
                      {t(`foryou.why_${reason}`)}
                    </p>
                  )}
                  <h3 className="mt-0.5 line-clamp-2 font-display text-[17px] font-bold leading-snug text-(--ev-ink)">{event.title}</h3>
                  <p className="mt-1 text-[13px] font-medium text-(--ev-ink-75)">
                    {dateRangeLongL(event, locale) + (timeStr ? ` · ${timeStr}` : '')}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
