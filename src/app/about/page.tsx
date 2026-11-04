import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import ImpactLedger from '@/components/home/ImpactLedger'
import { ArrowLink, PILL, Section, SectionHeading } from '@/components/org/Section'

/*
 * About, short (2026-11-04). It replaced the Spring 2026 strategy deck, which
 * still sold the summer and September campaigns and described an older Shift.
 * One job: who GSI is and what it offers, with the live numbers and the
 * vision PDF one link away.
 */

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'About Green Streets Initiative',
  description:
    'Green Streets Initiative is a Somerville nonprofit that has helped people try walking, biking and transit since 2006: Walk/Ride Day, the events calendar, town pages, guides and the Shift app.',
}

const TOOLS: { name: string; body: string; href: string }[] = [
  { name: 'Walk/Ride Day', body: 'One Friday a month. Every walk, bike ride or transit trip enters a drawing.', href: '/programs/walk-ride-days' },
  { name: 'Events calendar', body: 'Group rides, walks, classes and open streets across Massachusetts.', href: '/events' },
  { name: 'Commute Advisor', body: 'Compare walking, biking and transit for the trips you make.', href: '/commute-advisor' },
  { name: 'Town pages', body: 'How each town gets around, what is on, and a short digest.', href: '/shift/towns' },
  { name: 'Guides', body: 'Plain answers to the things that hold people back.', href: '/guides' },
  { name: 'Shift', body: 'Find better ways to get around. Get rewarded when you try them.', href: '/shift' },
]

const WORK_WITH: { name: string; href: string }[] = [
  { name: 'Employers', href: '/shift/employers' },
  { name: 'Schools', href: '/shift/schools' },
  { name: 'Towns and planners', href: '/shift/towns' },
  { name: 'Ride and walk organizers', href: '/organizer-kit' },
  { name: 'Sponsors and partners', href: '/contact' },
]

export default function AboutPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        <PageHero
          eyebrow="Green Streets Initiative · since 2006"
          title={
            <>
              We help people try <em className="text-green-deep">a better trip.</em>
            </>
          }
          lede="We're a Somerville nonprofit. We make it easier to walk, bike or take transit for one more trip, and we count what it adds up to, town by town."
        >
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/get-involved" className={PILL}>
              Get involved
            </Link>
            <ArrowLink href="/donate">Donate</ArrowLink>
          </div>
        </PageHero>

        <ImpactLedger />

        <Section tone="white" shape="wanderRight">
          <SectionHeading title="What we offer" lede="Free, for anyone in Massachusetts." />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="group flex h-full flex-col gap-2 rounded-2xl border border-navy/10 bg-cream p-5 transition-colors hover:border-forest/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  <span className="flex items-center justify-between gap-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {t.name}
                    <ArrowRight size={20} className="shrink-0 text-forest transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="text-[15px] leading-relaxed text-ink-soft">{t.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section shape="wanderLeft" width="read">
          <SectionHeading title="Our story" />
          <div className="flex max-w-[680px] flex-col gap-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
            <p>
              Janie Katz-Christy founded Green Streets Initiative in 2006 with a monthly Walk/Ride Day in
              Cambridge. Twenty years on, Walk/Ride Day runs statewide, and the same idea runs through
              everything we do: make the better trip the easy one, then show people what it added up to.
            </p>
            <p>
              Today GSI is led by Keith Anderson, Executive Director, from 519 Somerville Ave in Somerville.
            </p>
          </div>
          <div className="mt-6">
            <ArrowLink href="/GSI_Strategic_Vision_2026.pdf" external>
              Read our 2026 strategic vision (PDF)
            </ArrowLink>
          </div>
        </Section>

        <Section tone="white" shape="terminal" closing>
          <SectionHeading title="Work with us" lede="Programs for workplaces, schools, towns and groups." />
          <ul className="flex flex-wrap gap-3">
            {WORK_WITH.map((w) => (
              <li key={w.href}>
                <Link
                  href={w.href}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-navy/20 bg-white px-5 text-[15px] font-semibold text-navy transition-colors hover:border-forest/50"
                >
                  {w.name} <ArrowRight size={16} className="text-forest" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
