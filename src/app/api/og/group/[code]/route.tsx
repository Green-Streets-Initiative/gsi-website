/**
 * Server-rendered Open Graph image for a Shift group invite.
 *
 * Hit pattern: GET /api/og/group/{inviteCode} → 1200×630 PNG.
 *
 * Used by the Cloudflare Worker at shift.gogreenstreets.org/join/{code}
 * (Shift repo docs/cloudflare-worker-refer.js) so a group link shared from
 * the app's group page previews as the group: "Join Somerville on Shift",
 * how many members it has, and the code. Same look as the referral card
 * (/api/og/share/{code}), sized to read at link-preview size: nothing on
 * the card is under 28px.
 *
 * Public fields only: name, type, member count. Never who the members are.
 * An unknown code gets the generic Shift card.
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

// Below this a member count reads as an empty group, so the card leaves it
// off and lets the headline and code carry it.
const MIN_MEMBERS_SHOWN = 3

interface GroupCardData {
  name: string
  memberCount: number
  code: string
}

async function loadGroup(rawCode: string): Promise<GroupCardData | null> {
  const code = rawCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)

  const { data: g, error } = await supabase
    .from('groups')
    .select('id, name, type, status')
    .eq('invite_code', code)
    .maybeSingle()
  if (error || !g || !g.name) return null
  // status belongs to the employer program: workplace and school groups
  // must be active; town and neighborhood groups are shown as they are
  // (the same rule as the Shift group-invite-lookup function).
  const employerType = g.type === 'workplace' || g.type === 'school'
  if (employerType && g.status !== 'active') return null

  const { count } = await supabase
    .from('group_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('group_id', g.id)

  return { name: g.name as string, memberCount: count ?? 0, code }
}

function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const s = size === 'large'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s ? 12 : 10 }}>
      <span style={{ color: '#fff', fontSize: s ? 96 : 40, fontWeight: 800, letterSpacing: s ? -2 : -1 }}>
        Shift
      </span>
      <svg width={s ? 96 : 52} height={s ? 64 : 34} viewBox="0 0 40 26">
        <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
        <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
      </svg>
    </div>
  )
}

function GsiWordmark() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        color: '#fff',
        fontFamily: 'Trebuchet MS',
        fontSize: 28,
        letterSpacing: 0.4,
      }}
    >
      <span style={{ fontWeight: 700 }}>Green Streets</span>
      <span style={{ fontWeight: 400 }}>Initiative</span>
    </div>
  )
}

/** The same generic card the referral route falls back to. */
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
      <Wordmark />
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 36, fontWeight: 400, marginTop: 24 }}>
        A free app that rewards walking, biking and taking transit.
      </div>
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 28, marginTop: 24 }}>
        shift.gogreenstreets.org
      </div>
    </div>
  )
}

function GroupCard({ data }: { data: GroupCardData }) {
  const headline = `Join ${data.name} on Shift`
  // Long names wrap to two lines; past ~30 characters drop to the floor
  // size (64) so two lines still leave room for the count and the code.
  const headlineSize = headline.length > 30 ? 64 : 76
  const showCount = data.memberCount >= MIN_MEMBERS_SHOWN

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: NAVY,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 64px',
        fontFamily: 'Bricolage Grotesque',
      }}
    >
      {/* Top bar — Shift wordmark + GSI wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Wordmark size="small" />
        <GsiWordmark />
      </div>

      {/* Center — headline and member count */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <span
          style={{
            display: 'flex',
            color: '#fff',
            fontSize: headlineSize,
            fontWeight: 800,
            letterSpacing: -1.5,
            lineHeight: 1.08,
            textAlign: 'center',
            justifyContent: 'center',
            maxWidth: 1072,
          }}
        >
          {headline}
        </span>

        {showCount && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 28 }}>
            <span style={{ display: 'flex', color: LIME, fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
              {data.memberCount.toLocaleString('en-US')}
            </span>
            <span style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 40, fontWeight: 700 }}>
              members
            </span>
          </div>
        )}
      </div>

      {/* Footer — the code */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <span style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 36, fontWeight: 500 }}>
          Use code
        </span>
        <span
          style={{
            display: 'flex',
            fontFamily: 'monospace',
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: 6,
            color: LIME,
          }}
        >
          {data.code}
        </span>
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
      loadGroup(code),
      loadBricolage(400),
      loadBricolage(700),
      loadBricolage(800),
      loadTrebuchet(origin, 'regular'),
      loadTrebuchet(origin, 'bold'),
    ])

  const fonts = [
    { name: 'Bricolage Grotesque', data: fontRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontExtra, weight: 800 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetBold, weight: 700 as const, style: 'normal' as const },
  ]

  const imgOpts = {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
    fonts,
  }

  if (!data) return new ImageResponse(<FallbackCard />, imgOpts)
  return new ImageResponse(<GroupCard data={data} />, imgOpts)
}
