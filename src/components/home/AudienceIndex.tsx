import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import type { Audience } from './tracking'
import { Checkpoint, Eyebrow, LANE, RouteSegment } from './RouteLine'

const ROWS: { label: string; body: string; href: string; audience: Audience }[] = [
  { label: 'For employers', body: 'Run a workplace challenge with real participation data.', href: '/shift/employers', audience: 'employer' },
  { label: 'For schools', body: 'Bring walking and biking programs to your district, K–12 through campus.', href: '/shift/schools', audience: 'school' },
  { label: 'For towns and planners', body: 'See how your community moves, neighborhood by neighborhood.', href: '/shift/towns', audience: 'town' },
  { label: 'For local businesses', body: 'Offer a perk to the people already walking past your door.', href: '/shift/rewards-partners', audience: 'business' },
  { label: 'For partners and sponsors', body: 'Back a flagship event or a season of Walk/Ride Days.', href: '/contact', audience: 'partner' },
  { label: 'For donors', body: 'Fund the app, the data, and the next twenty years. Tax-deductible.', href: '/donate', audience: 'donor' },
]

export default function AudienceIndex() {
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid gap-10 py-20 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:py-28">
          <div className="relative lg:sticky lg:top-24 lg:self-start">
            <Checkpoint className="absolute -left-[50px] top-[0.15rem]" />
            <Eyebrow>Who it&rsquo;s for</Eyebrow>
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-navy">
              Made for the <em className="text-green-deep">whole</em> street.
            </h2>
            <p className="mt-5 max-w-[380px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              One app for the person on the sidewalk, and programs for the places that shape where they can go.
            </p>
          </div>

          <ul className="border-t border-navy/15">
            {ROWS.map((r) => (
              <li key={r.href} className="border-b border-navy/15">
                <TrackedLink
                  href={r.href}
                  placement="audience_index"
                  audience={r.audience}
                  className="group grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:grid-cols-[220px_1fr_auto]"
                >
                  <span className="font-serif text-[1.5rem] leading-none text-navy">{r.label}</span>
                  <span className="col-span-2 text-[15px] leading-relaxed text-ink-soft md:col-span-1">{r.body}</span>
                  <ArrowRight
                    size={20}
                    className="col-start-2 row-start-1 text-forest transition-transform group-hover:translate-x-1 md:col-start-3"
                  />
                </TrackedLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
