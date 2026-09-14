import TrackedLink from '@/components/TrackedLink'
import { weekdayDateET } from '@/lib/campaigns/format'

/**
 * Shown when nothing is running, coming up, or freshly wrapped.
 *
 * The page still returns 200. /challenges will end up in the sitemap and on
 * printed material, so a 404 on a promoted URL is worse than an honest empty
 * page. The thing that disappears when there is nothing on is the nav item,
 * not this page.
 */
export default function ChallengesEmpty({ nextWalkRideDay }: { nextWalkRideDay?: string | null }) {
  return (
    <div className="max-w-[620px] py-6">
      <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
        Nothing is running right now.{' '}
        {nextWalkRideDay
          ? `The next Walk/Ride Day is ${weekdayDateET(nextWalkRideDay)}.`
          : 'Walk/Ride Day comes back the last Friday of every month.'}{' '}
        New challenges are announced here first.
      </p>
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px]">
        <TrackedLink
          href="/newsletter"
          placement="challenges_empty"
          className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
        >
          Get the newsletter
        </TrackedLink>
        <TrackedLink
          href="/events"
          placement="challenges_empty"
          className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
        >
          Browse community events
        </TrackedLink>
      </div>
    </div>
  )
}
