import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { ShiftHomeMockup } from '@/components/shift-mockup'
import { Eyebrow, LANE, RouteSegment } from './RouteLine'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'

export default function HomeHero({ iosUrl, androidUrl, locale = 'en' }: { iosUrl: string; androidUrl: string; locale?: SiteLocale }) {
  const t = translator(homeStrings, locale)
  return (
    <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid items-start gap-8 pt-12 md:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-6">
          {/* Copy */}
          <div className="relative pb-8 lg:pb-10">
            <Eyebrow>{t('home.hero_eyebrow')}</Eyebrow>
            <h1 className="font-serif text-[clamp(2.75rem,7vw,5rem)] font-normal leading-[1.0] tracking-[-0.01em] text-navy">
              {t('home.hero_title_1')}
              <br />
              <em className="text-green-deep">{t('home.hero_title_2')}</em>
            </h1>
            <p className="mt-7 max-w-[520px] text-[1.125rem] leading-[1.6] text-ink-soft">
              {t('home.hero_lede')}
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="hero" tone="light" className="mt-9 [&>a]:max-[420px]:basis-full" />
            <p className="mt-4 text-[13px] text-ink-soft">
              {t('home.hero_facts')}{' '}
              <TrackedLink href={withLang('/shift', locale)} placement="hero" audience="individual" className="font-semibold text-forest underline-offset-4 hover:underline">
                {t('home.hero_link')}
              </TrackedLink>
            </p>
          </div>

          {/* Phone, cropped to the live "around you" card: the hero shows what is
              moving near you; the product block below shows what the trips add up
              to. Between them the screen appears once, not twice. */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative max-h-[235px] overflow-hidden md:max-h-[295px] lg:max-h-[320px]
                 [mask-image:linear-gradient(to_bottom,black_calc(100%-36px),transparent)]
                 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-14px),transparent)]">
              <ShiftHomeMockup locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
