import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { LANE, RouteSegment } from './RouteLine'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'

export default function ClosingCta({ iosUrl, androidUrl, locale = 'en' }: { iosUrl: string; androidUrl: string; locale?: SiteLocale }) {
  const t = translator(homeStrings, locale)
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="terminal" />
        <div className="hidden md:block" />
        <div className="relative pb-20 pt-10 lg:pb-24 lg:pt-12">
          <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-normal leading-[1.0] text-navy">
            {t('home.closing_title_a')}{locale === 'zh-Hans' ? '' : ' '}<em className="text-green-deep">{t('home.closing_title_b')}</em>
          </h2>
          <p className="mt-6 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {t('home.live_closing_body')}
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="closing" tone="light" className="mt-9" />

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-navy/15 pt-8 text-[15px]">
            <li>
              <TrackedLink href={withLang('/donate', locale)} placement="closing" audience="donor" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                {t('home.closing_donate')}
              </TrackedLink>
            </li>
            <li>
              <TrackedLink href={withLang('/get-involved', locale)} placement="closing" audience="volunteer" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                {t('home.closing_volunteer')}
              </TrackedLink>
            </li>
            <li>
              <TrackedLink href={withLang('/contact', locale)} placement="closing" audience="partner" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                {t('home.closing_partner')}
              </TrackedLink>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
