import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { PHOTOS } from '@/components/together/photos'
import { translator } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { togetherStartStrings } from '@/lib/site-strings/together-start'
import Start from './Start'

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = translator(togetherStartStrings, await siteLocale((await searchParams).lang))
  const image = { url: PHOTOS.gilman.src, width: PHOTOS.gilman.width, height: PHOTOS.gilman.height, alt: t('photo_alt') }
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: 'https://www.gogreenstreets.org/together/start' },
    openGraph: {
      title: t('title'),
      description: t('meta.description'),
      url: 'https://www.gogreenstreets.org/together/start',
      siteName: 'Green Streets Initiative',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('meta.description'), images: [image.url] },
  }
}

/**
 * gogreenstreets.org/together/start: the page the beginners' ads and the
 * employer and city newsletters link to (Keith 2026-11-19). Its own frame:
 * the form shows before sign-in, which /together's shell doesn't allow.
 */
export default async function Page({ searchParams }: Props) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <Start locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
