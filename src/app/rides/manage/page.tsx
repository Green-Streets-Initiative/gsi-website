import type { Metadata } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ManageRides from '@/components/rides/ManageRides'

/**
 * A web guest's private page, reached only from the link in their ride
 * emails (?t=<token>). Change an answer, leave a ride, stop ride emails, or
 * remove the address. Never indexed.
 */
export const metadata: Metadata = {
  title: 'Your rides',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <Suspense>
          <ManageRides />
        </Suspense>
      </main>
      <Footer variant="light" />
    </>
  )
}
