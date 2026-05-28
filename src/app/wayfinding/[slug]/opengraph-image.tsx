/**
 * Dynamic OG image for wayfinding event pages.
 *
 * Generates a branded 1200×630 social card with a map screenshot background,
 * navy scrim on the left, and event details overlaid. Next.js auto-emits the
 * correct og:image meta tag via the file convention.
 *
 * Map screenshots are placed manually at public/og/maps/{slug}.png per event.
 */

import { ImageResponse } from 'next/og'
import { fetchEventConfig } from '@/lib/wayfinding/config'
import { loadBricolage, loadTrebuchet } from '@/lib/og-fonts'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand tokens
const NAVY = '#191A2E'
const SOFT_WHITE = '#E8E8EE'
const LIME = '#BAF14D'
const TEAL = '#52B788'

const TEXT_SHADOW = '2px 3px 4px rgba(0,0,0,0.5)'

/**
 * Format event date + time for display.
 * Input: date_primary "2026-06-07", time_start "14:00", time_end "18:00"
 * Output: "Sun, Jun 7, 2026 · 2–6 PM"
 */
function formatDateDisplay(datePrimary: string, timeStart: string | null, timeEnd: string | null): string {
  const [year, month, day] = datePrimary.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthName = date.toLocaleDateString('en-US', { month: 'short' })
  const dayNum = date.getDate()

  let result = `${dayOfWeek}, ${monthName} ${dayNum}, ${year}`

  if (timeStart && timeEnd) {
    const formatTime = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      const hour12 = h % 12 || 12
      const suffix = h >= 12 ? 'PM' : 'AM'
      return { hour: hour12, minute: m, suffix }
    }
    const start = formatTime(timeStart)
    const end = formatTime(timeEnd)

    const startStr = start.minute > 0 ? `${start.hour}:${String(start.minute).padStart(2, '0')}` : `${start.hour}`
    const endStr = end.minute > 0 ? `${end.hour}:${String(end.minute).padStart(2, '0')}` : `${end.hour}`

    if (start.suffix === end.suffix) {
      result += ` · ${startStr}–${endStr} ${end.suffix}`
    } else {
      result += ` · ${startStr} ${start.suffix}–${endStr} ${end.suffix}`
    }
  }

  return result
}

/** Pick headline font size based on character length. */
function headlineFontSize(name: string): number {
  if (name.length <= 9) return 118
  if (name.length <= 15) return 92
  return 74
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await fetchEventConfig(slug)

  if (!event) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', backgroundColor: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: SOFT_WHITE, fontSize: 48, fontFamily: 'Bricolage Grotesque' }}>Event not found</span>
      </div>,
      { ...size },
    )
  }

  // Load fonts + map image in parallel
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const [fontRegular, fontBold, fontExtra, trebuchetRegular, trebuchetBold, mapImageData] = await Promise.all([
    loadBricolage(400),
    loadBricolage(700),
    loadBricolage(800),
    loadTrebuchet(origin, 'regular'),
    loadTrebuchet(origin, 'bold'),
    fetch(`${origin}/og/maps/${slug}.png`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null),
  ])

  const fonts = [
    { name: 'Bricolage Grotesque', data: fontRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Bricolage Grotesque', data: fontExtra, weight: 800 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'Trebuchet MS', data: trebuchetBold, weight: 700 as const, style: 'normal' as const },
  ]

  const dateDisplay = formatDateDisplay(event.date_primary, event.time_start, event.time_end)
  const fontSize = headlineFontSize(event.name)

  // Convert map image to base64 data URI if available
  const mapSrc = mapImageData
    ? `data:image/png;base64,${Buffer.from(mapImageData).toString('base64')}`
    : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: NAVY,
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        {/* Map background — cover-fit */}
        {mapSrc && (
          <img
            src={mapSrc}
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Navy tint over map */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(25,26,46,0.12)',
            display: 'flex',
          }}
        />

        {/* Left scrim gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'linear-gradient(to right, rgba(25,26,46,0.96) 0%, rgba(25,26,46,0.96) 15%, rgba(25,26,46,0.55) 40%, rgba(25,26,46,0.22) 60%, rgba(25,26,46,0) 75%)',
            display: 'flex',
          }}
        />

        {/* Text overlay column */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            paddingLeft: 80,
            paddingTop: 56,
            paddingBottom: 48,
          }}
        >
          {/* Eyebrow: lime square + GETTING AROUND */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 18, height: 18, backgroundColor: LIME, borderRadius: 2, display: 'flex' }} />
            <span
              style={{
                color: LIME,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 6,
                textShadow: TEXT_SHADOW,
              }}
            >
              GETTING AROUND
            </span>
          </div>

          {/* Headline — event name */}
          <div
            style={{
              display: 'flex',
              marginTop: 8,
              maxWidth: 560,
            }}
          >
            <span
              style={{
                color: SOFT_WHITE,
                fontSize,
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: -2,
                textShadow: TEXT_SHADOW,
              }}
            >
              {event.name}
            </span>
          </div>

          {/* Date */}
          <span
            style={{
              display: 'flex',
              color: SOFT_WHITE,
              fontSize: 38,
              fontWeight: 700,
              marginTop: 16,
              textShadow: TEXT_SHADOW,
            }}
          >
            {dateDisplay}
          </span>

          {/* Location primary */}
          {event.og_location_primary && (
            <span
              style={{
                display: 'flex',
                color: SOFT_WHITE,
                fontSize: 27,
                fontWeight: 700,
                marginTop: 8,
                textShadow: TEXT_SHADOW,
              }}
            >
              {event.og_location_primary}
            </span>
          )}

          {/* Location detail (optional) */}
          {event.og_location_detail && (
            <span
              style={{
                display: 'flex',
                color: SOFT_WHITE,
                fontSize: 22,
                fontWeight: 400,
                marginTop: 4,
                textShadow: TEXT_SHADOW,
              }}
            >
              {event.og_location_detail}
            </span>
          )}

          {/* Spacer to push tagline + footer toward bottom */}
          <div style={{ flex: 1, display: 'flex' }} />

          {/* Lime tick separator */}
          <div style={{ width: 72, height: 6, backgroundColor: LIME, borderRadius: 3, display: 'flex' }} />

          {/* Tagline */}
          <span
            style={{
              display: 'flex',
              color: SOFT_WHITE,
              fontSize: 33,
              fontWeight: 700,
              marginTop: 16,
              textShadow: TEXT_SHADOW,
            }}
          >
            By bike, transit, or foot
          </span>

          {/* Footer: Wayfinding by Green Streets Initiative */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              marginTop: 24,
              fontFamily: 'Trebuchet MS',
              fontSize: 28,
              textShadow: TEXT_SHADOW,
            }}
          >
            <span style={{ color: SOFT_WHITE, fontWeight: 400 }}>Wayfinding by </span>
            <span style={{ color: TEAL, fontWeight: 700 }}>Green Streets</span>
            <span style={{ color: SOFT_WHITE, fontWeight: 400 }}> Initiative</span>
          </div>
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
