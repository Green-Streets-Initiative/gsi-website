import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import EventsPage from '@/components/events/EventsPage'
import { TownChipsStrip } from '@/components/towns/TownsCrossLink'
import KindChips from '@/components/events/KindChips'
import { loadEventsListing } from './_lib/load'
import { buildEventsListingMetadata, type EventsSearchParams } from '@/lib/events-listing-seo'

/**
 * The calendar's filters live in the URL, so the link someone shares is rarely
 * the bare page — the title and the share card follow whatever is filtered.
 * See src/lib/events-listing-seo.ts.
 */
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<EventsSearchParams> },
) {
  const params = await searchParams
  return buildEventsListingMetadata(params, await siteLocale(params.lang))
}

export const dynamic = 'force-dynamic'

export default async function EventsListingPage({ searchParams }: { searchParams: Promise<EventsSearchParams> }) {
  // The app adds ?lang=; otherwise the browser's language (translation plan, batch 5).
  const [locale, events] = await Promise.all([
    searchParams.then((p) => siteLocale(p.lang)),
    // A Shift ride's cancelled dates stay on the list, shown as Cancelled.
    loadEventsListing({ withCancelled: true }),
  ])

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <Suspense fallback={null}>
          <EventsPage events={events} tone="light" locale={locale} />
        </Suspense>
        {/* The kind pages (/events/group-rides...) are English only so far. */}
        {locale === 'en' && (
          <section className="border-t border-navy/10 bg-cream px-6 py-8">
            <KindChips className="mx-auto max-w-[960px]" />
          </section>
        )}
        <TownChipsStrip tone="light" locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
