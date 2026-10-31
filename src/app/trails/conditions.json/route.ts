import { getTrails } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import { getPathConditions } from '@/lib/trails/conditions'

export const revalidate = 600

const SITE_URL = 'https://www.gogreenstreets.org'

/**
 * Path conditions as open data (Keith 2026-10-31: "as public as possible on
 * the web"), for towns, the state, advocates and other apps. GeoJSON, one
 * feature per trail (who clears it, snow near it), per stretch reported in
 * the last day, and per closed stretch. No personal data: reports carry the
 * trail's own line and the time, never who sent them.
 */
export async function GET() {
  const [trails, network, conditions] = await Promise.all([getTrails(), getNetworkLines(), getPathConditions()])
  const lines = new Map(network.map((n) => [n.id, n.lines]))
  const features: unknown[] = []
  for (const t of trails) {
    const c = conditions.get(t.id)
    features.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: lines.get(t.id) ?? [] },
      properties: {
        kind: 'trail',
        trail_id: t.id,
        name: t.name,
        url: `${SITE_URL}/trails/${t.id}`,
        cleared_in_winter: c?.winter?.cleared ?? null,
        clearing_note: c?.winter?.note ?? null,
        clearing_source: c?.winter?.source ?? null,
        snow_72h_cm: c?.weather?.snow_72h_cm ?? null,
        snow_depth_cm: c?.weather?.snow_depth_cm ?? null,
        freezing_rain_72h: c?.weather?.freezing_72h ?? null,
        last_snow_at: c?.weather?.last_snow_at ?? null,
        weather_checked_at: c?.weather?.checked_at ?? null,
        partly_closed: t.closed,
      },
    })
    for (const r of c?.reports ?? []) {
      features.push({
        type: 'Feature',
        geometry: { type: 'MultiLineString', coordinates: r.line ?? [] },
        properties: { kind: 'report', trail_id: t.id, condition: r.condition, observed_at: r.rode_at, from: r.from_label, to: r.to_label },
      })
    }
    for (const l of t.closed_lines) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: { kind: 'closure', trail_id: t.id, url: `${SITE_URL}/trails/${t.id}` } })
    }
  }
  return Response.json(
    {
      type: 'FeatureCollection',
      generated_at: new Date().toISOString(),
      publisher: 'Green Streets Initiative',
      about: `${SITE_URL}/trails/conditions`,
      license: 'Conditions: CC BY 4.0, credit Green Streets Initiative. Trail lines: © OpenStreetMap contributors, ODbL. Snow: Open-Meteo, CC BY 4.0.',
      conditions: { clear: 'Clear', snowy: 'Some snow or slush', icy: 'Icy', not_cleared: 'Not cleared' },
      features,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*' } },
  )
}
