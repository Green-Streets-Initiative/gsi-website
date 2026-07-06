import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PassCard from './PassCard'

export const metadata: Metadata = {
  title: 'Your prize — Green Streets Initiative',
  description: 'Claim your Shift competition prize, or pass it on to the next person.',
  // Prize links are personal, single-use, and token-gated — keep them out of search.
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function PrizePassPage({ searchParams }: Props) {
  const { token } = await searchParams

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <section className="bg-[#191A2E] px-8 py-24 md:py-28">
          <div className="mx-auto max-w-[560px]">
            <PassCard token={token ?? null} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
