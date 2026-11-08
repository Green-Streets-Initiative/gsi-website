import TrackedLink from '@/components/TrackedLink'
import { weekdayDateET } from '@/lib/campaigns/format'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { hubStrings } from '@/lib/site-strings/challenges'

/**
 * Shown when nothing is running, coming up, or freshly wrapped.
 *
 * The page still returns 200. /challenges will end up in the sitemap and on
 * printed material, so a 404 on a promoted URL is worse than an honest empty
 * page. The thing that disappears when there is nothing on is the nav item,
 * not this page.
 */
export default function ChallengesEmpty({ nextWalkRideDay, locale = 'en' }: { nextWalkRideDay?: string | null; locale?: SiteLocale }) {
  const t = translator(hubStrings, locale)
  return (
    <div className="max-w-[620px] py-6">
      <p className="text-[1.0625rem] leading-[1.65] text-ink-soft">
        {nextWalkRideDay
          ? t('empty.body_next', { date: weekdayDateET(nextWalkRideDay, locale) })
          : t('empty.body_monthly')}
      </p>
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px]">
        <TrackedLink
          href="/newsletter"
          placement="challenges_empty"
          className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
        >
          {t('empty.newsletter')}
        </TrackedLink>
        <TrackedLink
          href={withLang('/events', locale)}
          placement="challenges_empty"
          className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
        >
          {t('empty.events')}
        </TrackedLink>
      </div>
    </div>
  )
}
