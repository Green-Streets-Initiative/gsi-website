import Link from 'next/link'
import Script from 'next/script'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import DonatePageEvent from './DonatePageEvent'

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
    title: 'Verified trips. Real decisions.',
    body: 'Every trip on Shift is real behavioral data — verified, tied to a route, with the mode (walk, bike, transit, drive) auto-detected. Donations fund the infrastructure behind that data, so employers, cities, and partners can plan active transportation investments with evidence.',
  },
  {
    title: 'We\u2019re just getting started.',
    body: 'Shift is built to scale across Massachusetts — and eventually beyond. Every donation funds the platform, the programs, and the communities we haven\u2019t reached yet.',
  },
]

export default function DonatePage() {
  return (
    <>
      <Nav variant="light" />
      <DonatePageEvent />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>

        {/* Donorbox widget script — loaded once per page */}
        <Script
          src="https://donorbox.org/widgets.js"
          strategy="lazyOnload"
          type="module"
        />

        {/* ══════════════════════════════════════════════════════════
            1 · HERO
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
              Donate
            </div>
            <h1 className="mb-6 max-w-[720px] font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Help make shift happen.
            </h1>
            <p className="max-w-[600px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Green Streets Initiative is a 501(c)(3) nonprofit. Your donation funds the platform,
              the programs, and the people working to make active transportation the obvious
              choice across Massachusetts.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2 · IMPACT CARDS
        ══════════════════════════════════════════════════════════ */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-6 md:grid-cols-3">
              {impactCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[14px] border border-navy/10 bg-cream p-8"
                >
                  <h2 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">
                    {card.title}
                  </h2>
                  <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
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
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[680px]">
            <h2 className="mb-8 text-center font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Make a gift
            </h2>
            <div className="rounded-[14px] border border-navy/10 bg-white p-4 sm:p-8 md:p-10">
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
        <section className="bg-cream px-6 pb-8 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[600px] space-y-3 text-center">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Green Streets Initiative is a registered 501(c)(3) nonprofit organization.
              All donations are tax-deductible to the extent permitted by law.
              EIN: 26-1484405
            </p>
            <p className="text-[13px] text-ink-soft">
              Questions about giving? Contact us at{' '}
              <a
                href="mailto:info@gogreenstreets.org"
                className="font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                info@gogreenstreets.org
              </a>
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5 · OTHER WAYS TO HELP
        ══════════════════════════════════════════════════════════ */}
        <section className="border-t border-navy/10 bg-white px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 text-center font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Not ready to donate? There are other ways to help.
            </h2>
            <div className="mx-auto grid max-w-[720px] gap-6 sm:grid-cols-2">
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h3 className="mb-2 font-serif text-[1.375rem] leading-tight text-navy">
                  Volunteer
                </h3>
                <p className="mb-5 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Join our growing volunteer team.
                </p>
                <Link
                  href="/get-involved"
                  className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                >
                  See volunteer roles &rarr;
                </Link>
              </div>
              <div className="rounded-[14px] border border-navy/10 bg-cream p-8">
                <h3 className="mb-2 font-serif text-[1.375rem] leading-tight text-navy">
                  Spread the word
                </h3>
                <p className="mb-5 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  Share the Shift app with someone whose commute could be better.
                </p>
                <Link
                  href="/shift"
                  className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                >
                  Learn about Shift &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer variant="light" />
    </>
  )
}
