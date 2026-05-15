import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY!

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('placeId')
  const fields = req.nextUrl.searchParams.get('fields') || 'location,formattedAddress'

  if (!placeId) {
    return Response.json({ error: 'placeId required' }, { status: 400 })
  }

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fields,
      },
    }
  )

  if (!res.ok) {
    console.error('Places details error:', res.status, await res.text().catch(() => ''))
    return Response.json({ error: 'place_details_failed' }, { status: 502 })
  }

  const data = await res.json()
  return Response.json(data)
}
