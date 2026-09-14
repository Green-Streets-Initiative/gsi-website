import { Broadcast, Compass, Trophy } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import StoreButtons from '@/components/StoreButtons'
import TrackedLink from '@/components/TrackedLink'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
import { AroundYouCard, StatusBar, UpNextCard } from '@/components/shift-mockup'
import { LANE, RouteSegment } from './RouteLine'

const STOPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: Broadcast,
    title: 'See what\u2019s moving near you',
    body: 'The next train, the nearest bus, how many Bluebikes are at the dock, and whether you\u2019ll make it.',
  },
  {
    icon: Compass,
    title: 'Nothing to log',
    body: 'Shift records the trip on its own and only asks you when it can\u2019t tell walking from the bus.',
  },
  {
    icon: Trophy,
    title: 'Every trip is worth something',
    body: 'Money back in your pocket, a streak worth keeping, and perks from businesses down the street.',
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
            <div className="mb-5">
              <ShiftWordmark tone="white" height={26} />
            </div>
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-white">
              The better trip, <em className="text-teal">made easy.</em>
            </h2>
            <p className="mt-6 max-w-[540px] text-[1.0625rem] leading-[1.65] text-white">
              Shift shows you what&rsquo;s moving near you right now, counts the trip without you touching anything,
              and turns it into money saved and perks worth having.
            </p>

            <ol className="mt-9 flex flex-col gap-6">
              {STOPS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal/50 text-teal">
                    <s.icon size={20} weight="regular" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{s.title}</p>
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
