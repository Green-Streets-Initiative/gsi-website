import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import JsonLd from '@/components/JsonLd'
import { faqPageSchema } from '@/lib/structured-data'
import { faqSections } from '@/lib/help/faq'

export const metadata = {
  title: 'Help — Green Streets Initiative',
  description:
    'Everything you need to know about using Shift, unlocking rewards, running a schools challenge, or joining as a partner.',
}

/* ------------------------------------------------------------------ */
/*  Quick-link card data                                               */
/* ------------------------------------------------------------------ */

const quickLinks = [
  {
    label: 'App Users',
    sections: [
      { name: 'Getting Started', anchor: '#getting-started' },
      { name: 'Tracking Your Trips', anchor: '#trip-tracking' },
      { name: 'Getting Around', anchor: '#getting-around' },
      { name: 'XP & Rewards', anchor: '#points-rewards' },
      { name: 'Badges, Streaks & Tiers', anchor: '#badges-streaks-tiers' },
      { name: 'Roams', anchor: '#roams' },
      { name: 'Drawings & Challenges', anchor: '#competitions' },
      { name: 'Privacy & Data', anchor: '#privacy-data' },
      { name: 'Account & Settings', anchor: '#account-settings' },
    ],
  },
  {
    label: 'Rewards Partners',
    sections: [
      { name: 'For Rewards Partners', anchor: '#for-rewards-partners' },
    ],
  },
  {
    label: 'Schools',
    sections: [{ name: 'For Schools', anchor: '#for-schools' }],
  },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HelpPage() {
  // FAQPage structured data. Only string answers are included so the markup
  // matches the visible text verbatim; ~16 answers are JSX (they embed links)
  // and are intentionally omitted. TODO: convert those to plain-text-first
  // authoring so every Q&A can be represented.
  const faqSchemaItems = faqSections
    .flatMap((s) => s.items)
    .filter((it) => typeof it.answer === 'string')
    .map((it) => ({ question: it.question, answer: it.answer as string }))

  return (
    <>
      <Nav variant="light" />
      <JsonLd data={faqPageSchema(faqSchemaItems)} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* ---- Hero ---- */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px] text-center">
            <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              How can we help?
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              Everything you need to know about using Shift, unlocking rewards,
              running a schools challenge, or joining as a partner.
            </p>
          </div>
        </section>

        {/* ---- Quick Links ---- */}
        <section className="bg-cream px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-3">
            {quickLinks.map((card) => (
              <div
                key={card.label}
                className="rounded-[14px] border border-navy/10 bg-white p-6"
              >
                <h2 className="font-serif text-[1.375rem] leading-tight text-navy">
                  {card.label}
                </h2>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {card.sections.map((s) => (
                    <li key={s.anchor}>
                      <a
                        href={s.anchor}
                        className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---- FAQ Sections ---- */}
        <section className="bg-white px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[1120px]">
            {faqSections.map((section, i) => (
              <div
                key={section.id}
                id={section.id}
                className={i > 0 ? 'mt-16 scroll-mt-24' : 'scroll-mt-24'}
              >
                <h2 className="mb-2 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
                  {section.title}
                </h2>
                <FAQ items={section.items} theme="light" />
              </div>
            ))}
          </div>
        </section>

        {/* ---- Contact ---- */}
        <section className="bg-cream px-6 pb-20 pt-8 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="mx-auto max-w-[1120px] text-center">
            <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
              Still need help?
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              We&rsquo;re a small team and we read every message. Reach out and
              we&rsquo;ll get back to you as quickly as we can.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:info@gogreenstreets.org"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                General Support
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="ml-2"
                >
                  <path
                    d="M1 7h12M8 2l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
