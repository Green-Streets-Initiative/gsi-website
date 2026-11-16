'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { CalendarPlus, Calendar, Copy, Globe } from 'lucide-react'
import type { CommunityEvent } from '@/lib/events'
import { feedFor, type FeedKindSlug } from '@/lib/event-feeds'
import { useEventsI18n } from './EventsTone'
import type { EventsKey } from '@/lib/site-strings/events'

const CTA: Record<FeedKindSlug, EventsKey> = {
  'group-rides': 'feed.cta_group_rides',
  'walking-groups': 'feed.cta_walking_groups',
  'bike-repair': 'feed.cta_bike_repair',
}

/**
 * "Get every group ride in Cambridge in your calendar" (PLG L-24, see
 * src/lib/event-feeds.ts): one tap subscribes the visitor's own calendar to
 * every upcoming event of this kind in this town, with no account. Shown on
 * past events too: a missed ride is the best moment to offer the next one.
 * Same three ways as a host's calendar (HostFollowCard).
 */
export default function EventFeedSubscribe({ event, className = '' }: { event: CommunityEvent; className?: string }) {
  const { t } = useEventsI18n()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const feed = feedFor(event)
  if (!feed) return null

  // The public address: a feed is always followed from the live site, and the
  // links must match on the server and in the browser.
  const https = `https://www.gogreenstreets.org${feed.path}`
  const webcal = https.replace(/^https:/, 'webcal:')
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`
  const track = (method: string) => posthog.capture('event_feed_subscribe', { kind: feed.kind, town: feed.slug, method, event_id: event.id })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(https)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch { /* clipboard blocked */ }
    track('copy')
  }

  const item = 'flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] border border-(--ev-line-strong) px-4 text-left text-[14px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)'

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) track('open') }}
        aria-expanded={open}
        className="inline-flex items-start gap-2 text-left text-[15px] font-semibold text-(--ev-accent) hover:underline"
      >
        <CalendarPlus size={18} className="mt-0.5 shrink-0" />
        {t(CTA[feed.kind], { town: feed.town })}
      </button>
      {open && (
        <div className="mt-3 max-w-[360px]">
          <p className="text-[14px] text-(--ev-ink-80)">{t('feed.note')}</p>
          <div className="mt-3 flex flex-col gap-2">
            <a href={google} target="_blank" rel="noopener noreferrer" onClick={() => track('google')} className={item}>
              <Globe size={16} /> Google Calendar
            </a>
            <a href={webcal} onClick={() => track('webcal')} className={item}>
              <Calendar size={16} /> {t('feed.apple')}
            </a>
            <button type="button" onClick={copy} className={item}>
              <Copy size={16} /> {copied ? t('feed.copied') : t('feed.copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
