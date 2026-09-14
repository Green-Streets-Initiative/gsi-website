import { Broadcast, Compass, Trophy } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import { AroundYouCard, Chevrons, StatusBar, UpNextCard } from '@/components/shift-mockup'
import { Checkpoint, Eyebrow, LANE, RouteSegment } from './RouteLine'

const STOPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: Compass,
    title: 'It notices your trips',
    body: 'No logging. Shift detects walks, rides, and transit trips on its own and asks only when it is unsure.',
  },
  {
    icon: Broadcast,
    title: 'It shows what’s around you, live',
    body: 'The next train, the nearest bus, how many Bluebikes are at the dock, and whether you’ll make it.',
  },
  {
    icon: Trophy,
    title: 'It turns trips into status, streaks, and local perks',
    body: 'Climb from Starter to Trailblazer, keep a streak going, and unlock rewards from businesses near you.',
  },
]

export default function ShiftProductBlock({ iosUrl, androidUrl }: { iosUrl: string; androidUrl: string }) {
  return (
    <section className="relative overflow-x-clip bg-navy text-white">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderRight" tone="dark" />
        <div className="hidden md:block" />
        <div className="grid items-center gap-12 py-20 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:py-28">
          {/* Cards at native scale, no phone shell */}
          <div className="order-2 flex w-full max-w-[402px] flex-col gap-3 justify-self-center font-display lg:order-1 lg:justify-self-start">
            <AroundYouCard />
            <UpNextCard />
            <StatusBar />
          </div>

          <div className="relative order-1 lg:order-2">
            <Checkpoint tone="dark" className="absolute -left-[50px] top-[0.15rem]" />
            <Eyebrow tone="dark">
              <span className="inline-flex items-center gap-2 align-middle">
                The Shift app
                <span className="inline-flex items-center gap-[5px] font-display text-[15px] font-extrabold normal-case tracking-tight text-white">
                  Shift <Chevrons size={16} />
                </span>
              </span>
            </Eyebrow>
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-white">
              An app that notices how you <em className="text-teal">already</em> move.
            </h2>
            <p className="mt-6 max-w-[540px] text-[1.0625rem] leading-[1.65] text-white">
              No logging. Shift detects walks, rides, and transit trips on its own, then shows you the next train,
              the nearest bikes, and what your week added up to.
            </p>

            <ol className="mt-9 flex flex-col gap-6">
              {STOPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal/50 text-teal">
                    <s.icon size={20} weight="regular" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">
                      <span className="mr-2 font-serif text-teal">{i + 1}.</span>
                      {s.title}
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-white/80">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} placement="product" className="mt-10" />
            <p className="mt-4 text-[14px] text-white">
              <TrackedLink href="/shift" placement="product" audience="individual" className="font-semibold text-teal underline-offset-4 hover:underline">
                Everything Shift does &rarr;
              </TrackedLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
