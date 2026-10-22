import type { Metadata } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FixListingForm from '@/components/hosts/FixListingForm'

export const metadata: Metadata = {
  title: 'Fix a listing',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <Suspense>
          <FixListingForm />
        </Suspense>
      </main>
      <Footer variant="light" />
    </>
  )
}
