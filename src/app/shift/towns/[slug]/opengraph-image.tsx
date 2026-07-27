/**
 * Dynamic OG image for Shift town pages.
 *
 * Generates a branded 1200×630 social card with the town name, a headline
 * activity stat, and supporting chips (rank, shift rate, top mode). Next.js
 * auto-emits the correct og:image / twitter:image meta tags via the file
 * convention — do NOT also set openGraph.images in generateMetadata.
 *
 * Lives outside /api deliberately: robots.txt has `Disallow: /api`, and
 * facebookexternalhit honors robots.txt, so an OG image served from /api
 * risks being skipped. Mirrors the proven pattern in
 * src/app/wayfinding/[slug]/opengraph-image.tsx.
 *
 * Stat rendering degrades in tiers so freshly-qualifying towns (10 members,
 * few trips) still get a strong card instead of an embarrassing "0".
 */

import { ImageResponse } from 'next/og'
import { getTownBySlug, getTownPageStats } from '@/lib/towns/queries'
import { loadBricolage, loadTrebuchet } from '@/lib/og-fonts'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

export const alt = 'Walking, biking and transit activity on Shift'

// Brand tokens — must match the wayfinding card and the app theme.
const NAVY = '#191A2E'
const SOFT_WHITE = '#E8E8EE'
const LIME = '#BAF14D'
const TEAL = '#52B788'

/** Pick headline font size by name length — "Somerville" vs "West Bridgewater". */
function headlineFontSize(name: string): number {
  if (name.length <= 9) return 118
  if (name.length <= 15) return 92
  if (name.length <= 22) return 74
  return 58
}

const MONTH = new Date().toLocaleDateString('en-US', {
  month: 'long',
  timeZone: 'America/New_York',
})

/** Friendly label for the dominant travel mode, or null when there's no data. */
function topModeLabel(
  modeSplit: Array<{ mode_group: string; trips: number }> | undefined,
): string | null {
  if (!modeSplit || modeSplit.length === 0) return null
  const top = [...modeSplit].sort((a, b) => b.trips - a.trips)[0]
  if (!top || top.trips <= 0) return null
  const labels: Record<string, string> = {
    walk: 'Mostly on foot',
    bike: 'Mostly by bike',
    bus: 'Mostly by bus',
    train: 'Mostly by train',
  }
  return labels[top.mode_group] ?? null
}

type CardFonts = ConstructorParameters<typeof ImageResponse>[1] extends infer O
  ? O extends { fonts?: infer F }
    ? F
    : never
  : never

/** Branded card for the not-found / DB-error path. Never throw from an OG route. */
function fallbackCard(fonts: CardFonts) {
  return new ImageResponse(
    (
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
        <span style={{ color: LIME, fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>
          SHIFT TOWNS
        </span>
        <span style={{ color: SOFT_WHITE, fontSize: 72, fontWeight: 800, marginTop: 16 }}>
          See how your town moves
        </span>
      </div>
    ),
    { ...size, fonts },
  )
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const [fontRegular, fontBold, fontExtra, trebuchetRegular, trebuchetBold] = await Promise.all([
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

  // Never throw: a 500 here means Facebook renders no card at all.
  let result: Awaited<ReturnType<typeof getTownBySlug>> = null
  try {
    result = await getTownBySlug(slug)
  } catch {
    result = null
  }
  if (!result) return fallbackCard(fonts)

  const { town, directory } = result

  let stats = null
  try {
    stats = await getTownPageStats(town.group_id)
  } catch {
    stats = null
  }

  // Headline stat, first tier that qualifies.
  const trips = town.active_trips_month
  const users = town.active_users_month
  let heroStat: string
  if (trips >= 100) {
    heroStat = `${trips.toLocaleString()} active trips in ${MONTH}`
  } else if (users > 0) {
    heroStat = `${users.toLocaleString()} neighbor${users === 1 ? '' : 's'} moving in ${MONTH}`
  } else {
    heroStat = `See how ${town.town_name} moves`
  }

  // Supporting chips — render only the ones that carry real signal.
  const chips: string[] = []
  // Rank is assigned only to towns above PUBLICATION_GATE (others get rank 0),
  // so the denominator must be the *ranked* count — not the full directory,
  // which includes every sub-gate town and would read "#6 of 185".
  const rankedCount = directory.filter((t) => t.rank > 0).length
  if (town.rank > 0 && rankedCount >= 2) {
    chips.push(`#${town.rank} of ${rankedCount} towns`)
  }
  if (town.shift_rate > 0) {
    chips.push(`${Math.round(town.shift_rate)}% Shift Rate`)
  }
  const mode = topModeLabel(stats?.mode_split)
  if (mode) chips.push(mode)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: NAVY,
          fontFamily: 'Bricolage Grotesque',
          paddingLeft: 80,
          paddingRight: 80,
          paddingTop: 56,
          paddingBottom: 48,
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 18, height: 18, backgroundColor: LIME, borderRadius: 2, display: 'flex' }} />
          <span style={{ color: LIME, fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>
            SHIFT TOWNS
          </span>
        </div>

        {/* Town name */}
        <div style={{ display: 'flex', marginTop: 10, maxWidth: 1040 }}>
          <span
            style={{
              color: SOFT_WHITE,
              fontSize: headlineFontSize(town.town_name),
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -2,
            }}
          >
            {town.town_name}
          </span>
        </div>

        {/* Hero stat */}
        <span
          style={{
            display: 'flex',
            color: SOFT_WHITE,
            fontSize: 44,
            fontWeight: 700,
            marginTop: 20,
          }}
        >
          {heroStat}
        </span>

        {/* Chips */}
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginTop: 26, flexWrap: 'wrap' }}>
            {chips.map((c) => (
              <div
                key={c}
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(232,232,238,0.10)',
                  border: '2px solid rgba(232,232,238,0.22)',
                  borderRadius: 999,
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                <span style={{ color: SOFT_WHITE, fontSize: 27, fontWeight: 700 }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex' }} />

        {/* Lime tick */}
        <div style={{ width: 72, height: 6, backgroundColor: LIME, borderRadius: 3, display: 'flex' }} />

        <span style={{ display: 'flex', color: SOFT_WHITE, fontSize: 33, fontWeight: 700, marginTop: 16 }}>
          Every walk, ride and bus trip counts
        </span>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 7,
            marginTop: 22,
            fontFamily: 'Trebuchet MS',
            fontSize: 28,
          }}
        >
          <span style={{ color: SOFT_WHITE, fontWeight: 400 }}>Shift by</span>
          <span style={{ color: TEAL, fontWeight: 700 }}>Green Streets</span>
          <span style={{ color: SOFT_WHITE, fontWeight: 400 }}>Initiative</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    },
  )
}
