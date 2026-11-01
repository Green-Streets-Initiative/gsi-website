import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PhotoAlbum from './PhotoAlbum'
import { fetchAlbum } from './photo-api'

/**
 * Ride photos (Shift design 2026-10-31, screen 6): the shared album for one
 * event, the link people pass around the group chat. Opens without the app;
 * adding takes an email and a six-digit code the first time.
 *
 * Everything comes from the `event-photos` function, which answers 404 to
 * anyone without the event's preview key while the switch is off, so this
 * page is a not-found to the public until then. Kept out of search, out of
 * the sitemap and linked from nowhere. The link preview is deliberately
 * generic: no photo goes into the page's metadata or a social card.
 */
export const dynamic = 'force-dynamic'

const TITLE = 'Ride photos'
const DESCRIPTION = 'Photos and videos from the ride, shared by the people who were there.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'Green Streets Initiative', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
}

type Search = Promise<{ preview?: string | string[] }>

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params
  const raw = (await searchParams).preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''

  let eventId = id
  try { eventId = decodeURIComponent(id) } catch { /* use as given */ }

  const album = await fetchAlbum(eventId, preview)
  // No album for this event (or not for this visitor): the site's usual not-found.
  if (!album || album.album.state === 'none') notFound()

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <PhotoAlbum initial={album} preview={preview} />
      </main>
      <Footer variant="light" />
    </>
  )
}
