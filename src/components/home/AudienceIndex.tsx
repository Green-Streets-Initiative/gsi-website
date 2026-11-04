import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import type { Audience } from './tracking'
import { LANE, RouteSegment } from './RouteLine'

// `until` hides a dated row by itself once its campaign ends (ISO date, last
// day shown). Shift Your Semester takes sign-ups through Dec 15, 2026.
const ALL_ROWS: { label: string; body: string; href: string; audience: Audience; until?: string }[] = [
  { label: 'For you', body: 'Plan a trip, find a group ride or walk, or try a new way.', href: '/nearby?plan=1', audience: 'individual' },
  { label: 'For students', body: 'Shift Your Semester: try ten trips a new way this fall.', href: '/shift-your-semester', audience: 'individual', until: '2026-12-15' },
  { label: 'For employers', body: 'Run a workplace challenge with real participation data.', href: '/shift/employers', audience: 'employer' },
  { label: 'For schools', body: 'Bring walking and biking programs to your school.', href: '/shift/schools', audience: 'school' },
  { label: 'For towns and planners', body: 'See how your community moves, neighborhood by neighborhood.', href: '/shift/towns', audience: 'town' },
  { label: 'For local businesses', body: 'Welcome new customers who arrive on foot, by bike or by transit.', href: '/shift/rewards-partners', audience: 'business' },
  { label: 'For partners and sponsors', body: 'Back a flagship event or a season of Walk/Ride Days.', href: '/contact', audience: 'partner' },
  { label: 'For donors', body: 'Fund the app, the data, and the next twenty years. Tax-deductible.', href: '/donate', audience: 'donor' },
]

export default function AudienceIndex() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const ROWS = ALL_ROWS.filter((r) => !r.until || today <= r.until)
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid gap-8 py-10 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:py-12">
          <div className="relative lg:sticky lg:top-24 lg:self-start">
            {/* No eyebrow: the heading already says what the section is. */}
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-navy">
              Which one <em className="text-green-deep">are you?</em>
            </h2>
            <p className="mt-5 max-w-[380px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              People get the app, the events calendar and the guides. Employers, schools, towns and local
              businesses get a program. Sponsors and donors keep it all going.
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
