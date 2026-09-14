import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { Checkpoint, InlineDot, LANE, RouteSegment } from './RouteLine'

export default function ClosingCta({ iosUrl, androidUrl }: { iosUrl: string; androidUrl: string }) {
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="terminal" />
        <div className="hidden md:block" />
        <div className="relative py-20 lg:py-28">
          <Checkpoint terminal className="absolute -left-[50px] top-[0.15rem]" />
          <p className="mb-4 font-serif text-[1.125rem] italic text-green-deep">
            <InlineDot />
            You are here.
          </p>
          <h2 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-normal leading-[1.0] text-navy">
            Start with <em className="text-green-deep">one trip.</em>
          </h2>
          <p className="mt-6 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Download Shift, take the walk you were going to take anyway, and watch it count.
          </p>
          <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="closing" tone="light" className="mt-9" />

          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-navy/15 pt-8 text-[15px]">
            <li>
              <TrackedLink href="/donate" placement="closing" audience="donor" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                Donate
              </TrackedLink>
            </li>
            <li>
              <TrackedLink href="/get-involved" placement="closing" audience="volunteer" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                Volunteer
              </TrackedLink>
            </li>
            <li>
              <TrackedLink href="/contact" placement="closing" audience="partner" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                Partner with us
              </TrackedLink>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
