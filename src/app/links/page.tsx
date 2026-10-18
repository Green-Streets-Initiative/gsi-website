import type { Metadata } from 'next'
import Link from 'next/link'
import { currentDatedLinks, pinnedLinks } from '@/content/bio-links'
import LinkButton from './LinkButton'

// Re-render at most every five minutes so dated links drop off on time
// without a redeploy.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Links | Green Streets Initiative',
  description:
    'This week from Green Streets Initiative: rides, walks and events to try, plus the Shift app, our events calendar and newsletter.',
  alternates: { canonical: '/links' },
  robots: { index: true, follow: true },
}

export default function LinksPage() {
  const week = currentDatedLinks()
  const always = pinnedLinks()

  return (
    <main className="street min-h-screen bg-cream px-4 pb-14 pt-6 text-navy sm:pt-12">
      <div className="mx-auto w-full max-w-[560px]">
        {/* Green street-sign header, like the social cards */}
        <header className="rounded-2xl bg-forest px-6 pb-6 pt-5 text-white shadow-md ring-2 ring-white ring-inset">
          <h1 className="font-headline text-[30px] font-extrabold leading-[1.05] tracking-[-0.01em] sm:text-[34px]">
            Green Streets Initiative
          </h1>
          <p className="mt-2 text-[16px] leading-snug text-white/90">
            Helping people across Massachusetts walk, bike, and take transit more often.
          </p>
        </header>

        {week.length > 0 ? (
          <section aria-labelledby="links-week" className="mt-8">
            <h2 id="links-week" className="mb-3 font-headline text-[20px] font-extrabold text-green-deep">
              This week
            </h2>
            <ul className="flex flex-col gap-3">
              {week.map((l) => (
                <li key={l.slug}>
                  <LinkButton link={l} section="week" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="links-always" className="mt-8">
          <h2 id="links-always" className="mb-3 font-headline text-[20px] font-extrabold text-green-deep">
            Always here
          </h2>
          <ul className="flex flex-col gap-3">
            {always.map((l) => (
              <li key={l.slug}>
                <LinkButton link={l} section="always" />
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-[15px] text-ink-muted">
          <Link href="/" className="font-bold text-forest underline underline-offset-4 hover:text-green-deep">
            gogreenstreets.org
          </Link>
        </p>
      </div>
    </main>
  )
}
