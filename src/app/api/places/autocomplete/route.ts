import { NextRequest } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY!

export async function POST(req: NextRequest) {
  const { input, types } = (await req.json()) as { input?: string; types?: string[] }

  if (!input || input.trim().length < 3) {
    return Response.json({ predictions: [] })
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['us'],
      includedPrimaryTypes: types ?? ['street_address', 'premise', 'subpremise', 'establishment'],
      locationBias: {
        circle: {
          center: { latitude: 42.3736, longitude: -71.1097 },
          radius: 30000,
        },
      },
    }),
  })

  if (!res.ok) {
    console.error('Places autocomplete error:', res.status, await res.text().catch(() => ''))
    return Response.json({ predictions: [] }, { status: 502 })
  }

  const data = await res.json()
  const predictions = (data.suggestions || [])
    .filter((s: { placePrediction?: unknown }) => s.placePrediction)
    .slice(0, 5)
    .map((s: { placePrediction: { placeId: string; text: { text: string } } }) => ({
      placeId: s.placePrediction.placeId,
      text: s.placePrediction.text.text,
    }))

  return Response.json({ predictions })
}
