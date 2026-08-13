'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { CalendarBlank } from '@phosphor-icons/react'
import RoamCard from '@/components/roams/RoamCard'
import { getTypeMeta, parseEventDate, formatDistance } from '@/lib/events'
import { EVENT_TYPE_ICONS } from '@/components/events/event-type-icons'
import type { SectionData, CommunityData } from './types'
import { SkeletonRows } from './SectionShell'

/** Community events + Roams — the mobile Explore nearby tab body and the
 *  desktop rail. `compact` narrows the roams grid to fit a ~440px column. */
export function ExploreBody({ community, compact }: {
  community: SectionData<CommunityData | null>
  compact?: boolean
}) {
  const events = community.data?.events ?? []
  const roams = community.data?.roams ?? []

  return (
    <>
      {community.status === 'loading' && <SkeletonRows count={2} />}

      {/* Nearby events — same type iconography as the town pages + calendar */}
      {events.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            <CalendarBlank size={14} weight="bold" />
            Happening near you
          </div>
          <div className="space-y-2.5">
            {events.slice(0, 3).map(e => {
              const meta = getTypeMeta(e.event_type ?? 'other')
              const Icon = EVENT_TYPE_ICONS[meta.icon] ?? EVENT_TYPE_ICONS.Calendar
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  onClick={() => posthog.capture('snapshot_event_clicked', { id: e.id })}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5 transition-colors hover:border-white/[0.16]"
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                    style={{ backgroundColor: `${meta.color}29` }}
                  >
                    <Icon size={16} style={{ color: meta.color }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.62rem] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <p className="text-[0.9rem] font-semibold leading-snug text-white">{e.title}</p>
                    <p className="mt-0.5 text-[0.8rem] text-white/75">
                      {parseEventDate(e.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {e.location_name ? ` · ${e.location_name}` : ''} · {formatDistance(e.distance_miles)} away
                    </p>
                  </span>
                </Link>
              )
            })}
          </div>
          {events.length > 3 && (
            <Link href="/events" className="mt-2.5 inline-block text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80">
              See all events →
            </Link>
          )}
        </div>
      )}

      {/* Roams */}
      {roams.length > 0 && (
        <div className="mt-5">
          <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            Explore your new neighborhood
          </div>
          <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {roams.slice(0, 3).map(r => (
              <div key={r.id} onClick={() => posthog.capture('snapshot_roam_clicked', { id: r.id })}>
                <RoamCard roam={r} />
              </div>
            ))}
          </div>
          {roams.length > 3 && (
            <Link href="/shift/roams" className="mt-2.5 inline-block text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80">
              More roams →
            </Link>
          )}
        </div>
      )}
    </>
  )
}
