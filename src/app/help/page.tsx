import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'
import JsonLd from '@/components/JsonLd'
import { faqPageSchema } from '@/lib/structured-data'
import HtmlLang from '@/components/HtmlLang'
import { faqSectionsFor } from '@/lib/help/faq'
import { siteLocale } from '@/lib/site-locale'
import { translator } from '@/lib/site-i18n'
import { helpStrings } from '@/lib/site-strings/help'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// The app's Help & FAQ row opens this page with ?lang=; otherwise the browser's language decides.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const t = translator(helpStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('help.meta_title'),
    description: t('help.meta_description'),
  }
}

/* ------------------------------------------------------------------ */
/*  Quick-link card data                                               */
/* ------------------------------------------------------------------ */

// Each card lists sections by id; a link reads its section's title.
const quickLinks = [
  {
    label: 'help.card_app_users',
    sections: ['getting-started', 'trip-tracking', 'getting-around', 'points-rewards', 'badges-streaks-tiers', 'roams', 'competitions', 'privacy-data', 'account-settings'],
  },
  { label: 'help.card_partners', sections: ['for-rewards-partners'] },
  { label: 'help.card_schools', sections: ['for-schools'] },
] as const

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function HelpPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(helpStrings, locale)
  const faqSections = faqSectionsFor(locale)
  const titleOf = (id: string) => faqSections.find((s) => s.id === id)?.title ?? id
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
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <JsonLd data={faqPageSchema(faqSchemaItems)} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* ---- Hero ---- */}
        <section className="bg-cream px-6 pb-8 pt-12 md:pt-16 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1120px] text-center">
            <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {t('help.title')}
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('help.intro')}
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
                  {t(card.label)}
                </h2>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {card.sections.map((id) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
                      >
                        {titleOf(id)}
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
              {t('help.still_title')}
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('help.still_body')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:info@gogreenstreets.org"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('help.general_support')}
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
      <Footer variant="light" locale={locale} />
    </>
  )
}
