import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import TeachHours from './TeachHours'

/**
 * An instructor's own page for their usual teaching times (Shift 01750),
 * from the link in every ask email. No login: the link is the key. Never
 * indexed.
 */
export const metadata: Metadata = {
  title: 'Your teaching times',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream px-4 pb-16" style={{ paddingTop: '84px' }}>
        <div className="mx-auto w-full max-w-[520px]">
          <TeachHours token={token} />
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
