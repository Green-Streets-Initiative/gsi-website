/** Social card for a school page: the hub card with the school's name leading. */
import { ImageResponse } from 'next/og'
import { getSchool } from '@/lib/semester/schools'
import { SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_OPENS, SEMESTER_CLOSES } from '@/lib/semester/campaign'
import { SemesterCard, semesterFonts } from '@/lib/semester/og-card'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600
export const alt = 'Shift Your Semester — get around like a local, get $15 for it'

export default async function OGImage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params
  const fonts = await semesterFonts()
  const s = getSchool(school)
  return new ImageResponse(
    <SemesterCard
      eyebrow={s ? `Shift Your Semester · ${s.name}` : 'Shift Your Semester'}
      headline={s ? `${SEMESTER_REWARD} for getting around ${s.name} like a local.` : `Get around like a local. Get ${SEMESTER_REWARD} for it.`}
      sub={`Walk, bike, and ride the T. ${SEMESTER_TRIPS} active trips in 30 days · ${SEMESTER_OPENS.replace(', 2026', '')} – ${SEMESTER_CLOSES}`}
    />,
    { ...size, fonts },
  )
}
