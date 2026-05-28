import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { loadBricolage, loadTrebuchet } from '@/lib/og-fonts'

export const runtime = 'edge'

const NAVY = '#191A2E'
const LIME = '#BAF14D'
const BLUE = '#2966E5'

type GroupCard = {
  name: string
  invite_code: string
  logo_url: string | null
}

async function loadGroup(slug: string): Promise<GroupCard | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)

  const { data, error } = await supabase
    .from('groups')
    .select('name, invite_code, logo_url, status, access_ends_at')
    .eq('slug', slug)
    .in('status', ['active', 'cancelled'])
    .maybeSingle()

  if (error || !data) return null
  const row = data as GroupCard & { access_ends_at: string | null }
  if (row.access_ends_at && new Date(row.access_ends_at) < new Date()) return null
  return { name: row.name, invite_code: row.invite_code, logo_url: row.logo_url }
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
        Every trip counts.
      </div>
      <div style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 24, marginTop: 24 }}>
        shift.gogreenstreets.org
      </div>
    </div>
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const origin = new URL(req.url).origin

  const [group, fontRegular, fontBold, fontExtra, trebuchetRegular, trebuchetBold] =
    await Promise.all([
      loadGroup(slug),
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

  if (!group) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    })
  }

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
          {group.logo_url && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 96,
                height: 96,
                borderRadius: 24,
                backgroundColor: '#fff',
                marginBottom: 24,
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={group.logo_url}
                alt=""
                width={72}
                height={72}
                style={{ objectFit: 'contain' }}
              />
            </div>
          )}

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
            Join {group.name} for Shift Your Summer
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

          {/* Invite code */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 28,
              padding: '14px 32px',
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <span style={{ display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: 500 }}>
              Team code
            </span>
            <span
              style={{
                display: 'flex',
                fontFamily: 'monospace',
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 8,
                color: LIME,
              }}
            >
              {group.invite_code}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ display: 'flex', color: 'rgba(255,255,255,0.65)', fontSize: 20, fontWeight: 400 }}>
            gogreenstreets.org/events/shift-your-summer
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
