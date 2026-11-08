import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EntryShare from './EntryShare'
import { fetchEntry } from '../../_lib/api'
import HtmlLang from '@/components/HtmlLang'
import { translator } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { creativeStrings } from '@/lib/site-strings/challenges'

/**
 * One entry's page, the link entrants send around ("vote for my ad"). Its
 * link preview carries the entry's still, which is a frame of a video the
 * entrant already posted publicly and our automatic check passed.
 */
export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string; id: string }>
type Search = Promise<{ preview?: string | string[]; lang?: string | string[] }>
const previewOf = (raw: string | string[] | undefined) => (typeof raw === 'string' ? raw.slice(0, 64) : '')

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { id } = await params
  const sp = await searchParams
  const preview = previewOf(sp.preview)
  const t = translator(creativeStrings, await siteLocale(sp.lang))
  const data = await fetchEntry(id, preview).catch(() => null)
  if (!data) return { title: t('meta.not_found'), robots: { index: false } }
  const { challenge: c, entry: e } = data
  const title = t('meta.entry_title', { title: e.title, credit: e.credit_name, challenge: c.title })
  const description = c.phase === 'voting' && e.finalist_rank
    ? t('meta.entry_finalist', { challenge: c.title })
    : t('meta.entry_entry', { challenge: c.title, tagline: c.tagline })
  const images = e.thumbnail_url ? [{ url: e.thumbnail_url }] : undefined
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, siteName: 'Green Streets Initiative', type: 'video.other', url: e.share_url, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images: e.thumbnail_url ? [e.thumbnail_url] : undefined },
  }
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug, id } = await params
  const sp = await searchParams
  const preview = previewOf(sp.preview)
  const locale = await siteLocale(sp.lang)
  const data = await fetchEntry(id, preview).catch(() => null)
  if (!data || data.challenge.slug !== slug) notFound()
  return (
    <div className="street">
      <HtmlLang locale={locale} />
      <Nav variant="light" street locale={locale} />
      <main className="min-h-[70vh] bg-cream">
        <EntryShare initial={data} preview={preview} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </div>
  )
}
