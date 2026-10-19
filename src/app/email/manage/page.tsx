import type { Metadata } from 'next'
import { Suspense } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ManageEmails from './ManageEmails'

/*
 * "Manage your emails" (Shift product item 19: one email subscription
 * system). Opened from the link in any Shift email that can be turned off;
 * the link's signed id is the only key, so it works without logging in.
 */
export const metadata: Metadata = {
  title: 'Manage your emails – Green Streets Initiative',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Nav variant="light" />
      <main className="min-h-screen bg-cream pt-[60px]">
        <div className="mx-auto max-w-[640px] px-6 pb-20 pt-12 md:pt-16 lg:px-8">
          <Suspense fallback={null}>
            <ManageEmails />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
