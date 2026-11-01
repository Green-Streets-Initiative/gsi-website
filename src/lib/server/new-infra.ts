import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTownDirectory, townSlug } from '@/lib/towns/queries'
import { NO_NEW_INFRA, newInfraKey, type ComingItem, type NewInfra, type NewInfraFor } from '@/lib/new-infra'

/**
 * New this season from the database (Shift 01577): on a route, near a place,
 * or in a town. Each coming item gets a link to its town page's Get involved
 * list, where the hearing's details and ways to weigh in already live.
 * A failed lookup is "nothing new", never an error on the page around it.
 */

type LatLng = { lat: number; lng: number }

async function withTownLinks(n: NewInfra): Promise<NewInfra> {
  if (n.coming.length === 0) return n
  const towns = await getTownDirectory().catch(() => [])
  const bySlug = new Map(towns.map((t) => [t.town_name.toLowerCase(), townSlug(t.town_name, t.state)]))
  const coming: ComingItem[] = n.coming.map((c) => {
    const slug = c.town ? bySlug.get(c.town.toLowerCase()) : undefined
    return { ...c, href: slug ? `/shift/towns/${slug}#involved` : null }
  })
  return { ...n, coming }
}

async function call(fn: string, args: Record<string, unknown>): Promise<NewInfra> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc(fn, args)
    if (error || !data) {
      if (error) console.error(`${fn} error:`, error.message)
      return NO_NEW_INFRA
    }
    const d = data as Partial<NewInfra>
    return withTownLinks({ opened: d.opened ?? [], coming: d.coming ?? [] })
  } catch (e) {
    console.error(`${fn} threw:`, e)
    return NO_NEW_INFRA
  }
}

export function newInfraOnRoute(line: LatLng[]): Promise<NewInfra> {
  const points = line.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)).map((p) => ({ lat: p.lat, lng: p.lng }))
  return points.length >= 2 ? call('get_new_bike_infra_on_route', { p_points: points }) : Promise.resolve(NO_NEW_INFRA)
}

export function newInfraNear(at: LatLng, radiusMi = 1): Promise<NewInfra> {
  return call('get_new_bike_infra_near', { p_lat: at.lat, p_lng: at.lng, p_radius_mi: radiusMi })
}

export function newInfraInTown(town: string, state = 'MA'): Promise<NewInfra> {
  return call('get_new_bike_infra_in_town', { p_town: town, p_state: state })
}

/**
 * For a ride page: the answer for each distinct route its dates can show, or
 * for the half mile around the meeting spot of a date with no route. The page
 * picks the one for the date on show (newInfraKey) without another request.
 */
export async function newInfraForPlaces(places: { line: LatLng[]; start: LatLng | null }[]): Promise<NewInfraFor[]> {
  const todo = new Map<string, () => Promise<NewInfra>>()
  for (const p of places) {
    const key = newInfraKey(p.line, p.start)
    if (!key || todo.has(key)) continue
    todo.set(key, p.line.length >= 2 ? () => newInfraOnRoute(p.line) : () => newInfraNear(p.start!, 0.5))
    if (todo.size >= 6) break
  }
  return Promise.all([...todo].map(async ([key, run]) => ({ key, info: await run() })))
}
