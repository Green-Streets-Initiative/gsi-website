/**
 * Server-rendered Open Graph image for the Shift referral share card.
 *
 * Hit pattern: GET /api/og/share/{referralCode} → 1200×630 PNG.
 *
 * Used by the Cloudflare Worker at shift.gogreenstreets.org/refer/{code}
 * so messaging apps render a rich preview when a referral link is shared.
 *
 * Card focuses on the referrer's neighborhood — "Join [Neighborhood] on
 * Shift" — with the neighborhood's ranking in its town, the active
 * competition (if any), the referral code, and who invited them.
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
  rank: number | null
  totalGroups: number | null
  referralCode: string
  competitionName: string | null
  competitionDates: string | null
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const s = new Date(start).toLocaleDateString('en-US', opts)
  const e = new Date(end).toLocaleDateString('en-US', opts)
  return `${s} – ${e}`
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

  const userId = user.id as string
  const firstName = (user.first_name as string) || 'A friend'

  // Find active/upcoming Shift Your Summer competition
  const { data: comps } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Shift Your Summer%')
    .order('starts_at', { ascending: false })
    .limit(5)

  const competitions = (comps ?? []) as { id: string; name: string; starts_at: string; ends_at: string }[]
  const now = Date.now()
  const competition =
    competitions.find(c => new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() >= now) ??
    competitions.find(c => new Date(c.starts_at).getTime() > now) ??
    competitions[0] ?? null

  // Find neighborhood from home coordinates
  let neighborhood: string | null = null
  let town: string | null = null
  let memberCount = 0
  let rank: number | null = null
  let totalGroups: number | null = null

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

      // Find the neighborhood group and its member count
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

        // Find the town group to get neighborhood ranking
        if (town) {
          const { data: townGroup } = await supabase
            .from('groups')
            .select('id')
            .eq('type', 'town')
            .eq('name', town)
            .maybeSingle()

          if (townGroup) {
            const { data: standing } = await supabase.rpc('get_town_neighborhood_standing', {
              p_town_group_id: (townGroup as { id: string }).id,
              p_user_id: userId,
              p_metric: 'shift_rate',
              p_days: 30,
            })

            const row = Array.isArray(standing) ? standing[0] : standing
            if (row) {
              rank = (row as { self_rank?: number }).self_rank ?? null
              totalGroups = (row as { total_groups?: number }).total_groups ?? null
            }
          }
        }
      }
    }
  }

  return {
    firstName,
    neighborhood,
    town,
    memberCount,
    rank,
    totalGroups,
    referralCode: code,
    competitionName: competition?.name ?? null,
    competitionDates: competition ? formatDateRange(competition.starts_at, competition.ends_at) : null,
  }
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
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 36, fontWeight: 400 }}>
        Walk, bike, ride — and get rewarded for it.
      </div>
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 24, marginTop: 24 }}>
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

  if (!data || !data.neighborhood) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    })
  }

  const neighborhoodLine = data.town
    ? `Join ${data.neighborhood}, ${data.town}`
    : `Join ${data.neighborhood}`

  const hasCompetition = !!data.competitionName

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: NAVY,
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px',
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
          {/* Headline — neighborhood on first line, "on Shift" on second */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                display: 'flex',
                color: '#fff',
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: -1.5,
                lineHeight: 1.1,
                textAlign: 'center',
              }}
            >
              {neighborhoodLine}
            </span>
            <span
              style={{
                display: 'flex',
                color: '#fff',
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: -1.5,
                lineHeight: 1.1,
              }}
            >
              on Shift
            </span>
          </div>

          {/* Description — what this is and why they should care */}
          {hasCompetition ? (
            <span
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 22,
                fontWeight: 400,
                marginTop: 16,
                textAlign: 'center',
                maxWidth: 700,
              }}
            >
              Every walk, bike ride, and transit trip is an entry to win prizes.
            </span>
          ) : (
            <span
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 22,
                fontWeight: 400,
                marginTop: 16,
              }}
            >
              Walk, bike, ride — and get rewarded for it.
            </span>
          )}

          {/* Competition badge */}
          {hasCompetition && (
            <span
              style={{
                display: 'flex',
                color: LIME,
                fontSize: 18,
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {data.competitionName} · {data.competitionDates} · Official rules at gogreenstreets.org
            </span>
          )}

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              marginTop: 28,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {/* Members */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 36px' }}>
              <span style={{ display: 'flex', color: '#fff', fontSize: 28, fontWeight: 800 }}>
                {data.memberCount.toLocaleString()}
              </span>
              <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                {data.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>

            {/* Ranking */}
            {data.rank != null && data.totalGroups != null && data.town && (
              <>
                <div style={{ display: 'flex', alignSelf: 'center', width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 36px' }}>
                  <span style={{ display: 'flex', color: LIME, fontSize: 28, fontWeight: 800 }}>
                    #{data.rank}
                  </span>
                  <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                    of {data.totalGroups} in {data.town}
                  </span>
                </div>
              </>
            )}

            {/* Invited by */}
            <div style={{ display: 'flex', alignSelf: 'center', width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 36px' }}>
              <span style={{ display: 'flex', color: '#fff', fontSize: 28, fontWeight: 800 }}>
                {data.firstName}
              </span>
              <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                Invited by
              </span>
            </div>
          </div>
        </div>

        {/* Footer — referral code */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 20, fontWeight: 500 }}>
            Use code
          </span>
          <span
            style={{
              display: 'flex',
              fontFamily: 'monospace',
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 4,
              color: LIME,
            }}
          >
            {data.referralCode}
          </span>
          <span style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 20, fontWeight: 500 }}>
            to join
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
