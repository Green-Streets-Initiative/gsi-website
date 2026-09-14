import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { ShiftHomeMockup } from '@/components/shift-mockup'
import { Checkpoint, Eyebrow, LANE, RouteSegment } from './RouteLine'

export default function HomeHero({ iosUrl, androidUrl }: { iosUrl: string; androidUrl: string }) {
  return (
    <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid items-start gap-10 pt-14 md:pt-20 lg:grid-cols-[7fr_5fr] lg:gap-6 lg:pt-24">
          {/* Copy */}
          <div className="relative pb-10 lg:pb-24">
            <Checkpoint className="absolute -left-[50px] top-[0.15rem]" />
            <Eyebrow>A Massachusetts nonprofit since 2006</Eyebrow>
            <h1 className="font-serif text-[clamp(2.75rem,7vw,5rem)] font-normal leading-[1.0] tracking-[-0.01em] text-navy">
              Every trip counts.
              <br />
              <em className="text-green-deep">Now it adds up.</em>
            </h1>
            <p className="mt-7 max-w-[520px] text-[1.125rem] leading-[1.6] text-ink-soft">
              Shift notices when you walk, bike, or take the T, and turns those trips into status, streaks, and
              perks from local businesses &mdash; for you and for your town.
            </p>
            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="hero" tone="light" className="mt-9" />
            <p className="mt-4 text-[13px] text-ink-soft">
              Free &middot; iOS and Android &middot; Built in Cambridge, MA &middot;{' '}
              <TrackedLink href="/shift" placement="hero" audience="individual" className="font-semibold text-forest underline-offset-4 hover:underline">
                What Shift does &rarr;
              </TrackedLink>
            </p>
          </div>

          {/* Phone: sits into the ledger rule below on desktop; a cropped glimpse on mobile. */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative max-h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)] md:max-h-[560px] lg:max-h-[660px] lg:[mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
              <ShiftHomeMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
