/**
 * Social card for the Shift Your Semester hub — the cream system, not the
 * app's navy, so a shared link reads as the organization. Next.js emits the
 * og:image / twitter:image tags from this file convention; do not also set
 * openGraph.images in the page metadata.
 */
import { ImageResponse } from 'next/og'
import { SemesterCard, semesterFonts } from '@/lib/semester/og-card'
import { SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_OPENS, SEMESTER_CLOSES } from '@/lib/semester/campaign'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'Shift Your Semester — get around like a local, get $15 for it'

export default async function OGImage() {
  const fonts = await semesterFonts()
  return new ImageResponse(
    <SemesterCard
      eyebrow="Shift Your Semester"
      headline={`Get around like a local. Get ${SEMESTER_REWARD} for it.`}
      sub={`${SEMESTER_REWARD} for your first ${SEMESTER_TRIPS} active trips · ${SEMESTER_OPENS.replace(', 2026', '')} – ${SEMESTER_CLOSES}`}
    />,
    { ...size, fonts },
  )
}
