/**
 * Server-rendered Open Graph image for the Shift referral share card.
 *
 * Hit pattern: GET /api/og/share/{referralCode} → 1200×630 PNG.
 *
 * Used by the Cloudflare Worker at shift.gogreenstreets.org/refer/{code}
 * (which serves OG meta tags pointing here) so that messaging apps and
 * social platforms render a rich preview when the share URL is pasted.
 *
 * Card focuses on the referrer's neighborhood — "Join [Neighborhood] on
 * Shift" — rather than personal stats, because the primary sharing use
 * case is inviting neighbors to join a neighborhood group.
 *
 * Cache: 5 min user-side, 1 hour CDN.
 */

import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { loadBricolage, loadTrebuchet } from '@/lib/og-fonts'

export const runtime = 'edge'

const NAVY = '#191A2E'
const LIME = '#BAF14D'
const BLUE = '#2966E5'

interface ShareData {
  firstName: string
  neighborhood: string | null
  town: string | null
  memberCount: number
  shiftRate: number | null
  referralCode: string
}

async function loadShareData(code: string): Promise<ShareData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)

  // Look up user by referral code
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, first_name, home_lat, home_lng')
    .eq('referral_code', code)
    .maybeSingle()

  if (userErr || !user) return null

  const firstName = (user.first_name as string) || 'A friend'

  // Find neighborhood from home coordinates
  let neighborhood: string | null = null
  let town: string | null = null
  let memberCount = 0
  let shiftRate: number | null = null

  if (user.home_lat != null && user.home_lng != null) {
    const { data: nbId } = await supabase.rpc('find_neighborhood_for_point', {
      p_lat: user.home_lat,
      p_lng: user.home_lng,
    })

    if (nbId) {
      // Fetch neighborhood name and town
      const { data: nb } = await supabase
        .from('neighborhoods')
        .select('name, town')
        .eq('id', nbId)
        .maybeSingle()

      if (nb) {
        neighborhood = (nb as { name: string }).name
        town = (nb as { town: string }).town
      }

      // Find the neighborhood group and its stats
      const { data: groupRow } = await supabase
        .from('groups')
        .select('id, group_members(count)')
        .eq('type', 'neighborhood')
        .eq('neighborhood_id', nbId)
        .maybeSingle()

      if (groupRow) {
        const members = groupRow.group_members as unknown
        memberCount = Array.isArray(members)
          ? (members[0] as { count?: number })?.count ?? 0
          : 0

        // Fetch neighborhood shift rate
        const { data: rateRows } = await supabase.rpc('get_group_shift_rate', {
          p_group_id: (groupRow as { id: string }).id,
          p_days: 30,
        })
        const rateRow = (rateRows as { shift_rate?: number }[] | null)?.[0]
        if (rateRow?.shift_rate != null) {
          shiftRate = Math.round(Number(rateRow.shift_rate))
        }
      }
    }
  }

  return { firstName, neighborhood, town, memberCount, shiftRate, referralCode: code }
}

function FallbackCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: NAVY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Bricolage Grotesque',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ color: '#fff', fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          Shift
        </span>
        <svg width={96} height={64} viewBox="0 0 40 26">
          <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
          <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
        </svg>
      </div>
      <div style={{ display: 'flex', color: LIME, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
        Shift Your Summer · June 15 – Aug 15
      </div>
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 28, fontWeight: 400 }}>
        Walk, bike, ride — and win prizes.
      </div>
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 20, marginTop: 24 }}>
        shift.gogreenstreets.org
      </div>
    </div>
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const origin = new URL(req.url).origin

  const [data, fontRegular, fontBold, fontExtra, trebuchetRegular, trebuchetBold] =
    await Promise.all([
      loadShareData(code),
      loadBricolage(400),
      loadBricolage(700),
      loadBricolage(800),
      loadTrebuchet(origin, 'regular'),
      loadTrebuchet(origin, 'bold'),
    ])

  const cacheHeaders = { 'Cache-Control': 'public, max-age=300, s-maxage=3600' }

  const fonts = [
    { name: 'Bricolage Grotesque', data: fontRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontExtra, weight: 800 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetBold, weight: 700 as const, style: 'normal' as const },
  ]

  if (!data) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    })
  }

  // If no neighborhood data, use the fallback with Shift Your Summer branding
  if (!data.neighborhood) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    })
  }

  const headline = data.town
    ? `Join ${data.neighborhood}, ${data.town} on Shift`
    : `Join ${data.neighborhood} on Shift`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: NAVY,
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 64px',
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        {/* Top bar — Shift wordmark + GSI wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#fff', fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>
              Shift
            </span>
            <svg width={50} height={32} viewBox="0 0 40 26">
              <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
              <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
            </svg>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              color: '#fff',
              fontFamily: 'Trebuchet MS',
              fontSize: 18,
              letterSpacing: 0.4,
            }}
          >
            <span style={{ fontWeight: 700 }}>Green Streets</span>
            <span style={{ fontWeight: 400 }}>Initiative</span>
          </div>
        </div>

        {/* Center content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <span
            style={{
              display: 'flex',
              color: '#fff',
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: -1.5,
              lineHeight: 1.1,
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            {headline}
          </span>

          <span
            style={{
              display: 'flex',
              color: LIME,
              fontSize: 28,
              fontWeight: 700,
              marginTop: 20,
            }}
          >
            Shift Your Summer · June 15 – Aug 15
          </span>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              marginTop: 28,
              padding: '14px 32px',
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {memberCount(data.memberCount)}
            {data.shiftRate != null && (
              <>
                <div style={{ display: 'flex', width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                {statItem(`${data.shiftRate}%`, 'Shift rate')}
              </>
            )}
            <div style={{ display: 'flex', width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            {statItem(data.firstName, 'Invited by')}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 20, fontWeight: 400 }}>
            shift.gogreenstreets.org
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    },
  )
}

function memberCount(count: number) {
  const label = count === 1 ? 'member' : 'members'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ display: 'flex', color: '#fff', fontSize: 28, fontWeight: 800 }}>
        {count.toLocaleString()}
      </span>
      <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}

function statItem(value: string, label: string) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ display: 'flex', color: '#fff', fontSize: 28, fontWeight: 800 }}>
        {value}
      </span>
      <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}
