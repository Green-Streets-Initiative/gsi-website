import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import EnterFlow from './EnterFlow'
import { fetchChallenge, withPreview } from '../_lib/api'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Enter | Green Streets Initiative', robots: { index: false, follow: true } }

type Params = Promise<{ slug: string }>
type Search = Promise<{ preview?: string | string[] }>

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const raw = (await searchParams).preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) notFound()
  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="min-h-[70vh] bg-cream">
        <div className="mx-auto w-full max-w-[640px] px-6 pt-[76px]">
          <Link href={withPreview(`/challenges/${slug}`, preview)} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
            &larr; {data.challenge.title}
          </Link>
        </div>
        <EnterFlow c={data.challenge} preview={preview} />
      </main>
      <Footer variant="light" street />
    </div>
  )
}
