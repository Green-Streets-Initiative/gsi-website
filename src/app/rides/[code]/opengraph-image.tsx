/**
 * Social card for a ride page: what shows when the ride link is pasted into
 * a group chat or a post. Rides with a flyer use the flyer (page metadata
 * names it); this card is for the rest. Cream system and layout from the
 * events page's card (app/events/[id]/opengraph-image.tsx), so a shared ride
 * reads like a shared event, with the route's shape where the event card
 * puts its photo.
 *
 * Nothing here may throw: an image route that fails shows no card at all.
 */
import { ImageResponse } from 'next/og'
import { bricolageFonts } from '@/lib/og-fonts'
import { CREAM, NAVY, FOREST, INK_SOFT } from '@/lib/semester/og-card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { routeMiles } from '@/lib/organizers/route-geo'
import { PACE_LABEL, looksLikeRideCode, nextWhen, type RideLookup } from '@/lib/rides/public'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'A group ride on Shift by Green Streets Initiative'

const ROUTE_BOX = 420
const ROUTE_BLUE = '#2966E5'

function titleFontSize(title: string, narrow: boolean): number {
  const n = title.length * (narrow ? 1.5 : 1)
  if (n <= 28) return 82
  if (n <= 48) return 68
  if (n <= 72) return 56
  return 46
}

function trim(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** The route as an SVG path inside a square box, north up, with a margin. */
function routePath(route: { lat: number; lng: number }[], box: number): { d: string; start: [number, number] } {
  const k = Math.cos((route.reduce((s, p) => s + p.lat, 0) / route.length) * Math.PI / 180)
  const xs = route.map((p) => p.lng * k)
  const ys = route.map((p) => -p.lat)
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
  const pad = 36
  const scale = (box - pad * 2) / span
  const offX = (box - (Math.max(...xs) - minX) * scale) / 2
  const offY = (box - (Math.max(...ys) - minY) * scale) / 2
  const pts = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale] as [number, number])
  return { d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '), start: pts[0] }
}

function Wordmark() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 700 }}>
      <span style={{ color: FOREST }}>Green Streets</span>
      <span style={{ color: NAVY, marginLeft: 9 }}>Initiative</span>
    </span>
  )
}

export default async function OGImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const fonts = await bricolageFonts()
  let ride: RideLookup | null = null
  try {
    if (looksLikeRideCode(code)) ride = (await createServerSupabaseClient().rpc('get_ride_public', { p_code: code })).data as RideLookup | null
  } catch {
    ride = null
  }

  const web = ride && ride.web ? ride : null
  const when = web ? nextWhen(web) : ''
  const route = (web?.route_waypoints ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  const miles = route.length >= 2 ? routeMiles(route) : null
  const drawn = route.length >= 2 ? routePath(route, ROUTE_BOX) : null
  const eyebrow = ['Group ride', miles ? `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` : null, web?.pace ? PACE_LABEL[web.pace].split(' · ')[0] : null]
    .filter(Boolean).join(' · ')
  const title = trim((ride?.name ?? 'A group ride').trim(), 100)
  const lineMax = drawn ? 36 : 60

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', backgroundColor: CREAM, display: 'flex', padding: '60px 72px', fontFamily: 'Bricolage Grotesque' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: drawn ? 48 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: FOREST, fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>{eyebrow}</span>
            <span style={{ color: NAVY, fontSize: titleFontSize(title, !!drawn), fontWeight: 800, lineHeight: 1.04, marginTop: 20 }}>{title}</span>
            {when && <span style={{ color: NAVY, fontSize: 34, fontWeight: 700, marginTop: 24 }}>{trim(when, lineMax)}</span>}
            {web?.meetup_name && <span style={{ color: INK_SOFT, fontSize: 30, marginTop: when ? 8 : 24 }}>{trim(`Meet at ${web.meetup_name}`, lineMax)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: NAVY, fontSize: 28, fontWeight: 700 }}>RSVP here, no app needed</span>
            {!drawn && <Wordmark />}
          </div>
        </div>
        {drawn && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', width: ROUTE_BOX, height: ROUTE_BOX, borderRadius: 28, backgroundColor: '#FFFFFF', border: `2px solid ${NAVY}1F` }}>
              <svg width={ROUTE_BOX} height={ROUTE_BOX} viewBox={`0 0 ${ROUTE_BOX} ${ROUTE_BOX}`}>
                <path d={drawn.d} fill="none" stroke={ROUTE_BLUE} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={drawn.start[0]} cy={drawn.start[1]} r={13} fill={FOREST} stroke="#FFFFFF" strokeWidth={5} />
              </svg>
            </div>
            <Wordmark />
          </div>
        )}
      </div>
    ),
    { ...size, fonts },
  )
}
