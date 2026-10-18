import { NextResponse, type NextRequest } from 'next/server'
import { findBioLink } from '@/content/bio-links'

// Short addresses for posts: gogreenstreets.org/links/<slug> sends people to
// that entry's url (even after it has left the page). Unknown slugs go to
// the links page.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const link = findBioLink(slug)
  const target = link ? link.url : new URL('/links', req.nextUrl.origin).toString()
  return NextResponse.redirect(target, 302)
}
