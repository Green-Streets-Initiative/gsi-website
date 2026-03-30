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
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Press
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Press &amp; media
            </h1>
            <p className="mb-10 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              For press inquiries, interview requests, or media assets, please reach out
              directly. We&apos;ll get back to you within one business day.
            </p>
            <a
              href="mailto:info@gogreenstreets.org"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              info@gogreenstreets.org
            </a>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · QUICK REFERENCE
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                  About GSI
                </h2>
                <p className="text-[0.9375rem] leading-[1.6] text-white/80">
                  Green Streets Initiative is a Cambridge-based 501(c)(3) nonprofit helping
                  commuters across Massachusetts shift trips to active transportation. Founded
                  in 2006.
                </p>
              </div>

              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                  About Shift
                </h2>
                <p className="text-[0.9375rem] leading-[1.6] text-white/80">
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
      <Footer />
    </>
  )
}
