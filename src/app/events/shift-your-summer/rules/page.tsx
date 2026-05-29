import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Shift Your Summer · Official Rules | Green Streets Initiative',
  description:
    'Official rules for the Shift Your Summer active transportation challenge.',
}

export default function ShiftYourSummerRulesPage() {
  return (
    <>
      <Nav />
      <main className="bg-[#191A2E] text-white" style={{ paddingTop: '60px' }}>
        <section className="px-8 py-20 md:py-28">
          <div className="mx-auto max-w-[600px] text-center">
            <Link
              href="/events/shift-your-summer"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
            >
              &larr; Back to Shift Your Summer
            </Link>

            <h1 className="mb-6 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Official Rules
            </h1>

            <p className="mb-4 text-[1.0625rem] leading-[1.65] text-white/85">
              The official rules for Shift Your Summer 2026 will be published here before the challenge begins on June 15.
            </p>

            <p className="mb-10 text-sm leading-[1.6] text-white/75">
              Shift Your Summer is an 8-week active transportation challenge running June 15 &ndash; August 15, 2026. Check back soon for complete eligibility requirements, entry mechanics, and prize details.
            </p>

            <Link
              href="/events/shift-your-summer"
              className="inline-flex items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Learn about Shift Your Summer
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
