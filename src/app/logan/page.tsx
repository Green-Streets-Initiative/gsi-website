import type { Metadata } from 'next'
import TogetherFrame from '@/components/together/TogetherFrame'
import { siteLocale } from '@/lib/site-locale'
import { translator } from '@/lib/site-i18n'
import { loganStrings } from '@/lib/site-strings/logan'
import LoganTrips from './LoganTrips'

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = translator(loganStrings, await siteLocale((await searchParams).lang))
  return {
    title: t('logan.meta_title'),
    description: t('logan.meta_description'),
    // Not listed until Keith launches it (built 2026-10-30, for Thanksgiving).
    robots: { index: false, follow: false },
  }
}

/**
 * gogreenstreets.org/logan in the page's language: ?lang= (the app sends it),
 * else the browser's. Shift Together's frame and sign-in, open to anyone
 * signed in (Shift 01518); the trips themselves are LoganTrips.
 */
export default async function Page({ searchParams }: Props) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <TogetherFrame locale={locale} variant="logan">
      <LoganTrips />
    </TogetherFrame>
  )
}
