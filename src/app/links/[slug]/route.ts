import { NextResponse, type NextRequest } from 'next/server'
import { bioLinkRedirectUrl, findBioLink } from '@/content/bio-links'

// Short addresses for posts: gogreenstreets.org/links/<slug> sends people to
// that entry's url (even after it has left the page). Unknown slugs go to
// the links page. UTM rules live in bioLinkRedirectUrl.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const link = findBioLink(slug)
  const target = link ? bioLinkRedirectUrl(link, req.nextUrl.searchParams) : new URL('/links', req.nextUrl.origin).toString()
  return NextResponse.redirect(target, 302)
}
