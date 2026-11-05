import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ChallengePage from './_components/ChallengePage'
import { fetchChallenge } from './_lib/api'

/**
 * A creative challenge (Commercial Break first): the brief, the prizes, the
 * gallery of entries, then the finalists' vote and the winners as the dates
 * pass. Everything comes from the `creative-challenges` function, which
 * answers not-found to anyone without the challenge's preview key while the
 * `creative_challenges` switch is off, so the page is the site's not-found to
 * the public until launch.
 */
export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type Search = Promise<{ preview?: string | string[] }>

const previewOf = (raw: string | string[] | undefined) => (typeof raw === 'string' ? raw.slice(0, 64) : '')

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { slug } = await params
  const preview = previewOf((await searchParams).preview)
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) return { title: 'Not found', robots: { index: false } }
  const c = data.challenge
  const title = `${c.title}: ${c.total_prizes} creative challenge | Green Streets Initiative`
  return {
    title,
    description: c.tagline,
    robots: preview ? { index: false, follow: false } : undefined,
    alternates: { canonical: `/challenges/${c.slug}` },
    openGraph: { title: c.title, description: c.tagline, siteName: 'Green Streets Initiative', type: 'website', url: c.share_url },
    twitter: { card: 'summary_large_image', title: c.title, description: c.tagline },
  }
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const preview = previewOf((await searchParams).preview)
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) notFound()
  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="bg-cream">
        <ChallengePage initial={data} preview={preview} />
      </main>
      <Footer variant="light" street />
    </div>
  )
}
