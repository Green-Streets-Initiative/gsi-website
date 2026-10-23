/**
 * A ride's share card: what shows when its link is pasted into a group chat
 * or a post. Rides with their own flyer use the flyer (page metadata names
 * it); this card is for the rest, and it wears the organizer's brand, not
 * GSI's (Keith 2026-10-23: an organizer would never post a card in someone
 * else's colors). Their logo and colors (lib/organizers/brand.ts, read from
 * the logo) on one side, the route on real streets in their color on the
 * other, the way Strava shares a club ride. No logo: the organizer's name
 * set as type on white. No route: the logo takes the map's place.
 *
 * Nothing here may throw: an image route that fails shows no card at all.
 */
import { ImageResponse } from 'next/og'
import { neutralFonts } from '@/lib/og-fonts'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { organizerBrand } from '@/lib/organizers/brand'
import { PACE_OPTIONS } from '@/lib/organizers/ride-words'
import { routeMiles } from '@/lib/organizers/route-geo'
import { rideExtras } from '@/lib/rides/host'
import { looksLikeRideCode, nextWhen, type RideLookup } from '@/lib/rides/public'
import { routeMapImage } from '@/lib/server/route-map-image'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'A group ride: when, where and the route'

const MAP_W = 620
const PLAIN = { bg: '#FFFFFF', ink: '#191A2E', accent: '#2966E5' }

function titleSize(title: string, wide: boolean): number {
  const n = title.length / (wide ? 1.6 : 1)
  if (n <= 22) return 66
  if (n <= 40) return 56
  if (n <= 64) return 46
  return 40
}

function trim(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export default async function OGImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const fonts = await neutralFonts()
  let ride: RideLookup | null = null
  try {
    if (looksLikeRideCode(code)) ride = (await createServerSupabaseClient().rpc('get_ride_public', { p_code: code })).data as RideLookup | null
  } catch {
    ride = null
  }
  const web = ride && ride.web ? ride : null
  const extras = web ? await rideExtras(web.id).catch(() => null) : null
  const host = extras?.host ?? null
  const brand = await organizerBrand(host?.logo_url)
  const colors = brand ?? PLAIN
  const route = (web?.route_waypoints ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  const map = route.length >= 2 ? await routeMapImage({ points: route, width: MAP_W, height: size.height, color: colors.accent }) : null

  const hostName = host?.name ?? web?.organizer_name ?? null
  const title = trim((ride?.name ?? 'A group ride').trim(), 90)
  const when = web ? nextWhen(web) : ''
  const miles = route.length >= 2 ? routeMiles(route) : null
  const pace = PACE_OPTIONS.find((p) => p.key === web?.pace)
  const stats = [
    miles ? { label: 'Distance', value: `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` } : null,
    pace ? { label: 'Pace', value: pace.label } : null,
    web?.no_drop ? { label: 'Group', value: 'No-drop' } : null,
  ].filter(Boolean) as { label: string; value: string }[]
  const wide = !map
  const logoBox = wide ? { w: 380, h: 300 } : { w: 360, h: 150 }
  const logoScale = brand ? Math.min(logoBox.w / brand.logoWidth, logoBox.h / brand.logoHeight, 1) : 0

  const logo = brand ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} width={Math.round(brand.logoWidth * logoScale)} height={Math.round(brand.logoHeight * logoScale)} alt="" />
  ) : hostName ? (
    <span style={{ color: colors.ink, fontSize: 30, fontWeight: 800 }}>{trim(hostName, 34)}</span>
  ) : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: colors.bg, fontFamily: 'Inter' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 56px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!wide && logo && <div style={{ display: 'flex', marginBottom: 30 }}>{logo}</div>}
            <span style={{ color: colors.ink, fontSize: titleSize(title, wide), fontWeight: 800, lineHeight: 1.06, letterSpacing: -1 }}>{title}</span>
            {when && <span style={{ color: colors.ink, fontSize: 30, fontWeight: 700, marginTop: 22 }}>{trim(when, wide ? 48 : 34)}</span>}
            {web?.meetup_name && <span style={{ color: colors.ink, fontSize: 28, fontWeight: 500, marginTop: when ? 6 : 22 }}>{trim(`Meet at ${web.meetup_name}`, wide ? 48 : 34)}</span>}
          </div>
          {stats.length > 0 && (
            <div style={{ display: 'flex' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', paddingLeft: i ? 26 : 0, marginLeft: i ? 26 : 0, borderLeft: i ? `2px solid ${colors.ink}33` : 'none' }}>
                  <span style={{ color: colors.ink, fontSize: 20, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ color: colors.ink, fontSize: 32, fontWeight: 800 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {map ? (
          <div style={{ display: 'flex', position: 'relative', width: MAP_W, height: size.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={map.src} width={MAP_W} height={size.height} alt="" />
            <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 13, color: '#4A4D68', backgroundColor: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4 }}>{map.credit}</span>
          </div>
        ) : logo ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 460, paddingRight: 56 }}>{logo}</div>
        ) : null}
      </div>
    ),
    { ...size, fonts },
  )
}
