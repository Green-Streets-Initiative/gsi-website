import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PhotoAlbum from '@/app/events/[id]/photos/PhotoAlbum'
import { fetchAlbum, type AlbumRef } from '@/app/events/[id]/photos/photo-api'
import { looksLikeRideCode } from '@/lib/rides/public'

/**
 * Ride photos for one date of a Shift ride: the same album page as a
 * calendar event's (/events/<id>/photos), reached through the ride's own link
 * code, which is what opens an invite-only ride's album on the web, the way
 * it opens the ride's Going list. The album's Share link (in the app and
 * here) points at this page.
 *
 * The `event-photos` function answers 404 while the switch is off, unless
 * the visitor has the date's preview key, so this is a not-found to the
 * public until then. Kept out of search; the link preview stays generic.
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

type Search = Promise<{ preview?: string | string[]; add?: string | string[] }>

export default async function Page({ params, searchParams }: { params: Promise<{ code: string; date: string }>; searchParams: Search }) {
  const { code, date } = await params
  if (!looksLikeRideCode(code) || !(date === 'latest' || /^\d{4}-\d{2}-\d{2}$/.test(date))) notFound()
  const sp = await searchParams
  const raw = sp.preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''

  const ref: AlbumRef = { ride: code, date }
  const album = await fetchAlbum(ref, preview).catch(() => null)
  if (!album || album.album.state === 'none') notFound()

  const back = `/rides/${encodeURIComponent(code)}${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <PhotoAlbum initial={album} preview={preview} albumRef={{ ride: code, date: album.event.date }} back={{ href: back, label: 'Back to the ride' }} goingHref={`${back}#going`} autoAdd={sp.add === '1'} />
      </main>
      <Footer variant="light" />
    </>
  )
}
