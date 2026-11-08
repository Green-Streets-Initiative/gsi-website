import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import HomeHero from '@/components/home/HomeHero'
import ImpactLedger from '@/components/home/ImpactLedger'
import ShiftProductBlock from '@/components/home/ShiftProductBlock'
import AudienceIndex from '@/components/home/AudienceIndex'
import MissionBlock from '@/components/home/MissionBlock'
import ClosingCta from '@/components/home/ClosingCta'
import { SITE_URL } from '@/lib/seo'
import { siteLocale } from '@/lib/site-locale'
import { translator } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'

/**
 * The home page on the cream editorial system: the org's own voice first,
 * the Shift product as one navy block inside it. Impact numbers come from
 * the app and refresh hourly (ImpactLedger caches them).
 *
 * In the visitor's language (?lang=, then the browser's language), with the
 * footer's language links, so someone who arrives here sees the site speaks
 * Spanish, Portuguese and Chinese (Keith 2026-11-08).
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>

// The canonical stays the plain URL so the homepage never gets folded into another URL.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await siteLocale((await searchParams).lang)
  const alternates = { canonical: SITE_URL }
  if (locale === 'en') return { alternates }
  const t = translator(homeStrings, locale)
  return { title: t('home.meta_title'), description: t('home.meta_description'), alternates }
}

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream">
        <HomeHero iosUrl={IOS_URL} androidUrl={ANDROID_URL} locale={locale} />
        <ImpactLedger locale={locale} />
        <ShiftProductBlock iosUrl={IOS_URL} androidUrl={ANDROID_URL} locale={locale} />
        <AudienceIndex locale={locale} />
        <MissionBlock locale={locale} />
        <ClosingCta iosUrl={IOS_URL} androidUrl={ANDROID_URL} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
