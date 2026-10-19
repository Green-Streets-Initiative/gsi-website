import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ConfirmLink from './ConfirmLink'

/*
 * Where the confirm and stop links in Shift emails land (Shift product item
 * 19). One button does what the link is for, so a mail scanner opening the
 * link changes nothing.
 */
export const metadata: Metadata = {
  title: 'Your emails – Green Streets Initiative',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Nav variant="light" />
      <main className="min-h-screen bg-cream pt-[60px]">
        <div className="mx-auto max-w-[640px] px-6 pb-20 pt-12 md:pt-16 lg:px-8">
          <ConfirmLink />
        </div>
      </main>
      <Footer />
    </>
  )
}
