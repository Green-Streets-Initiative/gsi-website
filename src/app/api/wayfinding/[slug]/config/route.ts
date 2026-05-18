import { NextRequest, NextResponse } from 'next/server'
import { fetchEventConfig, fetchBusinesses } from '@/lib/wayfinding/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const event = await fetchEventConfig(slug)

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const businesses = await fetchBusinesses(event.id)

  return NextResponse.json(
    { event, businesses },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
