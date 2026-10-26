import RideStoreBadges from '@/components/rides/RideStoreBadges'
import type { AppOnlyRide } from '@/lib/rides/public'
import '@/components/events/events-tone.css'

/**
 * Walk and bike buses carry children, so their meeting points and times
 * stay inside the Shift app. The link still lands somewhere useful.
 */
export default function AppOnlyRidePage({ ride }: { ride: AppOnlyRide }) {
  const what = ride.kind === 'walk_bus' ? 'walking school bus' : 'bike bus'
  return (
    <div className="min-h-[70vh] bg-(--ev-bg) px-4 py-12 sm:px-8 events-tone events-tone-light">
      <div className="mx-auto max-w-[560px] rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6 sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-(--ev-accent)">You&rsquo;re invited</p>
        <h1 className="mt-2 font-display text-[clamp(26px,4vw,36px)] font-extrabold leading-[1.1] text-(--ev-ink)">{ride.name}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-(--ev-ink-80)">
          This {what} runs in the Shift app, where families see the schedule, the meeting spot and the group&rsquo;s live location.
          Get Shift, then join with code <span className="font-bold tracking-wider text-(--ev-ink)">{ride.code}</span>.
        </p>
        <RideStoreBadges code={ride.code} className="mt-5" placement="ride_page_bus" height={40} />
      </div>
    </div>
  )
}
