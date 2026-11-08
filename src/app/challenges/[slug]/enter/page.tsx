import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EnterFlow from './EnterFlow'
import { fetchChallenge, withPreview } from '../_lib/api'
import HtmlLang from '@/components/HtmlLang'
import { translator, withLang } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { creativeStrings } from '@/lib/site-strings/challenges'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type Search = Promise<{ preview?: string | string[]; lang?: string | string[] }>

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const t = translator(creativeStrings, await siteLocale((await searchParams).lang))
  return { title: t('meta.enter'), robots: { index: false, follow: true } }
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const sp = await searchParams
  const raw = sp.preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''
  const locale = await siteLocale(sp.lang)
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) notFound()
  return (
    <div className="street">
      <HtmlLang locale={locale} />
      <Nav variant="light" street locale={locale} />
      <main className="min-h-[70vh] bg-cream">
        <div className="mx-auto w-full max-w-[640px] px-6 pt-[76px]">
          <Link href={withLang(withPreview(`/challenges/${slug}`, preview), locale)} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
            &larr; {data.challenge.title}
          </Link>
        </div>
        <EnterFlow c={data.challenge} preview={preview} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </div>
  )
}
