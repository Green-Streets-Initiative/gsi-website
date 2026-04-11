import { createServerSupabaseClient } from '@/lib/supabase-server'

const GOOGLE_API_KEY = process.env.GOOGLE_ROUTES_API_KEY!
const CACHE_TTL_DAYS = 7

interface RouteRequest {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  modes: string[]
}

interface TransitStep {
  lineName: string
  lineShortName: string
  vehicleType: string  // BUS, SUBWAY, HEAVY_RAIL, COMMUTER_RAIL, etc
  numStops: number
  departureStop: string
  arrivalStop: string
}

interface RouteResult {
  durationMins: number
  distanceMiles: number
  transitSteps?: TransitStep[]  // only for TRANSIT mode
}

// Round to 4 decimal places (~11m precision) for cache normalization
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function parseDuration(duration: string): number {
  // Google returns duration as "1234s"
  const seconds = parseInt(duration.replace('s', ''), 10)
  return Math.round(seconds / 60)
}

function metersToMiles(meters: number): number {
  return Math.round(meters * 0.000621371 * 100) / 100
}

async function fetchGoogleRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: string,
): Promise<RouteResult | null> {
  const body: Record<string, unknown> = {
    origin: {
      location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
    },
    destination: {
      location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
    },
    travelMode: mode,
  }

  // Use 8:30 AM next weekday for all modes — shows rush hour conditions
  const now = new Date()
  const next = new Date(now)
  next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)) // next Monday
  next.setHours(8, 30, 0, 0)
  body.departureTime = next.toISOString()

  if (mode === 'DRIVE') {
    body.routingPreference = 'TRAFFIC_AWARE'
  }

  if (mode === 'TRANSIT') {
    // Prefer fewer transfers — direct bus is better than train+bus for short trips
    body.transitPreferences = {
      routingPreference: 'FEWER_TRANSFERS',
    }
    // Request alternative routes to pick the fastest
    body.computeAlternativeRoutes = true
  }

  try {
    // Request transit step details for TRANSIT mode
    const fieldMask = mode === 'TRANSIT'
      ? 'routes.duration,routes.distanceMeters,routes.legs.steps.transitDetails'
      : 'routes.duration,routes.distanceMeters'

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error(`Google Routes API error for ${mode}:`, res.status, await res.text())
      return null
    }

    const data = await res.json()
    const allRoutes = data.routes || []
    if (allRoutes.length === 0) return null

    // For transit with alternatives, pick the fastest route
    let bestRoute = allRoutes[0]
    if (mode === 'TRANSIT' && allRoutes.length > 1) {
      bestRoute = allRoutes.reduce((best: Record<string, unknown>, r: Record<string, unknown>) => {
        const bestDur = parseDuration((best.duration as string) || '99999s')
        const rDur = parseDuration((r.duration as string) || '99999s')
        return rDur < bestDur ? r : best
      }, allRoutes[0])
    }

    const route = bestRoute
    if (!route?.duration || !route?.distanceMeters) return null

    const result: RouteResult = {
      durationMins: parseDuration(route.duration as string),
      distanceMiles: metersToMiles(route.distanceMeters as number),
    }

    // Extract transit step details (line names, vehicle types)
    if (mode === 'TRANSIT') {
      const legs = (route as Record<string, unknown>).legs as Array<Record<string, unknown>> | undefined
      const steps = (legs?.[0]?.steps as Array<Record<string, unknown>>) || []
      const transitSteps: TransitStep[] = []
      for (const step of steps) {
        const td = step.transitDetails as Record<string, unknown> | undefined
        if (td) {
          const line = td.transitLine as Record<string, unknown> | undefined
          const vehicle = line?.vehicle as Record<string, unknown> | undefined
          const stopDetails = td.stopDetails as Record<string, unknown> | undefined
          const depStop = stopDetails?.departureStop as Record<string, unknown> | undefined
          const arrStop = stopDetails?.arrivalStop as Record<string, unknown> | undefined
          transitSteps.push({
            lineName: (line?.name || line?.nameShort || '') as string,
            lineShortName: (line?.nameShort || line?.name || '') as string,
            vehicleType: (vehicle?.type || 'UNKNOWN') as string,
            numStops: (td.stopCount || 0) as number,
            departureStop: (depStop?.name || '') as string,
            arrivalStop: (arrStop?.name || '') as string,
          })
        }
      }
      if (transitSteps.length > 0) {
        result.transitSteps = transitSteps
      }
    }

    return result
  } catch (err) {
    console.error(`Google Routes API fetch error for ${mode}:`, err)
    return null
  }
}

export async function POST(req: Request) {
  let body: RouteRequest
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { origin, destination, modes } = body

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return Response.json({ error: 'Missing origin or destination coordinates' }, { status: 400 })
  }

  const validModes = ['DRIVE', 'BICYCLE', 'WALK', 'TRANSIT']
  if (!modes?.length || !modes.every(m => validModes.includes(m))) {
    return Response.json({ error: 'Invalid modes' }, { status: 400 })
  }

  const oLat = round4(origin.lat)
  const oLng = round4(origin.lng)
  const dLat = round4(destination.lat)
  const dLng = round4(destination.lng)

  const supabase = createServerSupabaseClient()
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const routes: Record<string, RouteResult | null> = {}
  let anyCached = false
  const modesToFetch: string[] = []

  // Check cache for each mode
  const { data: cached } = await supabase
    .from('route_cache')
    .select('mode, duration_mins, distance_miles')
    .eq('origin_lat', oLat)
    .eq('origin_lng', oLng)
    .eq('dest_lat', dLat)
    .eq('dest_lng', dLng)
    .in('mode', modes)
    .gte('fetched_at', cutoff)

  const cacheMap = new Map<string, RouteResult>()
  if (cached) {
    for (const row of cached) {
      cacheMap.set(row.mode, {
        durationMins: row.duration_mins,
        distanceMiles: Number(row.distance_miles),
      })
    }
  }

  for (const mode of modes) {
    // Always fetch TRANSIT fresh — cache doesn't store transit step details
    if (mode === 'TRANSIT') {
      modesToFetch.push(mode)
    } else if (cacheMap.has(mode)) {
      routes[mode] = cacheMap.get(mode)!
      anyCached = true
    } else {
      modesToFetch.push(mode)
    }
  }

  // Fetch missing modes from Google in parallel
  if (modesToFetch.length > 0) {
    const results = await Promise.all(
      modesToFetch.map(mode =>
        fetchGoogleRoute({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }, mode)
      )
    )

    for (let i = 0; i < modesToFetch.length; i++) {
      const mode = modesToFetch[i]
      const result = results[i]
      routes[mode] = result

      // Cache successful results
      if (result) {
        await supabase
          .from('route_cache')
          .upsert({
            origin_lat: oLat,
            origin_lng: oLng,
            dest_lat: dLat,
            dest_lng: dLng,
            mode,
            duration_mins: result.durationMins,
            distance_miles: result.distanceMiles,
            fetched_at: new Date().toISOString(),
          }, {
            onConflict: 'origin_lat,origin_lng,dest_lat,dest_lng,mode',
          })
      }
    }
  }

  // If all modes returned null, return error
  if (Object.values(routes).every(r => r === null)) {
    return Response.json({ error: 'Routing unavailable' }, { status: 502 })
  }

  return Response.json({
    routes,
    cached: anyCached && modesToFetch.length === 0,
  })
}
