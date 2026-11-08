import { Broadcast, Compass, Trophy } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
import { RecentTripsCard, StatusBar } from '@/components/shift-mockup'
import { LANE, RouteSegment } from './RouteLine'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'

const STOPS = [
  { icon: Broadcast, title: 'home.stop1_title', body: 'home.stop1_body' },
  { icon: Compass, title: 'home.live_stop2_title', body: 'home.live_stop2_body' },
  { icon: Trophy, title: 'home.live_stop3_title', body: 'home.live_stop3_body' },
] as const satisfies readonly { icon: Icon; title: string; body: string }[]

export default function ShiftProductBlock({ iosUrl, androidUrl, locale = 'en' }: { iosUrl: string; androidUrl: string; locale?: SiteLocale }) {
  const t = translator(homeStrings, locale)
  return (
    <section className="relative overflow-x-clip bg-navy text-white">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderRight" tone="dark" />
        <div className="hidden md:block" />
        <div className="grid items-center gap-10 py-10 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:py-12">
          {/* The lower half of the home screen at native scale, no phone shell:
              status and streak, then the trips it counted. The hero already
              shows the live "around you" card, so it is not repeated here. */}
          <div className="order-2 flex w-full max-w-[402px] flex-col gap-3 justify-self-center font-display lg:order-1 lg:justify-self-start">
            <StatusBar locale={locale} />
            <RecentTripsCard locale={locale} />
          </div>

          <div className="relative order-1 lg:order-2">
            <div className="mb-5">
              <ShiftWordmark tone="white" height={26} />
            </div>
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-white">
              {t('home.live_product_title_a')}{locale === 'zh-Hans' ? '' : ' '}<em className="text-teal">{t('home.live_product_title_b')}</em>
            </h2>
            <p className="mt-6 max-w-[540px] text-[1.0625rem] leading-[1.65] text-white">
              {t('home.live_product_body')}
            </p>

            <ol className="mt-8 flex flex-col gap-5">
              {STOPS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal/50 text-teal">
                    <s.icon size={20} weight="regular" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{t(s.title)}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-white/80">{t(s.body)}</p>
                  </div>
                </li>
              ))}
            </ol>

            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="product" className="mt-8" />
            <p className="mt-4 text-[14px] text-white">
              <TrackedLink href={withLang('/shift', locale)} placement="product" audience="individual" className="font-semibold text-teal underline-offset-4 hover:underline">
                {t('home.product_link')}
              </TrackedLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
