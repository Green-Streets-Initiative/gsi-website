/**
 * Social card for the events calendar. Cream system, so a shared link reads as
 * the organization rather than the app. Next.js emits the og:image /
 * twitter:image tags from this file convention — do NOT also set
 * openGraph.images in the page metadata.
 *
 * The card is one image for every filtered variant of /events: the file
 * convention can't see search params, and a calendar card carries its weight
 * without them. The filters shape the title and description instead
 * (src/lib/events-listing-seo.ts).
 */
import { ImageResponse } from 'next/og'
import { bricolageFonts } from '@/lib/og-fonts'
import { CREAM, NAVY, FOREST, INK_SOFT } from '@/lib/semester/og-card'
import { countUpcomingEvents } from './_lib/load'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'Community events across Massachusetts — rides, walks, classes and festivals'

// Four fit on one line at this size; a fifth wraps and leaves a stray chip.
const CATEGORIES = ['Group rides', 'Walking tours', 'Bike classes', 'Festivals']

export default async function OGImage() {
  const [fonts, count] = await Promise.all([bricolageFonts(), countUpcomingEvents()])

  // Below a handful, the number undersells a calendar that fills week to week.
  const sub = count && count >= 8
    ? `${count} upcoming events across Massachusetts`
    : 'Upcoming events across Massachusetts'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: CREAM,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'Bricolage Grotesque',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: FOREST, fontSize: 26, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase' }}>
            Community Events
          </span>
          <span style={{ color: NAVY, fontSize: 88, fontWeight: 800, lineHeight: 1.04, marginTop: 24, maxWidth: 1000 }}>
            Find your next ride, walk, or roll.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                border: `2px solid ${FOREST}33`,
                backgroundColor: `${FOREST}12`,
                borderRadius: 999,
                padding: '10px 26px',
              }}
            >
              <span style={{ color: FOREST, fontSize: 27, fontWeight: 700 }}>{c}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <span style={{ color: INK_SOFT, fontSize: 30, fontWeight: 400, maxWidth: 760, lineHeight: 1.3 }}>{sub}</span>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
            <span style={{ color: FOREST }}>Green Streets</span>
            <span style={{ color: NAVY, marginLeft: 10 }}>Initiative</span>
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
    },
  )
}
