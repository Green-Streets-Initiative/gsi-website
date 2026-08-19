import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ShipList from './ShipList'

export const metadata: Metadata = {
  title: 'Prize fulfillment — Green Streets Initiative',
  description: "Your donated prizes' winners and their shipping details.",
  // Donor links are personal and token-gated — keep them out of search.
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function PrizeShipPage({ searchParams }: Props) {
  const { token } = await searchParams

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        <section className="bg-[#191A2E] px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-[720px]">
            <ShipList token={token ?? null} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
