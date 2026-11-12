import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import OfferAnswer from './OfferAnswer'

/**
 * An instructor's Yes / Can't for one free lesson request (Shift 01750),
 * reached only from the ask email. Never indexed.
 */
export const metadata: Metadata = {
  title: 'A free lesson request',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ params, searchParams }: Props) {
  const { token } = await params
  const a = (await searchParams).a
  const from = a === 'yes' || a === 'no' ? a : null
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream px-4 pb-16" style={{ paddingTop: '84px' }}>
        <div className="mx-auto w-full max-w-[520px]">
          <OfferAnswer token={token} from={from} />
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
