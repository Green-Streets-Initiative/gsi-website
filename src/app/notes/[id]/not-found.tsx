import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { notesT } from '@/lib/route-notes'

// A note that faded, that two people said is gone, or that two people
// reported. OpenStreetMap notes keep linking here, so say so plainly and
// offer the way on.
export default function NoteGone() {
  const t = notesT('en')
  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-16 pt-10 lg:px-8">
          <div className="mx-auto max-w-[680px] rounded-[16px] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
            <h1 className="font-serif text-[clamp(1.75rem,4vw,2.5rem)] font-normal leading-[1.1] text-navy">{t('notes.gone')}</h1>
            <p className="mt-3 text-[1rem] leading-relaxed text-ink-soft">
              Notes fade when people say they&apos;re no longer true, or after enough time with nobody saying they still are.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/commute-advisor"
                className="inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-[0.9375rem] font-semibold text-white hover:bg-[#1F4D3A]"
              >
                Plan a calm bike route
              </Link>
              <Link
                href="/nearby"
                className="inline-flex min-h-[44px] items-center rounded-full border border-navy/20 px-5 text-[0.9375rem] font-semibold text-navy hover:border-forest"
              >
                See what&apos;s near you
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
