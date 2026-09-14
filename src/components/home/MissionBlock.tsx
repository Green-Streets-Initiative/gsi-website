import { ArrowRight, CalendarCheck, GraduationCap, Microphone } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import TrackedLink from '@/components/TrackedLink'
import type { Audience } from './tracking'
import { Eyebrow, LANE, RouteSegment } from './RouteLine'

const PROGRAMS: { icon: Icon; label: string; href: string; audience: Audience }[] = [
  { icon: CalendarCheck, label: 'Walk/Ride Days', href: '/programs/walk-ride-days', audience: 'general' },
  { icon: Microphone, label: 'What Moves Us', href: '/programs/what-moves-us', audience: 'general' },
  { icon: GraduationCap, label: 'Shift for Schools', href: '/shift/schools', audience: 'school' },
]

export default function MissionBlock() {
  return (
    <section className="relative overflow-x-clip bg-white">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderRight" />
        <div className="hidden md:block" />
        <div className="relative max-w-[860px] py-20 lg:py-28">
          <Eyebrow>Green Streets Initiative</Eyebrow>
          <h2 className="font-serif text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.2] text-navy">
            We help people <em className="text-green-deep">shift trips</em>{' '}
            to healthier, more affordable, more fun
            ways of getting around &mdash; and we measure the impact, <em className="text-green-deep">trip by trip</em>,
            community by community.
          </h2>
          <p className="mt-8 max-w-[620px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            We started in 2006 with a monthly Walk/Ride Day in Cambridge. Twenty years on, the same idea runs
            through everything we do: make the better trip the easy one, then show people what it added up to.
          </p>

          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {PROGRAMS.map((p) => (
              <li key={p.href}>
                <TrackedLink
                  href={p.href}
                  placement="mission"
                  audience={p.audience}
                  className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-navy underline-offset-4 hover:underline"
                >
                  <p.icon size={20} className="text-forest" />
                  {p.label}
                </TrackedLink>
              </li>
            ))}
            <li>
              <TrackedLink
                href="/about"
                placement="mission"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline"
              >
                Our story <ArrowRight size={18} />
              </TrackedLink>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
