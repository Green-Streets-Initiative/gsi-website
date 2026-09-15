import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Press — Green Streets Initiative',
  description:
    'Press inquiries, media assets, and quick-reference information about Green Streets Initiative and Shift.',
}

export default function PressPage() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Press
            </div>
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Press &amp; media
            </h1>
            <p className="mb-8 max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              For press inquiries, interview requests, or media assets, please reach out
              directly. We&apos;ll get back to you within one business day.
            </p>
            <a
              href="mailto:info@gogreenstreets.org"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              info@gogreenstreets.org
            </a>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · QUICK REFERENCE
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  About GSI
                </h2>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Green Streets Initiative is a Cambridge-based 501(c)(3) nonprofit helping
                  commuters across Massachusetts shift trips to active transportation. Founded
                  in 2006.
                </p>
              </div>

              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                  About Shift
                </h2>
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Shift is GSI&apos;s behavior change platform &mdash; a mobile app that
                  auto-detects active trips, tracks Shift Rate, and rewards commuters for
                  walking, biking, and riding transit.
                </p>
              </div>
            </div>

            {/* FUTURE: Press kit download button
                Add a download button here once the press kit PDF/ZIP is ready.
                Example: <a href="/press-kit.pdf" download>Download press kit</a>
            */}

            {/* FUTURE: Media coverage grid
                Add a grid of coverage items here, each with:
                publication name, headline, date, and link.
                Example layout: 2-column grid of cards with publication logo,
                headline text, date, and external link arrow.
            */}
          </div>
        </section>

      </main>
      <Footer variant="light" />
    </>
  )
}
