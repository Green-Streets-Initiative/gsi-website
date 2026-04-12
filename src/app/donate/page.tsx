import Link from 'next/link'
import Script from 'next/script'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Donate — Green Streets Initiative',
  description:
    'Support Green Streets Initiative. Your donation funds the Shift platform, community programs, and active transportation across Massachusetts.',
}

const impactCards = [
  {
    title: 'The app is free.',
    body: 'Shift is free to download and use. Every active commuter who joins, every school that runs the program, every neighborhood that climbs the leaderboard — none of it costs them anything. Donations make that possible.',
  },
  {
    title: 'We measure what others assume.',
    body: 'Most transportation initiatives run on estimated impact. GSI verifies it — trip by trip, neighborhood by neighborhood. Donors fund infrastructure that produces real data for real decisions.',
  },
  {
    title: 'We\u2019re just getting started.',
    body: 'Shift is built to scale across Massachusetts — and eventually beyond. Every donation funds the platform, the programs, and the communities we haven\u2019t reached yet.',
  },
]

export default function DonatePage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>

        {/* Donorbox widget script — loaded once per page */}
        <Script
          src="https://donorbox.org/widgets.js"
          strategy="lazyOnload"
          type="module"
        />

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Donate
            </div>
            <h1 className="mb-6 max-w-[720px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Help make shift happen.
            </h1>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-white">
              Green Streets Initiative is a 501(c)(3) nonprofit. Your donation funds the platform,
              the programs, and the people working to make active transportation the obvious
              choice across Massachusetts.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · IMPACT CARDS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-6 md:grid-cols-3">
              {impactCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8"
                >
                  <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-white">
                    {card.title}
                  </h2>
                  <p className="text-[0.9375rem] leading-[1.6] text-white/80">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3 · DONATION FORM (Donorbox)
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-6 py-24 sm:px-8">
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-8 text-center font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Make a gift
            </h2>
            <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-black/40 sm:p-8 md:p-10">
              <dbox-widget
                campaign="main-green-streets-donation-form"
                type="donation_form"
                enable-auto-scroll="true"
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4 · TAX & LEGAL
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-[#191A2E] px-8 pb-16">
          <div className="mx-auto max-w-[600px] space-y-3 text-center">
            <p className="text-xs leading-relaxed text-white/40">
              Green Streets Initiative is a registered 501(c)(3) nonprofit organization.
              All donations are tax-deductible to the extent permitted by law.
              EIN: 26-1484405
            </p>
            <p className="text-xs text-white/40">
              Questions about giving? Contact us at{' '}
              <a
                href="mailto:info@gogreenstreets.org"
                className="text-white/60 underline transition-colors hover:text-white"
              >
                info@gogreenstreets.org
              </a>
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · OTHER WAYS TO HELP
        ══════════════════════════════════════════════════════════ */}
        <section className="border-t border-white/[0.07] bg-[#242538] px-8 py-24">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-10 text-center font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Not ready to donate? There are other ways to help.
            </h2>
            <div className="mx-auto grid max-w-[720px] gap-6 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-white">
                  Volunteer
                </h3>
                <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/80">
                  Join our growing volunteer team.
                </p>
                <Link
                  href="/get-involved"
                  className="text-sm font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
                >
                  See volunteer roles &rarr;
                </Link>
              </div>
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-8">
                <h3 className="mb-2 font-display text-lg font-bold tracking-tight text-white">
                  Spread the word
                </h3>
                <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/80">
                  Share the Shift app with someone whose commute could be better.
                </p>
                <Link
                  href="/shift"
                  className="text-sm font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
                >
                  Learn about Shift &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
