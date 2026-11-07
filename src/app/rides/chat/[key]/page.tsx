import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ChatDoor from '@/components/rides/ChatDoor'

/**
 * A person's own link to a ride's group chat (Shift 01686). Reached from the
 * app, their RSVP reply and their ride emails; never indexed, never shared.
 */
export const metadata: Metadata = {
  title: 'Ride group chat',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <ChatDoor chatKey={key} />
      </main>
      <Footer variant="light" />
    </>
  )
}
