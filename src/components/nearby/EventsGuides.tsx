'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import RoamCard from '@/components/roams/RoamCard'
import type { SectionData, CommunityData, GuideItem } from './types'
import { SectionShell, SkeletonRows } from './SectionShell'

interface Props {
  community: SectionData<CommunityData | null>
  guides: SectionData<GuideItem[]>
}

/** Desktop "Start exploring" section: starter guides + events + Roams.
 *  (The mobile shell splits these: guides ride under the mode-relevant
 *  lists in Transit & bike; Explore nearby gets events + Roams.) */
export default function EventsGuides({ community, guides }: Props) {
  const events = community.data?.events ?? []
  const roams = community.data?.roams ?? []
  const nothing =
    community.status !== 'loading' && guides.status !== 'loading' &&
    events.length === 0 && roams.length === 0 && guides.data.length === 0

  if (nothing) return null

  return (
    <SectionShell
      eyebrow="Make it yours"
      title="Start exploring"
      subtitle="Beginner-friendly ways to try your new options — no experience needed."
    >
      <div className="space-y-5">
        <GuidesBlock guides={guides} />
        <ExploreBody community={community} />
      </div>
    </SectionShell>
  )
}

/** Starter micro-guides grid — slots beneath whatever content it's
 *  relevant to (transit/bike lists on mobile, the explore section here). */
export function GuidesBlock({ guides, title }: {
  guides: SectionData<GuideItem[]>
  title?: string
}) {
  if (guides.data.length === 0) return null
  return (
    <div className={title ? 'mt-5' : ''}>
      {title && (
        <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
          {title}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {guides.data.slice(0, 4).map(g => (
          <Link
            key={g.id}
            href={`/guides/${g.slug ?? g.id}`}
            onClick={() => posthog.capture('snapshot_guide_clicked', { slug: g.slug ?? g.id })}
            className="block rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]"
          >
            <p className="text-sm font-semibold leading-snug text-white">{g.title}</p>
            {g.summary && <p className="mt-1 line-clamp-2 text-xs leading-snug text-white/75">{g.summary}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Community events + Roams — the mobile Explore nearby tab body. */
export function ExploreBody({ community }: { community: SectionData<CommunityData | null> }) {
  const events = community.data?.events ?? []
  const roams = community.data?.roams ?? []

  return (
    <>
      {community.status === 'loading' && <SkeletonRows count={2} />}

      {/* Nearby events */}
      {events.length > 0 && (
        <div>
          <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            Happening near you
          </div>
          <div className="space-y-2.5">
            {events.slice(0, 3).map(e => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                onClick={() => posthog.capture('snapshot_event_clicked', { id: e.id })}
                className="block rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5 transition-colors hover:border-white/[0.16]"
              >
                <p className="text-[0.9rem] font-semibold leading-snug text-white">{e.title}</p>
                <p className="mt-0.5 text-[0.8rem] text-white/75">
                  {new Date(`${e.event_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {e.location_name ? ` · ${e.location_name}` : ''} · {e.distance_miles.toFixed(1)} mi away
                </p>
              </Link>
            ))}
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
          <div className="grid gap-3 sm:grid-cols-3">
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
