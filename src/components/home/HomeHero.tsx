import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { ShiftHomeMockup } from '@/components/shift-mockup'
import { Eyebrow, LANE, RouteSegment } from './RouteLine'

export default function HomeHero({ iosUrl, androidUrl }: { iosUrl: string; androidUrl: string }) {
  return (
    <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid items-start gap-8 pt-12 md:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-6">
          {/* Copy */}
          <div className="relative pb-8 lg:pb-10">
            <Eyebrow>A Massachusetts nonprofit since 2006</Eyebrow>
            <h1 className="font-serif text-[clamp(2.75rem,7vw,5rem)] font-normal leading-[1.0] tracking-[-0.01em] text-navy">
              Every trip counts.
              <br />
              <em className="text-green-deep">Now it adds up.</em>
            </h1>
            <p className="mt-7 max-w-[520px] text-[1.125rem] leading-[1.6] text-ink-soft">
              Walk it, bike it, take the bus. Shift counts the trip for you, and it adds up &mdash; money saved,
              a streak worth keeping, and perks from businesses down the street.
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="hero" tone="light" className="mt-9 [&>a]:max-[420px]:basis-full" />
            <p className="mt-4 text-[13px] text-ink-soft">
              Free &middot; iOS and Android &middot; Built in Somerville, MA &middot;{' '}
              <TrackedLink href="/shift" placement="hero" audience="individual" className="font-semibold text-forest underline-offset-4 hover:underline">
                What Shift does &rarr;
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
              <ShiftHomeMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
