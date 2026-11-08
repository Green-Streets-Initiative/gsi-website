import type { Metadata } from 'next'
import HtmlLang from '@/components/HtmlLang'
import PublicAdvisorPage from './PublicAdvisorPage'
import { siteLocale } from '@/lib/site-locale'
import { translator } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const OG_IMAGE = '/og/commute-advisor.png'
const OG_LOCALE = { es: 'es_US', 'pt-BR': 'pt_BR', 'zh-Hans': 'zh_CN' } as const

// English keeps the layout's metadata as it is (it ranks; see layout.tsx).
// Other languages get the same title and description in their words.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await siteLocale((await searchParams).lang)
  if (locale === 'en') return {}
  const t = translator(advisorStrings, locale)
  const title = t('page.meta_title')
  const description = t('page.meta_description')
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://www.gogreenstreets.org/commute-advisor',
      siteName: 'Green Streets Initiative',
      locale: OG_LOCALE[locale],
      type: 'website',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: t('page.og_alt') }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  }
}

export default async function CommuteAdvisorPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <>
      <HtmlLang locale={locale} />
      <PublicAdvisorPage locale={locale} />
    </>
  )
}
